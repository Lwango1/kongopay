// Gestion des risques professionnelle
// Kelly Criterion, Drawdown Control, Correlation Filter, Volatility Sizing

class RiskManager {
  constructor() {
    this.consecutiveLosses = 0;
    this.maxConsecutiveLosses = 4;
    this.maxDailyLoss = 0.15; // 15% max drawdown par jour
    this.dailyPnl = 0;
    this.initialCapital = 1000;
    this.currentCapital = 1000;
    this.peakCapital = 1000;
    this.tradeHistory = [];
    this.dailyReset();
    this.correlationMatrix = {};
  }

  dailyReset() {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.dailyPnl = 0;
      this.dailyTrades = 0;
      this.lastResetDate = today;
    }
  }

  // Kelly Criterion: f* = (bp - q) / b
  // p = win rate, q = 1-p, b = avg win / avg loss ratio
  kellyFraction(winRate, avgWinPct, avgLossPct) {
    if (avgLossPct >= 0) return 0.01; // safety
    const b = Math.abs(avgWinPct / avgLossPct);
    const q = 1 - winRate;
    const f = (b * winRate - q) / b;
    // Use half-Kelly for safety
    return Math.max(0, Math.min(f * 0.5, 0.25));
  }

  // Estimate dynamic trade size based on current conditions
  estimateTradeSize(signal, accountBalance) {
    this.dailyReset();
    this.currentCapital = accountBalance;

    // 1. Kelly sizing from historical performance
    const stats = this.getPerformanceStats();
    let kellySize = 0.1; // default 10%

    if (stats.totalTrades >= 10) {
      kellySize = this.kellyFraction(
        stats.winRate / 100,
        stats.avgWinPct,
        stats.avgLossPct
      );
    }

    // 2. Volatility adjustment
    const volScale = signal.volScale || 1;
    const volAdjusted = kellySize / Math.max(volScale, 0.5);

    // 3. Drawdown guard
    const drawdown = this.peakCapital > 0
      ? (this.peakCapital - this.currentCapital) / this.peakCapital
      : 0;

    let ddMultiplier = 1;
    if (drawdown > 0.1) ddMultiplier = 0.5; // -10%: half size
    if (drawdown > 0.15) ddMultiplier = 0.25; // -15%: quarter size
    if (drawdown > 0.2) ddMultiplier = 0; // -20%: stop trading

    // 4. Consecutive losses guard
    let clMultiplier = 1;
    if (this.consecutiveLosses >= 2) clMultiplier = 0.7;
    if (this.consecutiveLosses >= 3) clMultiplier = 0.4;
    if (this.consecutiveLosses >= this.maxConsecutiveLosses) clMultiplier = 0;

    // 5. Daily loss limit
    let dailyMultiplier = 1;
    const dailyLossPct = this.initialCapital > 0
      ? Math.abs(this.dailyPnl) / this.initialCapital
      : 0;
    if (dailyLossPct > this.maxDailyLoss) dailyMultiplier = 0;
    else if (dailyLossPct > this.maxDailyLoss * 0.7) dailyMultiplier = 0.3;

    const finalFraction = volAdjusted * ddMultiplier * clMultiplier * dailyMultiplier;

    return {
      fraction: Math.round(finalFraction * 100) / 100,
      kellyBase: Math.round(kellySize * 100) / 100,
      adjusted: Math.round(volAdjusted * 100) / 100,
      multipliers: {
        volatility: Math.round((1 / Math.max(volScale, 0.5)) * 100) / 100,
        drawdown: ddMultiplier,
        consecutiveLosses: clMultiplier,
        dailyLimit: dailyMultiplier,
      },
      stopped: finalFraction <= 0,
      stopReason: finalFraction <= 0
        ? drawdown > 0.2 ? 'drawdown_max' : this.consecutiveLosses >= this.maxConsecutiveLosses
          ? 'consecutive_losses' : dailyLossPct > this.maxDailyLoss
            ? 'daily_loss_limit' : 'unknown'
        : null,
    };
  }

  // Correlation check: avoid opposite signals simultaneously
  checkCorrelation(newSignal, activeSignals) {
    const newType = newSignal.type;
    const newDir = newSignal.expectedDirection;

    for (const active of activeSignals) {
      // Opposite direction on same index type = conflict
      if (active.type === newType && active.expectedDirection !== newDir) {
        return {
          conflict: true,
          reason: `Signal ${active.label} déjà actif en sens inverse`,
          severity: 'high',
        };
      }

      // Boom & Crash opposite directions = partial hedge (allowed but warn)
      if (active.type !== newType && active.expectedDirection !== newDir) {
        return {
          conflict: true,
          reason: `Hedge détecté: ${active.label} vs ${newType}`,
          severity: 'low',
        };
      }
    }

    return { conflict: false };
  }

  // Record trade result for stats
  recordTrade(trade) {
    this.tradeHistory.push({
      ...trade,
      timestamp: new Date().toISOString(),
    });

    this.dailyPnl += trade.pnl;
    this.dailyTrades++;
    this.currentCapital += trade.pnl;

    if (this.currentCapital > this.peakCapital) {
      this.peakCapital = this.currentCapital;
    }

    if (trade.pnl <= 0) {
      this.consecutiveLosses++;
    } else {
      this.consecutiveLosses = 0;
    }

    // Keep only last 100 trades
    if (this.tradeHistory.length > 100) {
      this.tradeHistory = this.tradeHistory.slice(-100);
    }
  }

  getPerformanceStats() {
    const trades = this.tradeHistory;
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        avgWinPct: 0,
        avgLossPct: 0,
        profitFactor: 0,
        sharpeRatio: 0,
      };
    }

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl <= 0);
    const winRate = (wins.length / trades.length) * 100;

    const avgWinPct = wins.length > 0
      ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length
      : 0;
    const avgLossPct = losses.length > 0
      ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length
      : 0;

    const totalProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const totalLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : trades.length > 0 ? Infinity : 0;

    const returns = trades.map(t => t.pnlPct);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    return {
      totalTrades: trades.length,
      winRate,
      avgWinPct,
      avgLossPct,
      profitFactor,
      sharpeRatio,
      consecutiveLosses: this.consecutiveLosses,
    };
  }

  // Filter signals through risk management
  async filterSignal(signal, accountBalance, activeSignals) {
    this.dailyReset();

    // 1. Correlation check
    const corrCheck = this.checkCorrelation(signal, activeSignals);
    if (corrCheck.conflict && corrCheck.severity === 'high') {
      return { allowed: false, reason: corrCheck.reason, signal: null };
    }

    // 2. Position sizing
    const sizing = this.estimateTradeSize(signal, accountBalance);
    if (sizing.stopped) {
      return { allowed: false, reason: `Trading stoppé: ${sizing.stopReason}`, signal: null };
    }

    // 3. Apply size to signal
    const sizedSignal = {
      ...signal,
      risk: {
        fraction: sizing.fraction,
        kellyBase: sizing.kellyBase,
        multipliers: sizing.multipliers,
        estimatedEntry: signal.entryPrice,
        estimatedSL: signal.stopLoss,
        estimatedTP: signal.takeProfit,
        riskRewardRatio: signal.entryPrice && signal.stopLoss && signal.takeProfit
          ? Math.abs((signal.takeProfit - signal.entryPrice) / (signal.entryPrice - signal.stopLoss))
          : 0,
      },
    };

    return { allowed: true, signal: sizedSignal };
  }
}

export const riskManager = new RiskManager();
