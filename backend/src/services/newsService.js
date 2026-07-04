// Service de news économiques en temps réel
// Sources: Finnhub API, investing.com HTML, forexfactory HTML

import fetch from 'node-fetch';

const CACHE_TTL = 5 * 60 * 1000; // 5 min
let cache = { data: null, timestamp: 0 };

// Sources de données gratuites
const SOURCES = [
  {
    name: 'investing-html',
    url: 'https://www.investing.com/economic-calendar/',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  },
  {
    name: 'forexfactory',
    url: 'https://www.forexfactory.com/calendar',
    headers: { 'User-Agent': 'Mozilla/5.0' },
  },
];

async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Parse investing.com HTML response for economic events
function parseInvestingHtml(html) {
  const events = [];
  // Extract JSON data embedded in the page
  const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/);
  if (jsonMatch) {
    try {
      const state = JSON.parse(jsonMatch[1]);
      const calendar = state?.calendar?.events || [];
      for (const ev of calendar) {
        events.push({
          id: `INV-${ev.id || ev.event_id}`,
          date: ev.date?.split(' ')[0] || '',
          time: ev.time || '12:00',
          title: `${ev.country || ''} — ${ev.event || ''}`,
          country: ev.country_code || ev.country,
          currency: ev.currency || '',
          impact: ev.impact?.toLowerCase?.() === '3' ? 'high' : ev.impact === '2' ? 'medium' : 'low',
          previous: ev.previous || '',
          forecast: ev.forecast || '',
          actual: ev.actual || null,
        });
      }
    } catch {}
  }

  // Fallback: parse table rows
  if (events.length === 0) {
    const rows = html.match(/<tr[^>]*class="[^"]*calendar_row[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    for (const row of rows.slice(0, 30)) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      if (cells.length >= 6) {
        const extract = (idx) => cells[idx]?.replace(/<[^>]*>/g, '').trim() || '';
        const timeMatch = extract(0).match(/(\d{2}:\d{2})/);
        events.push({
          id: `FX-${Math.random().toString(36).slice(2, 8)}`,
          date: '',
          time: timeMatch?.[1] || '12:00',
          title: extract(2) || extract(1),
          country: extract(1)?.slice(0, 2) || '',
          currency: '',
          impact: extract(3)?.toLowerCase().includes('red') ? 'high' : extract(3)?.toLowerCase().includes('orange') ? 'medium' : 'low',
          previous: extract(4),
          forecast: extract(5),
          actual: null,
        });
      }
    }
  }

  return events;
}

