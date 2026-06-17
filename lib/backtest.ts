export interface BacktestTrade {
  entryIndex: number;
  exitIndex: number;
  entryPrice: number;
  exitPrice: number;
  direction: "up" | "down";
  size: number;
  pnl: number;
  pnlPct: number;
  holdingPeriod: number;
  exitReason: "take_profit" | "stop_loss" | "signal_reversal" | "expired";
}

export interface BacktestConfig {
  initialCapital: number;
  tradeSizePct: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxHoldingPeriod: number;
  probabilityThreshold: number;
}

export interface WalkForwardConfig {
  trainWindow: number;
  testWindow: number;
  stepSize: number;
}

export interface BacktestResult {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  totalPnlPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  profitFactor: number;
  avgHoldingPeriod: number;
  finalCapital: number;
  avgReturn: number;
  returnStdDev: number;
  maxConsecutiveLosses: number;
  expectancy: number;
  trades: BacktestTrade[];
  equityCurve: number[];
  drawdownCurve: number[];
}

export interface WalkForwardResult {
  windows: { trainStart: number; trainEnd: number; testStart: number; testEnd: number; result: BacktestResult }[];
  aggregate: BacktestResult;
  oosWinRate: number;
  oosProfitFactor: number;
  robustness: number; // ratio of profitable windows
}

export interface MonteCarloResult {
  simulations: BacktestResult[];
  percentiles: {
    p5: Partial<BacktestResult>;
    p25: Partial<BacktestResult>;
    p50: Partial<BacktestResult>;
    p75: Partial<BacktestResult>;
    p95: Partial<BacktestResult>;
  };
  probabilityOfProfit: number;
}

export interface SignalGenerator {
  (prices: number[], index: number, config?: { trainPrices?: number[] }): { direction: "up" | "down" | null; probability: number } | null;
}

const DEFAULT_CONFIG: BacktestConfig = {
  initialCapital: 1000,
  tradeSizePct: 0.1,
  stopLossPct: 0.005,
  takeProfitPct: 0.015,
  maxHoldingPeriod: 100,
  probabilityThreshold: 75,
};

