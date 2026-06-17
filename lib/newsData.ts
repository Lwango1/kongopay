// === Module de trading d'annonces économiques ===

export interface EconomicEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  country: string;
  currency: string;
  impact: "high" | "medium" | "low";
  previous: string;
  forecast: string;
  actual: string | null;
  status: "upcoming" | "live" | "done";
  sentiment: "bullish" | "bearish" | "neutral" | null;
  confidence: number;
}

export interface NewsSignal {
  event: EconomicEvent;
  direction: "up" | "down" | null;
  probability: number;
  reasoning: string;
  entryWindow: string;
  pair: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  targets: { tp1: string; tp2: string; sl: string };
}

const COUNTRIES = [
  { code: "US", name: "États-Unis", currency: "USD" },
  { code: "EU", name: "Zone Euro", currency: "EUR" },
  { code: "UK", name: "Royaume-Uni", currency: "GBP" },
  { code: "JP", name: "Japon", currency: "JPY" },
  { code: "CH", name: "Suisse", currency: "CHF" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "AU", name: "Australie", currency: "AUD" },
  { code: "NZ", name: "Nouvelle-Zélande", currency: "NZD" },
];

const EVENTS_TEMPLATES = [
  { title: "Décision taux d'intérêt", impact: "high" as const },
  { title: "IPC (Inflation) mensuel", impact: "high" as const },
  { title: "PIB trimestriel", impact: "high" as const },
  { title: "Ventes au détail", impact: "medium" as const },
  { title: "Taux de chômage", impact: "high" as const },
  { title: "Indice PMI manufacturier", impact: "medium" as const },
  { title: "Demandes d'allocations chômage", impact: "medium" as const },
  { title: "Production industrielle", impact: "medium" as const },
  { title: "Confiance des consommateurs", impact: "low" as const },
  { title: "Balance commerciale", impact: "medium" as const },
];

