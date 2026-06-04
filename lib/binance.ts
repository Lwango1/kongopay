const BASE = "https://api.binance.com";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT"];

function formatSymbol(s: string) {
  return s.toUpperCase().replace("/", "");
}

export async function getTicker(symbol = "BTC/USDT") {
  const sym = formatSymbol(symbol);
  const res = await fetch(`${BASE}/api/v3/ticker/24hr?symbol=${sym}`);
  const t = await res.json();
  return {
    symbol: t.symbol.replace("USDT", "/USDT"),
    price: parseFloat(t.lastPrice),
    change24h: parseFloat(t.priceChangePercent),
    high24h: parseFloat(t.highPrice),
    low24h: parseFloat(t.lowPrice),
    volume24h: parseFloat(t.quoteVolume),
  };
}

export async function getAllTickers() {
  const results = await Promise.allSettled(SYMBOLS.map(async (sym) => {
    const res = await fetch(`${BASE}/api/v3/ticker/24hr?symbol=${sym}`);
    const t = await res.json();
    return {
      symbol: t.symbol.replace("USDT", "/USDT"),
      price: parseFloat(t.lastPrice),
      change24h: parseFloat(t.priceChangePercent),
      high24h: parseFloat(t.highPrice),
      low24h: parseFloat(t.lowPrice),
      volume24h: parseFloat(t.quoteVolume),
    };
  }));
  return results.filter((r) => r.status === "fulfilled").map((r: any) => r.value);
}

export async function getOrderBook(symbol = "BTC/USDT", limit = 20) {
  const sym = formatSymbol(symbol);
  const res = await fetch(`${BASE}/api/v3/depth?symbol=${sym}&limit=${limit}`);
  const data = await res.json();
  return {
    bids: data.bids.map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
    asks: data.asks.map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
  };
}

export async function getHistoricalRates(symbol = "BTC/USDT", timeframe = "1h", limit = 100) {
  const sym = formatSymbol(symbol);
  const intervals: Record<string, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h", "1d": "1d" };
  const interval = intervals[timeframe] || "1h";
  const res = await fetch(`${BASE}/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`);
  const data = await res.json();
  return data.map((c: any[]) => ({
    timestamp: c[0],
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
    volume: parseFloat(c[5]),
  }));
}
