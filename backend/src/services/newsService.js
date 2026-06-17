// Service de news économiques en temps réel
// Sources: investing.com API, forexfactory, avec fallback données simulées

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

// Fallback: données simulées réalistes basées sur le calendrier réel
function generateRealisticMock() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const events = [];

  // Événements récurrents hebdomadaires
  const weeklyEvents = [
    { day: 1, hour: 14, title: 'États-Unis — Ventes de logements', country: 'US', currency: 'USD', impact: 'medium' },
    { day: 2, hour: 8, title: 'Zone Euro — PIB trimestriel', country: 'EU', currency: 'EUR', impact: 'high' },
    { day: 2, hour: 14, title: 'États-Unis — Confiance des consommateurs', country: 'US', currency: 'USD', impact: 'medium' },
    { day: 3, hour: 8, title: 'Allemagne — Taux de chômage', country: 'DE', currency: 'EUR', impact: 'high' },
    { day: 3, hour: 13, title: 'États-Unis — IPC mensuel', country: 'US', currency: 'USD', impact: 'high' },
    { day: 4, hour: 13, title: 'États-Unis — PIB (estimé)', country: 'US', currency: 'USD', impact: 'high' },
    { day: 4, hour: 14, title: 'États-Unis — Demande d\'allocations chômage', country: 'US', currency: 'USD', impact: 'medium' },
    { day: 5, hour: 8, title: 'France — Production industrielle', country: 'FR', currency: 'EUR', impact: 'medium' },
    { day: 5, hour: 13, title: 'États-Unis — Ventes au détail', country: 'US', currency: 'USD', impact: 'high' },
  ];

  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];
  const countries = ['US', 'EU', 'UK', 'JP', 'CH', 'CA', 'AU', 'NZ'];
  const countryNames = ['États-Unis', 'Zone Euro', 'Royaume-Uni', 'Japon', 'Suisse', 'Canada', 'Australie', 'Nouvelle-Zélande'];

  const impactLevels = ['high', 'medium', 'low'];
  const eventTemplates = [
    'Décision taux directeur',
    'Indice des prix à la consommation',
    'Ventes au détail',
    'Production industrielle',
    'Taux de chômage',
    'Indice PMI manufacturier',
    'Balance commerciale',
    'Confiance des consommateurs',
    'Commandes de biens durables',
    'Mise en chantier',
  ];

  // Add weekly recurring events
  for (const we of weeklyEvents) {
    if (we.day === dayOfWeek) {
      const eventDate = new Date(now);
      eventDate.setHours(we.hour, 30, 0, 0);
      if (eventDate > now) {
        const prevVal = (Math.random() * 6 - 2).toFixed(1);
        const forecastVal = (parseFloat(prevVal) + (Math.random() - 0.5) * 0.8).toFixed(1);
        events.push({
          id: `ECON-${eventDate.toISOString().slice(0, 10)}-${we.title.slice(0, 3)}`,
          date: eventDate.toISOString().slice(0, 10),
          time: `${we.hour.toString().padStart(2, '0')}:30`,
          title: we.title,
          country: we.country,
          currency: we.currency,
          impact: we.impact,
          previous: `${prevVal}%`,
          forecast: `${forecastVal}%`,
          actual: null,
          status: 'upcoming',
        });
      }
    }
  }

  // Add extra random events for today and next 3 days
  for (let d = 0; d < 4; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().slice(0, 10);
    const numExtra = d === 0 ? 2 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < numExtra; i++) {
      const ci = Math.floor(Math.random() * countries.length);
      const ti = Math.floor(Math.random() * eventTemplates.length);
      const ii = Math.random() < 0.3 ? 0 : Math.random() < 0.6 ? 1 : 2;
      const hour = 7 + Math.floor(Math.random() * 12);
      const minute = Math.random() > 0.5 ? 0 : 30;

      const eventDate = new Date(date);
      eventDate.setHours(hour, minute, 0, 0);
      const isPast = eventDate < now;

      const prevVal = (Math.random() * 8 - 3).toFixed(1);
      const forecastVal = (parseFloat(prevVal) + (Math.random() - 0.5) * 1.0).toFixed(1);
      const actualDiff = (Math.random() - 0.5) * 1.5;

      events.push({
        id: `ECON-${dateStr}-${ci}-${i}`,
        date: dateStr,
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        title: `${countryNames[ci]} — ${eventTemplates[ti]}`,
        country: countries[ci],
        currency: currencies[ci],
        impact: impactLevels[ii],
        previous: `${prevVal}%`,
        forecast: `${forecastVal}%`,
        actual: isPast ? `${(parseFloat(forecastVal) + actualDiff).toFixed(1)}%` : null,
        status: isPast ? 'done' : 'upcoming',
      });
    }
  }

  // Sort by date/time
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  return events;
}

// Analyse d'impact pour un événement
function analyzeEvent(event) {
  const parsePct = (s) => parseFloat(String(s).replace('%', '').replace('+', '')) || 0;
  const prevVal = parsePct(event.previous);
  const forecastVal = parsePct(event.forecast);

  const impactScores = { high: 3, medium: 2, low: 1 };
  const baseScore = impactScores[event.impact] || 1;
  const forecastDiff = forecastVal - prevVal;
  const absDiff = Math.abs(forecastDiff);

  let direction = null;
  let probability = 50 + baseScore * 8;

  if (absDiff > 0.3) {
    direction = forecastDiff > 0 ? 'up' : 'down';
    probability += Math.min(absDiff * 5, 15);
  }

  if (event.impact === 'high') probability += 10;
  probability = Math.min(Math.max(probability, 30), 92);

  return {
    direction,
    probability: Math.round(probability),
    impact: event.impact,
  };
}

// Récupération principale
export async function getEconomicCalendar() {
  // Check cache
  if (cache.data && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  let events = [];
  let source = 'cache';

  // Try real sources first
  for (const src of SOURCES) {
    try {
      const res = await fetchWithTimeout(src.url, { headers: src.headers });
      if (res.ok) {
        const html = await res.text();
        events = parseInvestingHtml(html);
        if (events.length > 5) {
          source = src.name;
          break;
        }
      }
    } catch {
      // Source failed, try next
    }
  }

  // Fallback to realistic mock
  if (events.length < 5) {
    events = generateRealisticMock();
    source = 'mock';
  }

  // Analyze events and generate signals
  const signals = events
    .filter(e => e.status !== 'done' && e.impact !== 'low')
    .slice(0, 12)
    .map(e => {
      const analysis = analyzeEvent(e);
      const tp1 = Math.round((analysis.direction === 'up' ? 1 : -1) * 0.5 * analysis.probability);
      const tp2 = Math.round((analysis.direction === 'up' ? 1 : -1) * 1.0 * analysis.probability);
      const sl = Math.round((analysis.direction === 'up' ? -1 : 1) * 0.3 * analysis.probability);

      return {
        event: e,
        direction: analysis.direction,
        probability: analysis.probability,
        reasoning: `${e.title} — Prévision: ${e.forecast} vs Précédent: ${e.previous}. ${analysis.direction === 'up' ? 'Hausse anticipée' : analysis.direction === 'down' ? 'Baisse anticipée' : 'Direction neutre'}.`,
        entryWindow: 'Session principale',
        targets: {
          tp1: `${Math.abs(tp1)} pips`,
          tp2: `${Math.abs(tp2)} pips`,
          sl: `${Math.abs(sl)} pips`,
        },
      };
    });

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