function randomBetween(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function generateMockEvents(): EconomicEvent[] {
  const events: EconomicEvent[] = [];
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Generate events for today and next 3 days
  for (let day = 0; day < 4; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split("T")[0];
    const numEvents = day === 0 ? 4 + Math.floor(Math.random() * 4) : 3 + Math.floor(Math.random() * 5);

    for (let i = 0; i < numEvents; i++) {
      const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
      const template = EVENTS_TEMPLATES[Math.floor(Math.random() * EVENTS_TEMPLATES.length)];
      const hour = 7 + Math.floor(Math.random() * 11);
      const minute = Math.random() > 0.5 ? 0 : 30;
      const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

      const prevVal = randomBetween(-2, 5);
      const forecastVal = prevVal + randomBetween(-0.5, 0.5);
      const isUpcoming = day > 0 || (day === 0 && `${hour}:${minute}` > `${now.getHours()}:${now.getMinutes()}`);

      events.push({
        id: `ECON-${dateStr.replace(/-/g, "")}-${i}`,
        date: dateStr,
        time: timeStr,
        title: `${country.name} — ${template.title}`,
        country: country.code,
        currency: country.currency,
        impact: template.impact,
        previous: `${prevVal > 0 ? "+" : ""}${prevVal.toFixed(1)}%`,
        forecast: `${forecastVal > 0 ? "+" : ""}${forecastVal.toFixed(1)}%`,
        actual: isUpcoming ? null : `${(forecastVal + randomBetween(-0.8, 0.8)).toFixed(1)}%`,
        status: isUpcoming ? "upcoming" : "done",
        sentiment: null,
        confidence: 0,
      });
    }
  }

  // Sort by date then time
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  return events;
}

// Prix de référence pour les paires USD (mock, sera remplacé par les prix Deriv)
const PAIR_PRICES: Record<string, number> = {
  USD: 1,
  EUR: 1.0835,
  GBP: 1.2710,
  JPY: 150.25,
  CHF: 0.8820,
  CAD: 1.3620,
  AUD: 0.6560,
  NZD: 0.6050,
  CNH: 7.2450,
};

// Taille d'un pip en fonction de la paire
function pipSize(currency: string): number {
  if (currency === 'JPY') return 0.01;
  if (currency === 'USD' || currency === 'CAD') return 0.0001;
  return 0.0001;
}

// Calcul des TP/SL en prix réel
function levelsFromDirection(
  basePrice: number,
  direction: "up" | "down" | null,
  probability: number,
  pair: string,
  impact: string
): { entry: number; stopLoss: number; takeProfit: number } {
  if (!direction) return { entry: basePrice, stopLoss: basePrice, takeProfit: basePrice };

  const pip = pipSize(pair);
  // Pips ajustés selon l'impact et la probabilité
  const slPips = impact === 'high' ? 40 : impact === 'medium' ? 25 : 15;
  const tpPips = Math.round(slPips * (1.5 + probability / 200));

  const directionMult = direction === "up" ? 1 : -1;
  return {
    entry: basePrice,
    stopLoss: +(basePrice - directionMult * slPips * pip).toFixed(pair === 'JPY' ? 2 : 5),
    takeProfit: +(basePrice + directionMult * tpPips * pip).toFixed(pair === 'JPY' ? 2 : 5),
  };
}

// Détermine la paire à trader selon la devise de l'événement
function getPair(currency: string): string {
  if (currency === 'USD') return 'EURUSD'; // sur news US, on trade EUR/USD
  return `${currency}USD`; // ex: GBPUSD, AUDUSD, NZDUSD
}

// Analyse d'impact et génération de signal
function analyzeEvent(event: EconomicEvent, marketContext: { trend: string; volatility: string }): NewsSignal {
  const impactScores: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const baseScore = impactScores[event.impact];

  const parsePct = (s: string) => parseFloat(s.replace("%", "").replace("+", "")) || 0;
  const prevVal = parsePct(event.previous);
  const forecastVal = parsePct(event.forecast);

  const forecastDiff = forecastVal - prevVal;
  let direction: "up" | "down" | null = null;
  let probability = 50 + baseScore * 8;

  if (Math.abs(forecastDiff) > 0.3) {
    direction = forecastDiff > 0 ? "up" : "down";
    probability += Math.min(Math.abs(forecastDiff) * 5, 15);
  }

  if (marketContext.volatility === "high") probability += 5;
  if (marketContext.trend === "trending_bull") probability += 3;

  if (event.impact === "high") probability += 10;
  if (event.impact === "low") probability -= 5;

  probability = Math.min(Math.max(probability, 30), 92);
  const directionText = direction === "up" ? "Hausse" : direction === "down" ? "Baisse" : "Neutre";

  const [h] = event.time.split(":").map(Number);
  const entryWindow = h < 12 ? "Avant l'ouverture européenne" : h < 15 ? "Session Londres" : "Session New York";

  const pair = getPair(event.currency);
  const basePrice = PAIR_PRICES[event.currency] || PAIR_PRICES.USD;
  const { entry, stopLoss, takeProfit } = levelsFromDirection(basePrice, direction, probability, pair, event.impact);

  const reasoning = `${event.title} — Prévision: ${event.forecast} vs Précédent: ${event.previous}. ` +
    `Direction anticipée: ${directionText} sur ${pair}. Impact: ${event.impact === "high" ? "Fort, attendre 5 min après la publication" : "Modéré, scalping 15 min"}.`;

  return {
    event,
    direction,
    probability: Math.round(probability),
    reasoning,
    entryWindow,
    pair,
    entry,
    stopLoss,
    takeProfit,
    targets: {
      tp1: `${Math.round((direction === "up" ? 1 : -1) * 0.5 * probability)} pips`,
      tp2: `${Math.round((direction === "up" ? 1 : -1) * 1.0 * probability)} pips`,
      sl: `${Math.round((direction === "up" ? -1 : 1) * 0.3 * probability)} pips`,
    },
  };
}

// Analyse du sentiment après publication
function computeSentiment(event: EconomicEvent): { sentiment: "bullish" | "bearish" | "neutral"; confidence: number } {
  if (!event.actual) return { sentiment: "neutral", confidence: 0 };

  const parsePct = (s: string) => parseFloat(s.replace("%", "").replace("+", "")) || 0;
  const actualVal = parsePct(event.actual);
  const forecastVal = parsePct(event.forecast);
  const prevVal = parsePct(event.previous);

  const beat = actualVal > forecastVal;
  const miss = actualVal < forecastVal;
  const surprise = Math.abs(actualVal - forecastVal);

  if (beat && surprise > 0.3) return { sentiment: "bullish", confidence: Math.min(surprise * 25, 95) };
  if (miss && surprise > 0.3) return { sentiment: "bearish", confidence: Math.min(surprise * 25, 95) };
  if (surprise < 0.1) return { sentiment: "neutral", confidence: 40 };

  return { sentiment: beat ? "bullish" : "bearish", confidence: 50 + surprise * 15 };
}

// Main export
export function getNewsData(): {
  events: EconomicEvent[];
  signals: NewsSignal[];
  marketContext: { trend: string; volatility: string };
} {
  const events = generateMockEvents();
  const marketContext = { trend: "ranging", volatility: "medium" };

  const signals = events
    .filter(e => e.status === "upcoming" && e.impact !== "low")
    .slice(0, 8)
    .map(e => analyzeEvent(e, marketContext));

  // Compute sentiment for completed events
  for (const event of events) {
    if (event.status === "done" && event.actual) {
      const result = computeSentiment(event);
      event.sentiment = result.sentiment;
      event.confidence = result.confidence;
    }
  }

  return { events, signals, marketContext };
}

export function getNewsSignalById(id: string): NewsSignal | null {
  const { signals } = getNewsData();
  return signals.find(s => s.event.id === id) || null;
}
