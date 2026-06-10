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
  exitReason: "take_profit" | "stop_loss" | "signal_reversal";
}

export interface BacktestConfig {
  initialCapital: number;
  tradeSizePct: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxHoldingPeriod: number;
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
  profitFactor: number;
  avgHoldingPeriod: number;
  finalCapital: number;
  trades: BacktestTrade[];
}

export interface SignalGenerator {
  (prices: number[], index: number): { direction: "up" | "down" | null; probability: number } | null;
}

export function runBacktest(
  prices: number[],
  signalGen: SignalGenerator,
  config: BacktestConfig = {
    initialCapital: 1000,
    tradeSizePct: 0.1,
    stopLossPct: 0.005,
    takeProfitPct: 0.015,
    maxHoldingPeriod: 100,
  }
): BacktestResult {
  let capital = config.initialCapital;
  let peak = capital;
  let maxDrawdown = 0;
  const trades: BacktestTrade[] = [];
  let inTrade = false;
  let trade: {
    entryIndex: number;
    entryPrice: number;
    direction: "up" | "down";
    size: number;
  } | null = null;

  for (let i = 60; i < prices.length; i++) {
    if (!inTrade) {
      const signal = signalGen(prices.slice(0, i + 1), i);
      if (signal && signal.direction && signal.probability >= 75) {
        const entryPrice = prices[i];
        const size = (capital * config.tradeSizePct) / entryPrice;
        inTrade = true;
        trade = { entryIndex: i, entryPrice, direction: signal.direction, size };
      }
    } else if (trade) {
      const currentPrice = prices[i];
      const isUp = trade.direction === "up";
      const changePct = isUp
        ? (currentPrice - trade.entryPrice) / trade.entryPrice
        : (trade.entryPrice - currentPrice) / trade.entryPrice;

      let exitPrice: number | null = null;
      let exitReason: BacktestTrade["exitReason"] | null = null;

      if (changePct >= config.takeProfitPct) {
        exitPrice = currentPrice;
        exitReason = "take_profit";
      } else if (changePct <= -config.stopLossPct) {
        exitPrice = currentPrice;
        exitReason = "stop_loss";
      } else if (i - trade.entryIndex >= config.maxHoldingPeriod) {
        exitPrice = currentPrice;
        exitReason = "signal_reversal";
      }

      if (exitPrice !== null && exitReason !== null) {
        const pnl = isUp
          ? (exitPrice - trade.entryPrice) * trade.size
          : (trade.entryPrice - exitPrice) * trade.size;
        const pnlPct = isUp
          ? (exitPrice - trade.entryPrice) / trade.entryPrice
          : (trade.entryPrice - exitPrice) / trade.entryPrice;

        capital += pnl;
        if (capital > peak) peak = capital;
        const drawdown = peak - capital;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;

        trades.push({
          entryIndex: trade.entryIndex,
          exitIndex: i,
          entryPrice: trade.entryPrice,
          exitPrice,
          direction: trade.direction,
          size: trade.size,
          pnl,
          pnlPct,
          holdingPeriod: i - trade.entryIndex,
          exitReason,
        });

        inTrade = false;
        trade = null;
      }
    }
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

  const totalProfit = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
  const totalLoss = Math.abs(trades.filter(t => t.pnl <= 0).reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : trades.length > 0 ? Infinity : 0;

  const avgHoldingPeriod = trades.length > 0
    ? trades.reduce((sum, t) => sum + t.holdingPeriod, 0) / trades.length
    : 0;

  return {
    totalTrades: trades.length,
    wins,
    losses,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    totalPnl,
    totalPnlPct,
    maxDrawdown,
    maxDrawdownPct: config.initialCapital > 0 ? (maxDrawdown / config.initialCapital) * 100 : 0,
    sharpeRatio,
    profitFactor,
    avgHoldingPeriod,
    finalCapital: capital,
    trades,
  };
}

export function simulateSignalGenerator(
  indicators: {
    rsi: number;
    macdHistogram: number;
    bollingerBandwidth: number;
    adx: number;
    trendStrength: number;
  }[],
  price: number
): SignalGenerator {
  return (prices: number[], index: number) => {
    if (index < 0 || index >= indicators.length) return null;
    const ind = indicators[index];
    if (!ind) return null;

    const isOversold = ind.rsi < 30;
    const isOverbought = ind.rsi > 70;
    const macdPositive = ind.macdHistogram > 0;
    const strongTrend = ind.adx > 25;
    const trendUp = ind.trendStrength > 0;
    const bbSqueeze = ind.bollingerBandwidth < 0.1;

    if (isOversold && macdPositive && strongTrend && trendUp) {
      return { direction: "up", probability: 85 };
    }
    if (isOverbought && !macdPositive && strongTrend && !trendUp) {
      return { direction: "down", probability: 85 };
    }
    if (isOversold && bbSqueeze) {
      return { direction: "up", probability: 75 };
    }
    if (isOverbought && bbSqueeze) {
      return { direction: "down", probability: 75 };
    }

    return null;
  };
}
