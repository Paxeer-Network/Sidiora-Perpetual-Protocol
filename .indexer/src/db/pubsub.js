"use strict";

/**
 * Thin PostgreSQL LISTEN/NOTIFY pub-sub bridge.
 *
 * Architecture:
 *   Indexer  → pg_notify('ppmm_events', JSON)   (one call per commit)
 *   GraphQL  → LISTEN ppmm_events               (one dedicated PG connection)
 *
 * Topics emitted by the indexer (all in the same channel):
 *   block_committed   { blockNumber, eventsCount }
 *   price_updated     { marketId, price, blockNumber }
 *   position_changed  { userAddress, positionId, status, blockNumber }
 *   trade_created     { marketId, userAddress, positionId, blockNumber }
 *   liquidation       { marketId, userAddress, positionId, blockNumber }
 *   order_changed     { userAddress, orderId, status, blockNumber }
 */

const { Pool } = require("pg");

const CHANNEL = "ppmm_events";

// ────────────────────────────────────────────────────────────────────────────
//  Indexer side — call notify() after each successful block commit
// ────────────────────────────────────────────────────────────────────────────

/**
 * Emit a notification. `client` is any pg Client or Pool that supports .query().
 * Fire-and-forget: errors are swallowed so they never kill the indexer loop.
 */
async function notify(client, topic, data) {
  const payload = JSON.stringify({ topic, data, ts: Date.now() });
  try {
    await client.query(`SELECT pg_notify($1, $2)`, [CHANNEL, payload]);
  } catch {
    // Notification delivery is best-effort — never fatal
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  GraphQL side — IndexerPubSub listens and routes to in-process handlers
// ────────────────────────────────────────────────────────────────────────────

class IndexerPubSub {
  constructor() {
    this._handlers = new Map(); // topic → Set<function>
    this._conn = null;          // dedicated PG client for LISTEN
    this._pool = null;
    this._reconnectTimer = null;
    this._closed = false;
  }

  /**
   * Start listening. `databaseUrl` should be the same DATABASE_URL used by
   * the rest of the process.
   */
  async start(databaseUrl) {
    this._databaseUrl = databaseUrl;
    await this._connect();
  }

  async _connect() {
    if (this._closed) return;

    try {
      if (this._pool) {
        try { this._pool.end(); } catch {}
      }

      // Use a single-connection pool so we get a stable dedicated client
      this._pool = new Pool({ connectionString: this._databaseUrl, max: 1 });
      this._conn = await this._pool.connect();

      await this._conn.query(`LISTEN ${CHANNEL}`);

      this._conn.on("notification", (msg) => this._dispatch(msg.payload));

      this._conn.on("error", (err) => {
        console.error(`[pubsub] connection error: ${err.message} — reconnecting...`);
        this._scheduleReconnect();
      });

    } catch (err) {
      console.error(`[pubsub] connect failed: ${err.message} — retrying in 5s`);
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this._closed || this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connect();
    }, 5_000);
  }

  _dispatch(rawPayload) {
    let msg;
    try {
      msg = JSON.parse(rawPayload);
    } catch {
      return;
    }
    const { topic, data } = msg;
    if (!topic) return;

    const topicHandlers = this._handlers.get(topic);
    if (topicHandlers) {
      for (const fn of topicHandlers) {
        try { fn(data); } catch {}
      }
    }

    // Wildcard handlers receive every notification
    const wildcardHandlers = this._handlers.get("*");
    if (wildcardHandlers) {
      for (const fn of wildcardHandlers) {
        try { fn(msg); } catch {}
      }
    }
  }

  /**
   * Subscribe to a specific topic (or "*" for all).
   * Returns an unsubscribe function.
   */
  subscribe(topic, handler) {
    if (!this._handlers.has(topic)) {
      this._handlers.set(topic, new Set());
    }
    this._handlers.get(topic).add(handler);
    return () => {
      const s = this._handlers.get(topic);
      if (s) s.delete(handler);
    };
  }

  async close() {
    this._closed = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._conn) {
      try { this._conn.release(true); } catch {}
      this._conn = null;
    }
    if (this._pool) {
      try { await this._pool.end(); } catch {}
      this._pool = null;
    }
  }
}

// Singleton — imported by both the indexer emit path and the GraphQL listen path
const pubsub = new IndexerPubSub();

module.exports = { notify, IndexerPubSub, pubsub, CHANNEL };
