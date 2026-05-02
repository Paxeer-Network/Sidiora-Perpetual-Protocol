"use strict";

/**
 * In-process pub-sub bridge for GraphQL subscriptions.
 *
 * Architecture:
 *   PG NOTIFY (IndexerPubSub)  ──100ms coalesce──►  graphql-subscriptions PubSub
 *                                                          │
 *                                                    Subscription resolvers
 *                                                          │
 *                                                    graphql-ws clients
 *
 * Topics published to gqlPubSub (all derived from PG notifications):
 *   block_committed  — every indexer commit (coalesced to 100ms window)
 */

const { PubSub } = require("graphql-subscriptions");

const gqlPubSub = new PubSub();

let _pgPubSub = null;

/**
 * Start the PG LISTEN → in-process PubSub bridge.
 * Call this once when the GraphQL server boots.
 *
 * @param {string} databaseUrl  DATABASE_URL for the dedicated LISTEN connection
 * @param {object} logger       Optional logger (falls back to console)
 */
async function startSubscriptionBridge(databaseUrl, logger = console) {
  const { IndexerPubSub } = require("../db/pubsub");
  _pgPubSub = new IndexerPubSub();
  await _pgPubSub.start(databaseUrl);

  // Coalesce rapid block_committed bursts (100ms window) to avoid
  // thundering-herd fan-outs at 10 blocks/sec during catchup.
  let _coalesceTimer = null;
  let _lastPayload = null;

  _pgPubSub.subscribe("block_committed", (data) => {
    _lastPayload = data;
    if (!_coalesceTimer) {
      _coalesceTimer = setTimeout(() => {
        _coalesceTimer = null;
        gqlPubSub.publish("block_committed", _lastPayload);
      }, 100);
    }
  });

  logger.info?.("[subscriptions] PG LISTEN bridge started");
}

async function stopSubscriptionBridge() {
  if (_pgPubSub) {
    await _pgPubSub.close();
    _pgPubSub = null;
  }
}

module.exports = { gqlPubSub, startSubscriptionBridge, stopSubscriptionBridge };