export function runBacktest(
  prices: number[],
  signalGen: SignalGenerator,
  config: BacktestConfig = DEFAULT_CONFIG,
  trainPrices?: number[]
): BacktestResult {
  let capital = config.initialCapital;
  let peak = capital;
  let maxDrawdown = 0;
  const trades: BacktestTrade[] = [];
  const equityCurve: number[] = [capital];
  const drawdownCurve: number[] = [0];
  let consecutiveLosses = 0;
  let maxConsecutiveLosses = 0;
  const inTrade: {
    entryIndex: number;
    entryPrice: number;
    direction: "up" | "down";
    size: number;
  } | null = null;

  let activeTrade: typeof inTrade = null;

  for (let i = 60; i < prices.length; i++) {
    if (!activeTrade) {
      const signal = signalGen(prices.slice(0, i + 1), i, trainPrices ? { trainPrices } : undefined);
      if (signal && signal.direction && signal.probability >= config.probabilityThreshold) {
        const entryPrice = prices[i];
        const size = (capital * config.tradeSizePct) / entryPrice;
        activeTrade = { entryIndex: i, entryPrice, direction: signal.direction, size };
      }
    } else {
      const currentPrice = prices[i];
      const isUp = activeTrade.direction === "up";
      const changePct = isUp
        ? (currentPrice - activeTrade.entryPrice) / activeTrade.entryPrice
        : (activeTrade.entryPrice - currentPrice) / activeTrade.entryPrice;

      let exitPrice: number | null = null;
      let exitReason: BacktestTrade["exitReason"] | null = null;

      if (changePct >= config.takeProfitPct) {
        exitPrice = currentPrice;
        exitReason = "take_profit";
      } else if (changePct <= -config.stopLossPct) {
        exitPrice = currentPrice;
        exitReason = "stop_loss";
      } else if (i - activeTrade.entryIndex >= config.maxHoldingPeriod) {
        exitPrice = currentPrice;
        exitReason = "expired";
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
    const currentDD = peak > 0 ? (peak - capital) / peak * 100 : 0;
    drawdownCurve.push(currentDD);
  }

  const wins = trades.filter(t => t.pnl > 0).length;
  const losses = trades.filter(t => t.pnl <= 0).length;
  const totalPnl = capital - config.initialCapital;
  const totalPnlPct = (totalPnl / config.initialCapital) * 100;

  const returns = trades.map(t => t.pnlPct);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 0
    ? returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  // Sortino ratio (downside deviation only)
  const downsideReturns = returns.filter(r => r < 0);
  const downsideVariance = downsideReturns.length > 0
    ? downsideReturns.reduce((sum, r) => sum + r * r, 0) / downsideReturns.length
    : 0;
  const downsideDev = Math.sqrt(downsideVariance);
  const sortinoRatio = downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(252) : 0;

  // Calmar ratio
  const maxDDpct = config.initialCapital > 0 ? (maxDrawdown / config.initialCapital) * 100 : 0;
  const calmarRatio = maxDDpct > 0 ? totalPnlPct / maxDDpct : 0;

  const totalProfit = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
  const totalLoss = Math.abs(trades.filter(t => t.pnl <= 0).reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : trades.length > 0 ? Infinity : 0;

  const avgHoldingPeriod = trades.length > 0
    ? trades.reduce((sum, t) => sum + t.holdingPeriod, 0) / trades.length
    : 0;

  const expectancy = trades.length > 0 ? totalPnl / trades.length : 0;

  return {
    totalTrades: trades.length,
    wins,
    losses,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    totalPnl,
    totalPnlPct,
    maxDrawdown,
    maxDrawdownPct: maxDDpct,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    profitFactor,
    avgHoldingPeriod,
    finalCapital: capital,
    avgReturn,
    returnStdDev: stdDev,
    maxConsecutiveLosses,
    expectancy,
    trades,
    equityCurve,
    drawdownCurve,
  };
}

// Walk-forward validation
export function runWalkForward(
  prices: number[],
  signalGen: SignalGenerator,
  config: BacktestConfig = DEFAULT_CONFIG,
  wfConfig: WalkForwardConfig = { trainWindow: 500, testWindow: 100, stepSize: 50 }
): WalkForwardResult {
  const windows: WalkForwardResult["windows"] = [];
  let totalOosTrades = 0;
  let totalOosWins = 0;
  const oosResults: BacktestResult[] = [];

  let start = 0;
  while (start + wfConfig.trainWindow + wfConfig.testWindow < prices.length) {
    const trainStart = start;
    const trainEnd = start + wfConfig.trainWindow;
    const testStart = trainEnd;
    const testEnd = Math.min(testStart + wfConfig.testWindow, prices.length);

    const trainPrices = prices.slice(trainStart, trainEnd);
    const testPrices = prices.slice(testStart, testEnd);

    // Train on window, test on next window
    const result = runBacktrack(prices.slice(0, testEnd), signalGen, {
      ...config,
      probabilityThreshold: 70,
    }, trainPrices);

    // Filter only trades in OOS period
    const oosTrades = result.trades.filter(t => t.entryIndex >= testStart && t.entryIndex < testEnd);
    const oosWins = oosTrades.filter(t => t.pnl > 0).length;
    totalOosTrades += oosTrades.length;
    totalOosWins += oosWins;

    oosResults.push({
      ...result,
      trades: oosTrades,
      totalTrades: oosTrades.length,
      wins: oosWins,
      losses: oosTrades.length - oosWins,
      winRate: oosTrades.length > 0 ? (oosWins / oosTrades.length) * 100 : 0,
    });

    windows.push({
      trainStart, trainEnd, testStart, testEnd,
      result: oosResults[oosResults.length - 1],
    });

    start += wfConfig.stepSize;
  }

  const profitableWindows = windows.filter(w => w.result.totalPnl > 0).length;
  const totalPnl = oosResults.reduce((s, r) => s + r.totalPnl, 0);
  const totalTrades = oosResults.reduce((s, r) => s + r.totalTrades, 0);

  const aggregate: BacktestResult = {
    totalTrades,
    wins: totalOosWins,
    losses: totalOosTrades - totalOosWins,
    winRate: totalOosTrades > 0 ? (totalOosWins / totalOosTrades) * 100 : 0,
    totalPnl,
    totalPnlPct: 0,
    maxDrawdown: Math.max(...oosResults.map(r => r.maxDrawdown)),
    maxDrawdownPct: Math.max(...oosResults.map(r => r.maxDrawdownPct)),
    sharpeRatio: oosResults.reduce((s, r) => s + r.sharpeRatio, 0) / Math.max(oosResults.length, 1),
    sortinoRatio: oosResults.reduce((s, r) => s + r.sortinoRatio, 0) / Math.max(oosResults.length, 1),
    calmarRatio: 0,
    profitFactor: 0,
    avgHoldingPeriod: 0,
    finalCapital: 0,
    avgReturn: 0,
    returnStdDev: 0,
    maxConsecutiveLosses: Math.max(...oosResults.map(r => r.maxConsecutiveLosses)),
    expectancy: totalTrades > 0 ? totalPnl / totalTrades : 0,
    trades: [],
    equityCurve: [],
    drawdownCurve: [],
  };

  return {
    windows,
    aggregate,
    oosWinRate: totalOosTrades > 0 ? (totalOosWins / totalOosTrades) * 100 : 0,
    oosProfitFactor: 0,
    robustness: windows.length > 0 ? (profitableWindows / windows.length) * 100 : 0,
  };
}

// Monte Carlo simulation
export function runMonteCarlo(
  trades: BacktestTrade[],
  numSimulations: number = 1000,
  initialCapital: number = 1000
): MonteCarloResult {
  const simulations: BacktestResult[] = [];

  for (let sim = 0; sim < numSimulations; sim++) {
    let capital = initialCapital;
    let peak = capital;
    let maxDrawdown = 0;

    for (let i = 0; i < trades.length; i++) {
      // Random resampling with replacement
      const randomTrade = trades[Math.floor(Math.random() * trades.length)];
      capital += randomTrade.pnl;
      if (capital > peak) peak = capital;
      const drawdown = peak - capital;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    const totalPnl = capital - initialCapital;
    simulations.push({
      totalTrades: trades.length,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalPnl,
      totalPnlPct: (totalPnl / initialCapital) * 100,
      maxDrawdown,
      maxDrawdownPct: (maxDrawdown / initialCapital) * 100,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      profitFactor: 0,
      avgHoldingPeriod: 0,
      finalCapital: capital,
      avgReturn: 0,
      returnStdDev: 0,
      maxConsecutiveLosses: 0,
      expectancy: 0,
      trades: [],
      equityCurve: [],
      drawdownCurve: [],
    });
  }

  const sortedPnl = simulations.map(s => s.totalPnl).sort((a, b) => a - b);
  const profitableSims = simulations.filter(s => s.totalPnl > 0).length;

  const percentile = (arr: number[], p: number) => {
    const idx = Math.floor(arr.length * p / 100);
    return arr[Math.min(idx, arr.length - 1)];
  };

  const makePartial = (pnl: number): Partial<BacktestResult> => ({
    totalPnl: pnl,
    totalPnlPct: (pnl / initialCapital) * 100,
  });

  return {
    simulations,
    percentiles: {
      p5: makePartial(percentile(sortedPnl, 5)),
      p25: makePartial(percentile(sortedPnl, 25)),
      p50: makePartial(percentile(sortedPnl, 50)),
      p75: makePartial(percentile(sortedPnl, 75)),
      p95: makePartial(percentile(sortedPnl, 95)),
    },
    probabilityOfProfit: (profitableSims / numSimulations) * 100,
  };
}

// Wrapper that tracks which part is in-sample vs out-of-sample
function runBacktrack(
  prices: number[],
  signalGen: SignalGenerator,
  config: BacktestConfig,
  trainPrices?: number[]
): BacktestResult {
  return runBacktest(prices, signalGen, config, trainPrices);
}
