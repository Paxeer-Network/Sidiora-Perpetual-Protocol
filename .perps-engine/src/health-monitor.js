/**
 * Health Monitor — self-diagnostics, balance checks, and alerting.
 *
 * Runs checks after each cycle and fires alerts on critical conditions.
 * Pluggable alert backend: stderr (default), Slack webhook, Telegram bot.
 */
class HealthMonitor {
  constructor(config, submitter, logger) {
    this.config = config;
    this.submitter = submitter;
    this.logger = logger;

    this._lastBalanceCheck = 0;
    this._lastBalance = null;
    this._alertCooldowns = new Map(); // alertKey → last alert timestamp
  }

  /**
   * Run health checks after a cycle.
   * @param {{ success: boolean, error?: string }} cycleResult
   */
  async checkAfterCycle(cycleResult) {
    const stats = this.submitter.getStats();

    // Check consecutive failures
    if (stats.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      await this._alert(
        "consecutive_failures",
        `CRITICAL: ${stats.consecutiveFailures} consecutive cycle failures. Last error: ${cycleResult.error || "unknown"}`,
        300000 // 5 min cooldown
      );
    }

    // Check balance every 5 minutes
    const now = Date.now();
    if (now - this._lastBalanceCheck > 300000) {
      try {
        this._lastBalance = await this.submitter.getBalance();
        this._lastBalanceCheck = now;

        if (parseFloat(this._lastBalance) < this.config.minWalletBalancePax) {
          await this._alert(
            "low_balance",
            `LOW BALANCE: ${this._lastBalance} PAX. Minimum: ${this.config.minWalletBalancePax} PAX. Refill keeper wallet: ${this.submitter.wallet.address}`,
            600000 // 10 min cooldown
          );
        }
      } catch (err) {
        this.logger.warn(`  [Health] Balance check failed: ${err.message}`);
      }
    }
  }

  /**
   * Run startup diagnostics.
   * @returns {{ healthy: boolean, issues: string[] }}
   */
  async runStartupDiagnostics() {
    const issues = [];

    // Check wallet balance
    try {
      const balance = await this.submitter.getBalance();
      this._lastBalance = balance;
      this.logger.info(`  Wallet balance:   ${balance} PAX`);

      if (parseFloat(balance) < this.config.minWalletBalancePax) {
        issues.push(`Low balance: ${balance} PAX`);
        this.logger.warn(`  LOW BALANCE: ${balance} PAX`);
      }
    } catch (err) {
      issues.push(`Cannot check balance: ${err.message}`);
    }

    // Check ORACLE_POSTER_ROLE
    try {
      const { ethers } = require("ethers");
      const ORACLE_POSTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_POSTER"));
      const hasRole = await this.submitter.hasRole(ORACLE_POSTER_ROLE, this.submitter.wallet.address);

      if (hasRole) {
        this.logger.info("  ORACLE_POSTER_ROLE: GRANTED");
      } else {
        issues.push("ORACLE_POSTER_ROLE not granted — executeCycle() will revert");
        this.logger.error("  ORACLE_POSTER_ROLE: NOT GRANTED");
        this.logger.error(
          `  Grant: diamond.grantRole(${ORACLE_POSTER_ROLE}, "${this.submitter.wallet.address}")`
        );
      }
    } catch (err) {
      issues.push(`Role check failed: ${err.message}`);
    }

    // Check robustness params
    try {
      const params = await this.submitter.getRobustnessParams();
      this.logger.info(`  Max price deviation: ${Number(params.maxPriceDeviationBps)}bps`);
      this.logger.info(`  Min position size:   ${this._formatUsd(params.minPositionSizeUsd)}`);
      this.logger.info(`  Min order size:      ${this._formatUsd(params.minOrderSizeUsd)}`);
    } catch (err) {
      this.logger.debug(`  Robustness params check failed: ${err.message}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  getLastBalance() {
    return this._lastBalance;
  }

  // ============================================================
  //  Alert dispatch
  // ============================================================

  async _alert(key, message, cooldownMs) {
    const now = Date.now();
    const lastAlert = this._alertCooldowns.get(key) || 0;
    if (now - lastAlert < cooldownMs) return;

    this._alertCooldowns.set(key, now);
    this.logger.error(`  [ALERT] ${message}`);

    // Slack webhook
    if (this.config.alertWebhookUrl) {
      try {
        await fetch(this.config.alertWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `[PPMM Engine] ${message}` }),
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) {
        this.logger.warn(`  [ALERT] Slack webhook failed: ${err.message}`);
      }
    }

    // Telegram bot
    if (this.config.alertTelegramBotToken && this.config.alertTelegramChatId) {
      try {
        const url = `https://api.telegram.org/bot${this.config.alertTelegramBotToken}/sendMessage`;
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: this.config.alertTelegramChatId,
            text: `[PPMM Engine] ${message}`,
            parse_mode: "HTML",
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) {
        this.logger.warn(`  [ALERT] Telegram send failed: ${err.message}`);
      }
    }
  }

  _formatUsd(val) {
    return `$${(Number(BigInt(val) / 10n ** 14n) / 10000).toFixed(2)}`;
  }
}

module.exports = { HealthMonitor };