// Parse forexfactory.com HTML (structure totalement différente d'investing.com)
function parseForexFactoryHtml(html) {
  const events = [];
  let currentDate = '';

  // Find all calendar rows (not headers, not day-breakers)
  const rowRegex = /<tr[^>]*class="[^"]*calendar__row[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1];

    // Day breaker: extract date
    const dayMatch = rowMatch[0].match(/data-date="([^"]+)"/);
    if (dayMatch) {
      currentDate = dayMatch[1];
      continue;
    }

    // Skip header rows
    if (row.includes('day-headers') || rowMatch[0].includes('day-headers')) continue;

    // Extract cells
    const cells = [];
    const cellRegex = /<td[^>]*class="[^"]*calendar__cell[^"]*"[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1]);
    }

    if (cells.length < 4) continue;

    const extract = (idx) => cells[idx]?.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '').trim() || '';

    // Time
    const timeSpan = cells[0]?.match(/<span[^>]*>([\s\S]*?)<\/span>/);
    const time = timeSpan ? timeSpan[1].trim() : extract(0);

    // Currency
    const currency = extract(1);

    // Impact: look for impact--high, impact--medium, impact--low classes
    let impact = 'low';
    if (cells[2]?.includes('impact--high')) impact = 'high';
    else if (cells[2]?.includes('impact--medium')) impact = 'medium';

    // Event title
    const titleSpan = cells[3]?.match(/<span[^>]*class="[^"]*calendar__event-title[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    const eventTitle = titleSpan ? titleSpan[1].replace(/<[^>]*>/g, '').trim() : extract(3);

    // Previous / Forecast / Actual (may be in different order)
    const prev = extract(4);
    const fore = extract(5);
    const act = extract(6);

    // Determine country from currency
    const currencyToCountry = {
      'USD': 'US', 'EUR': 'EU', 'GBP': 'UK', 'JPY': 'JP',
      'CHF': 'CH', 'CAD': 'CA', 'AUD': 'AU', 'NZD': 'NZ',
      'CNY': 'CN', 'HKD': 'HK', 'SGD': 'SG', 'NOK': 'NO',
      'SEK': 'SE', 'MXN': 'MX', 'ZAR': 'ZA', 'TRY': 'TR',
      'RUB': 'RU', 'INR': 'IN', 'BRL': 'BR', 'KRW': 'KR',
    };

    if (!time.match(/\d{2}:\d{2}/)) continue;

    events.push({
      id: `FX-${currentDate}-${eventTitle.slice(0, 10).replace(/\s/g, '-')}`,
      date: currentDate,
      time,
      title: `${currencyToCountry[currency] || currency} — ${eventTitle}`,
      country: currencyToCountry[currency] || currency.slice(0, 2),
      currency,
      impact,
      previous: prev,
      forecast: fore,
      actual: act || null,
      status: act ? 'done' : 'upcoming',
    });
  }

  return events;
}

// Analyse d'impact pour un événement
function analyzeEvent(event) {
  const parsePct = (s) => parseFloat(String(s).replace('%', '').replace('+', '')) || 0;
  const prevVal = parsePct(event.previous);
  const forecastVal = parsePct(event.forecast);
  const actualVal = event.actual != null ? parsePct(event.actual) : null;

  const impactScores = { high: 3, medium: 2, low: 1 };
  const baseScore = impactScores[event.impact] || 1;

  let direction = null;
  let probability = 50 + baseScore * 8;

  if (event.status === 'done' && actualVal !== null) {
    // Post-annonce: comparer Actual vs Forecast (le marché réagit à la surprise)
    const surprise = actualVal - forecastVal;
    const absSurprise = Math.abs(surprise);
    if (absSurprise > 0.1) {
      direction = surprise > 0 ? 'up' : 'down';
      probability += Math.min(absSurprise * 25, 35);
    }
  } else {
    // Pré-annonce: comparer Previous vs Forecast
    const forecastDiff = forecastVal - prevVal;
    const absDiff = Math.abs(forecastDiff);
    if (absDiff > 0.3) {
      direction = forecastDiff > 0 ? 'up' : 'down';
      probability += Math.min(absDiff * 5, 15);
    }
  }

  if (event.impact === 'high') probability += 10;
  probability = Math.min(Math.max(probability, 30), 95);

  return {
    direction,
    probability: Math.round(probability),
    impact: event.impact,
  };
}

// Sentiment post-annonce (Actual vs Forecast)
function computeSentiment(event) {
  if (!event.actual) return { sentiment: 'neutral', confidence: 0 };

  const parsePct = (s) => parseFloat(String(s).replace('%', '').replace('+', '')) || 0;
  const actualVal = parsePct(event.actual);
  const forecastVal = parsePct(event.forecast);
  const prevVal = parsePct(event.previous);

  const beat = actualVal > forecastVal;
  const miss = actualVal < forecastVal;
  const surprise = Math.abs(actualVal - forecastVal);

  if (beat && surprise > 0.3) return { sentiment: 'bullish', confidence: Math.min(surprise * 25, 95) };
  if (miss && surprise > 0.3) return { sentiment: 'bearish', confidence: Math.min(surprise * 25, 95) };
  if (surprise < 0.1) return { sentiment: 'neutral', confidence: 40 };

  return { sentiment: beat ? 'bullish' : 'bearish', confidence: 50 + surprise * 15 };
}

