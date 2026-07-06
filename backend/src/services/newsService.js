const CACHE_TTL = 5 * 60 * 1000;
let cache = { data: null, timestamp: 0 };

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
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

function parseInvestingJson(html) {
  const events = [];
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return events;

  try {
    const parsed = JSON.parse(match[1]);
    const calendarMap = parsed?.props?.pageProps?.state?.economicCalendarStore?.calendarEventsByDate;
    if (!calendarMap) return events;

    const currencyToCountry = {
      USD: 'US', EUR: 'EU', GBP: 'UK', JPY: 'JP',
      CHF: 'CH', CAD: 'CA', AUD: 'AU', NZD: 'NZ',
      CNY: 'CN', HKD: 'HK', SGD: 'SG', NOK: 'NO',
      SEK: 'SE', MXN: 'MX', ZAR: 'ZA', TRY: 'TR',
      RUB: 'RU', INR: 'IN', BRL: 'BR', KRW: 'KR',
    };

    Object.entries(calendarMap).forEach(([date, dayEvents]) => {
      if (!Array.isArray(dayEvents)) return;
      dayEvents.forEach(ev => {
        const impactMap = { 1: 'low', 2: 'medium', 3: 'high' };
        const impact = impactMap[ev.importance || ev.impact] || 'low';
        const currency = ev.currency || '';
        const country = currencyToCountry[currency] || currency.slice(0, 2) || 'US';

        events.push({
          id: `INV-${ev.id || ev.eventId || Math.random().toString(36).slice(2, 8)}`,
          date,
          time: ev.time || ev.startTime || '12:00',
          title: `${country} — ${ev.event || ev.name || ''}`,
          country,
          currency,
          impact,
          previous: ev.previous != null ? String(ev.previous) : '',
          forecast: ev.forecast != null ? String(ev.forecast) : '',
          actual: ev.actual != null ? String(ev.actual) : null,
          status: ev.actual != null ? 'done' : 'upcoming',
        });
      });
    });
  } catch {}

  return events;
}

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
    const surprise = actualVal - forecastVal;
    const absSurprise = Math.abs(surprise);
    if (absSurprise > 0.1) {
      direction = surprise > 0 ? 'up' : 'down';
      probability += Math.min(absSurprise * 25, 35);
    }
  } else {
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

function computeSentiment(event) {
  if (!event.actual) return { sentiment: 'neutral', confidence: 0 };

  const parsePct = (s) => parseFloat(String(s).replace('%', '').replace('+', '')) || 0;
  const actualVal = parsePct(event.actual);
  const forecastVal = parsePct(event.forecast);
  const surprise = Math.abs(actualVal - forecastVal);

  if (surprise < 0.1) return { sentiment: 'neutral', confidence: 40 };

  const beat = actualVal > forecastVal;
  if (beat && surprise > 0.3) return { sentiment: 'bullish', confidence: Math.min(surprise * 25, 95) };
  if (!beat && surprise > 0.3) return { sentiment: 'bearish', confidence: Math.min(surprise * 25, 95) };
  return { sentiment: beat ? 'bullish' : 'bearish', confidence: 50 + surprise * 15 };
}

export async function getEconomicCalendar() {
  if (cache.data && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  let events = [];
  let source = 'cache';

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
        if (events.length > 3) source = 'finnhub-api';
      }
    } catch (err) {
      console.warn('[News] Finnhub API failed:', err.message);
    }
  }

  if (events.length < 5) {
    try {
      const res = await fetchWithTimeout('https://www.investing.com/economic-calendar/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (res.ok) {
        const html = await res.text();
        events = parseInvestingJson(html);
        if (events.length > 3) source = 'investing';
      }
    } catch (err) {
      console.warn('[News] Investing.com fallback failed:', err.message);
    }
  }

  if (events.length < 5) {
    events = [];
    source = 'empty';
  }

  const { forexPrices } = await import('./forexPrices.js');

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
    const pip = (cur) => cur === 'JPY' || cur === 'XAU' ? 0.01 : 0.0001;
    const currency = pair.replace('USD', '').replace('XAU', '');
    const pipSize = pip(currency);
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
      stopLoss: +(entry - dir * slPips * pipSize).toFixed(decimals),
      takeProfit: +(entry + dir * tpPips * pipSize).toFixed(decimals),
      targets: {
        tp1: `${Math.round(0.5 * analysis.probability)} pips`,
        tp2: `${Math.round(1.0 * analysis.probability)} pips`,
        sl: `${Math.round(0.3 * analysis.probability)} pips`,
      },
    };
  }

  const signals = [];

  for (const e of events) {
    if (e.status === 'done' || e.impact === 'low') continue;
    if (signals.length >= 12) break;

    const analysis = analyzeEvent(e);
    if (!analysis.direction) continue;

    const pair = e.currency === 'USD' ? 'EURUSD' : `${e.currency}USD`;
    const basePrice = forexPrices.priceForCurrency(e.currency) || 1.08;
    const reasoning = `${e.title} — Prév: ${e.forecast} vs Préc: ${e.previous}. ${analysis.direction === 'up' ? 'Hausse' : 'Baisse'} anticipée sur ${pair}.`;

    signals.push(buildSignal(e, analysis, pair, basePrice, 'Avant publication', reasoning));

    if (e.currency === 'USD' && e.impact === 'high') {
      const goldPrice = forexPrices.getGoldPrice();
      const xauDir = analysis.direction === 'up' ? 'down' : 'up';
      const analysisXau = { ...analysis, direction: xauDir };
      const goldReasoning = `${e.title} → USD ${analysis.direction === 'up' ? 'fort' : 'faible'} → XAU/USD ${xauDir === 'up' ? 'rachat' : 'repli'} (corrélation inverse).`;
      signals.push(buildSignal(e, analysisXau, 'XAUUSD', goldPrice, 'Avant publication', goldReasoning));
    }
  }

  for (const e of events) {
    if (e.status !== 'done' || !e.actual || e.impact === 'low') continue;
    if (signals.length >= 16) break;

    const analysis = analyzeEvent(e);
    if (!analysis.direction || analysis.probability < 60) continue;

    const pair = e.currency === 'USD' ? 'EURUSD' : `${e.currency}USD`;
    const basePrice = forexPrices.priceForCurrency(e.currency) || 1.08;
    const reasoning = `${e.title} — Réel: ${e.actual} vs Prév: ${e.forecast}. Surprise ${analysis.direction === 'up' ? 'haussière' : 'baissière'}. Trading post-annonce.`;

    signals.push(buildSignal(e, analysis, pair, basePrice, 'Post-annonce (retracement)', reasoning));

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

export function getNewsStats() {
  return {
    cacheAge: cache.data ? Math.round((Date.now() - cache.timestamp) / 1000) : -1,
    cacheSource: cache.data?.source || 'none',
    eventCount: cache.data?.events?.length || 0,
    signalCount: cache.data?.signals?.length || 0,
    uptime: process.uptime(),
  };
}
