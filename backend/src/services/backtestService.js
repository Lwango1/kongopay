// Backtesting & Walk-Forward Validation Service
import { db } from '../config/firebase.js';

function runBacktest(prices, signals, config = {}) {
  const {
    initialCapital = 1000,
    tradeSizePct = 0.1,
    stopLossPct = 0.005,
    takeProfitPct = 0.015,
    maxHoldingPeriod = 100,
    probabilityThreshold = 75,
  } = config;

  let capital = initialCapital;
  let peak = capital;
  let maxDrawdown = 0;
  const trades = [];
  const equityCurve = [capital];
  let consecutiveLosses = 0;
  let maxConsecutiveLosses = 0;
  let activeTrade = null;

  // Build a price lookup from signals
  const priceMap = new Map();
  for (const s of signals) {
    if (s.entryPrice != null) {
      priceMap.set(s.createdAt, s.entryPrice);
    }
  }

  for (let i = 0; i < signals.length; i++) {
    const sig = signals[i];
    if (!sig || sig.spikeProbability < probabilityThreshold) continue;

    if (!activeTrade && sig.expectedDirection && sig.spikeProbability >= probabilityThreshold) {
      const entryPrice = sig.entryPrice || sig.currentPrice;
      const size = (capital * tradeSizePct) / entryPrice;
      activeTrade = {
        entryIndex: i,
        entryPrice,
        direction: sig.expectedDirection,
        size,
        entryTime: sig.createdAt || new Date().toISOString(),
      };
    }

    if (activeTrade) {
      const currentPrice = sig.currentPrice || sig.entryPrice;
      if (!currentPrice) continue;

      const isUp = activeTrade.direction === 'up';
      const changePct = isUp
        ? (currentPrice - activeTrade.entryPrice) / activeTrade.entryPrice
        : (activeTrade.entryPrice - currentPrice) / activeTrade.entryPrice;

      let exitPrice = null;
      let exitReason = null;

      if (changePct >= takeProfitPct) {
        exitPrice = currentPrice;
        exitReason = 'take_profit';
      } else if (changePct <= -stopLossPct) {
        exitPrice = currentPrice;
        exitReason = 'stop_loss';
      } else if (i - activeTrade.entryIndex >= maxHoldingPeriod) {
        exitPrice = currentPrice;
        exitReason = 'expired';
      }

      if (exitPrice !== null && exitReason !== null) {
        const pnl = isUp
          ? (exitPrice - activeTrade.entryPrice) * activeTrade.size
          : (activeTrade.entryPrice - exitPrice) * activeTrade.size;
        const pnlPct = isUp
          ? (exitPrice - activeTrade.entryPrice) / activeTrade.entryPrice
          : (activeTrade.entryPrice - exitPrice) / activeTrade.entryPrice;

        capital += pnl;
        if (pnl <= 0) {
          consecutiveLosses++;
          if (consecutiveLosses > maxConsecutiveLosses) maxConsecutiveLosses = consecutiveLosses;
        } else {
          consecutiveLosses = 0;
        }

        if (capital > peak) peak = capital;
        const drawdown = peak - capital;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;

        trades.push({
          entryIndex: activeTrade.entryIndex,
          exitIndex: i,
          entryPrice: activeTrade.entryPrice,
          exitPrice,
          direction: activeTrade.direction,
          size: activeTrade.size,
          pnl,
          pnlPct,
          holdingPeriod: i - activeTrade.entryIndex,
          exitReason,
        });

        activeTrade = null;
      }
    }
    equityCurve.push(capital);
  }

  const wins = trades.filter(t => t.pnl > 0).length;
  const losses = trades.filter(t => t.pnl <= 0).length;
  const totalPnl = capital - initialCapital;

  const returns = trades.map(t => t.pnlPct);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 0
    ? returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  const totalProfit = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
  const totalLoss = Math.abs(trades.filter(t => t.pnl <= 0).reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : trades.length > 0 ? Infinity : 0;

  const maxDDpct = initialCapital > 0 ? (maxDrawdown / initialCapital) * 100 : 0;

  return {
    totalTrades: trades.length,
    wins,
    losses,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    totalPnl,
    totalPnlPct: (totalPnl / initialCapital) * 100,
    maxDrawdown,
    maxDrawdownPct: maxDDpct,
    sharpeRatio,
    profitFactor,
    maxConsecutiveLosses,
    expectancy: trades.length > 0 ? totalPnl / trades.length : 0,
    trades,
  };
}

// Walk-forward validation on signal history
export async function runWalkForwardValidation(signals, config = {}) {
  const results = [];
  const windowSize = Math.min(Math.floor(signals.length * 0.7), 200);
  const testSize = Math.floor(windowSize * 0.3);
  const stepSize = Math.floor(testSize / 2);

  let start = 0;
  while (start + windowSize + testSize < signals.length) {
    const trainEnd = start + windowSize;
    const testEnd = Math.min(trainEnd + testSize, signals.length);

    const trainSignals = signals.slice(start, trainEnd);
    const testSignals = signals.slice(trainEnd, testEnd);

    // Train config (in a real scenario, optimize params here)
    const trainResult = runBacktest(trainSignals, trainSignals, config);
    const testResult = runBacktest(testSignals, testSignals, config);

    results.push({
      window: { trainStart: start, trainEnd, testStart: trainEnd, testEnd: testEnd },
      train: trainResult,
      test: testResult,
    });

    start += stepSize;
  }

  const oosTrades = results.reduce((s, r) => s + r.test.totalTrades, 0);
  const oosWins = results.reduce((s, r) => s + r.test.wins, 0);
  const oosPnl = results.reduce((s, r) => s + r.test.totalPnl, 0);
  const profitableWindows = results.filter(r => r.test.totalPnl > 0).length;

  return {
    windows: results,
    aggregate: {
      totalTrades: oosTrades,
      winRate: oosTrades > 0 ? (oosWins / oosTrades) * 100 : 0,
      totalPnl: oosPnl,
      avgPnlPerWindow: results.length > 0 ? oosPnl / results.length : 0,
    },
    robustness: results.length > 0 ? (profitableWindows / results.length) * 100 : 0,
    oosWinRate: oosTrades > 0 ? (oosWins / oosTrades) * 100 : 0,
  };
}

// Monte Carlo simulation on historical trades
export function runMonteCarlo(historicalTrades, numSimulations = 1000, initialCapital = 1000) {
  const results = [];
  let profitableSims = 0;

  for (let sim = 0; sim < numSimulations; sim++) {
    let capital = initialCapital;
    let peak = capital;
    let maxDrawdown = 0;

    for (let i = 0; i < historicalTrades.length; i++) {
      const randomTrade = historicalTrades[Math.floor(Math.random() * historicalTrades.length)];
      capital += randomTrade.pnl;
      if (capital > peak) peak = capital;
      const drawdown = peak - capital;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    const totalPnl = capital - initialCapital;
    if (totalPnl > 0) profitableSims++;
    results.push({ finalCapital: capital, totalPnl, maxDrawdown });
  }

  const sortedPnl = results.map(r => r.totalPnl).sort((a, b) => a - b);
  const p = (arr, pc) => arr[Math.min(Math.floor(arr.length * pc / 100), arr.length - 1)];

  return {
    probabilityOfProfit: (profitableSims / numSimulations) * 100,
    expectedReturn: results.reduce((s, r) => s + r.totalPnl, 0) / results.length,
    percentiles: {
      p5: p(sortedPnl, 5),
      p25: p(sortedPnl, 25),
      p50: p(sortedPnl, 50),
      p75: p(sortedPnl, 75),
      p95: p(sortedPnl, 95),
    },
  };
}

// Backtest from Firestore signal history
export async function backtestFromHistory(config = {}) {
  const snapshot = await db.collection('signals')
    .orderBy('createdAt', 'asc')
    .get();

  const signals = [];
  for (const doc of snapshot.docs) {
    signals.push(doc.data());
  }

  if (signals.length < 20) {
    return { error: 'Pas assez de signaux pour le backtest' };
  }

  const btResult = runBacktest(signals, signals, config);
  const wfResult = await runWalkForwardValidation(signals, config);
  const mcResult = runMonteCarlo(btResult.trades, 1000, config.initialCapital || 1000);

  return {
    backtest: btResult,
    walkForward: wfResult,
    monteCarlo: mcResult,
    timestamp: new Date().toISOString(),
  };
}