// Récupération principale
export async function getEconomicCalendar() {
  // Check cache
  if (cache.data && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  let events = [];
  let source = 'cache';

  // 1. Try Finnhub API (free tier: 60 calls/min, no credit card)
  //    Inscription: https://finnhub.io/register → API Key gratuite
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) {
    try {
      const finnhubRes = await fetch(
        `https://finnhub.io/api/v1/calendar/economic?token=${finnhubKey}`
      );
      if (finnhubRes.ok) {
        const json = await finnhubRes.json();
        const calendar = json.economicCalendar || [];
        events = calendar
          .filter(e => e.event)
          .map(e => ({
            id: `FH-${e.event?.slice(0, 20).replace(/\s/g, '-')}-${Math.random().toString(36).slice(2, 6)}`,
            date: e.time?.split(' ')[0] || new Date().toISOString().split('T')[0],
            time: e.time?.split(' ')[1]?.slice(0, 5) || '12:00',
            title: `${e.country || ''} — ${e.event}`,
            country: e.country || '',
            currency: e.currency || '',
            impact: e.impact === 'high' || e.impact === 'medium' || e.impact === 'low' ? e.impact : 'medium',
            previous: e.prev != null ? String(e.prev) : '',
            forecast: e.estimate != null ? String(e.estimate) : '',
            actual: e.actual != null ? String(e.actual) : null,
            status: e.actual != null ? 'done' : 'upcoming',
          }));
        if (events.length > 3) {
          source = 'finnhub-api';
        }
      }
    } catch (err) {
      console.warn('[News] Finnhub API failed:', err.message);
    }
  }

  // 2. Try HTML scraping (fallback)
  if (!finnhubKey || events.length < 5) {
    for (const src of SOURCES) {
      try {
        const res = await fetchWithTimeout(src.url, { headers: src.headers });
        if (res.ok) {
          const html = await res.text();
          if (src.name === 'forexfactory') {
            events = parseForexFactoryHtml(html);
          } else {
            events = parseInvestingHtml(html);
          }
          if (events.length > 5) {
            source = src.name;
            break;
          }
        }
      } catch {
        // Source failed, try next
      }
    }
  }

  // 3. No fallback — return empty if all real sources failed
  if (events.length < 5) {
    events = [];
    source = 'empty';
  }

  // Prix réels depuis Deriv
  const { forexPrices } = await import('./forexPrices.js');
  const pipSize = (cur) => cur === 'JPY' || cur === 'XAU' ? 0.01 : 0.0001;

  // Compute sentiment for all done events
  for (const ev of events) {
    if (ev.status === 'done' && ev.actual) {
      const result = computeSentiment(ev);
      ev.sentiment = result.sentiment;
      ev.confidence = result.confidence;
    } else {
      ev.sentiment = null;
      ev.confidence = 0;
    }
  }

  function buildSignal(e, analysis, pair, basePrice, window, reasoning) {
    const pip = pipSize(pair.replace('USD', ''));
    const slPips = e.status === 'done' ? (e.impact === 'high' ? 30 : 20) : (e.impact === 'high' ? 40 : 25);
    const tpPips = Math.round(slPips * (1.5 + analysis.probability / 200));
    const dir = analysis.direction === 'up' ? 1 : -1;
    const side = analysis.direction === 'up' ? 'buy' : 'sell';
    const entry = basePrice;
    const decimals = pair === 'XAUUSD' ? 2 : e.currency === 'JPY' ? 2 : 5;

    return {
      event: e,
      direction: analysis.direction,
      side,
      probability: analysis.probability,
      reasoning,
      entryWindow: window,
      pair,
      entry,
      stopLoss: +(entry - dir * slPips * pip).toFixed(decimals),
      takeProfit: +(entry + dir * tpPips * pip).toFixed(decimals),
      targets: {
        tp1: `${Math.round(0.5 * analysis.probability)} pips`,
        tp2: `${Math.round(1.0 * analysis.probability)} pips`,
        sl: `${Math.round(0.3 * analysis.probability)} pips`,
      },
    };
  }

  const signals = [];

  // 1. Upcoming events (pré-annonce)
  for (const e of events) {
    if (e.status === 'done' || e.impact === 'low') continue;
    if (signals.length >= 12) break;

    const analysis = analyzeEvent(e);
    if (!analysis.direction) continue;

    const pair = e.currency === 'USD' ? 'EURUSD' : `${e.currency}USD`;
    const basePrice = forexPrices.priceForCurrency(e.currency) || 1.08;
    const reasoning = `${e.title} — Prév: ${e.forecast} vs Préc: ${e.previous}. ${analysis.direction === 'up' ? 'Hausse' : 'Baisse'} anticipée sur ${pair}.`;

    signals.push(buildSignal(e, analysis, pair, basePrice, 'Avant publication', reasoning));

    // XAUUSD pour les USD events haut impact
    if (e.currency === 'USD' && e.impact === 'high') {
      const goldPrice = forexPrices.getGoldPrice();
      const xauDir = analysis.direction === 'up' ? 'down' : 'up';
      const analysisXau = { ...analysis, direction: xauDir };
      const goldReasoning = `${e.title} → USD ${analysis.direction === 'up' ? 'fort' : 'faible'} → XAU/USD ${xauDir === 'up' ? 'rachat' : 'repli'} (corrélation inverse).`;

      signals.push(buildSignal(e, analysisXau, 'XAUUSD', goldPrice, 'Avant publication', goldReasoning));
    }
  }

  // 2. Done events avec surprise significative (post-annonce)
  for (const e of events) {
    if (e.status !== 'done' || !e.actual || e.impact === 'low') continue;
    if (signals.length >= 16) break;

    const analysis = analyzeEvent(e);
    if (!analysis.direction || analysis.probability < 60) continue;

    const pair = e.currency === 'USD' ? 'EURUSD' : `${e.currency}USD`;
    const basePrice = forexPrices.priceForCurrency(e.currency) || 1.08;
    const reasoning = `${e.title} — Réel: ${e.actual} vs Prév: ${e.forecast}. Surprise ${analysis.direction === 'up' ? 'haussière' : 'baissière'}. Trading post-annonce.`;

    signals.push(buildSignal(e, analysis, pair, basePrice, 'Post-annonce (retracement)', reasoning));

    // XAUUSD post-annonce
    if (e.currency === 'USD' && e.impact === 'high') {
      const goldPrice = forexPrices.getGoldPrice();
      const xauDir = analysis.direction === 'up' ? 'down' : 'up';
      const analysisXau = { ...analysis, direction: xauDir };
      const goldReasoning = `${e.title} → USD ${e.sentiment === 'bullish' ? 'fort' : 'faible'} → XAU/USD ${xauDir === 'up' ? 'rachat' : 'repli'} post-annonce.`;

      signals.push(buildSignal(e, analysisXau, 'XAUUSD', goldPrice, 'Post-annonce (retracement)', goldReasoning));
    }
  }

  const result = {
    events,
    signals,
    marketContext: { trend: 'ranging', volatility: 'medium' },
    source,
    timestamp: Date.now(),
    nextUpdate: Date.now() + CACHE_TTL,
  };

  cache = { data: result, timestamp: Date.now() };
  return result;
}

// Stats
export function getNewsStats() {
  return {
    cacheAge: cache.data ? Math.round((Date.now() - cache.timestamp) / 1000) : -1,
    cacheSource: cache.data?.source || 'none',
    eventCount: cache.data?.events?.length || 0,
    signalCount: cache.data?.signals?.length || 0,
    uptime: process.uptime(),
  };
}
