// Pont entre les signaux News Trading et le Risk Manager
// Sizing Kelly, Corrélation, Drawdown Control

import { riskManager } from './riskManager.js';
import { eventBus } from './eventBus.js';
import { getEconomicCalendar } from './newsService.js';

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 min
const ACCOUNT_BALANCE = 1000; // TODO: wallet réel

let activeTrades = new Map(); // eventId -> trade

function signalToRiskManagerFormat(newsSignal) {
  const e = newsSignal.event;
  const entryPips = newsSignal.direction === 'up' ? 100 : 100;
  const slPips = parseInt(newsSignal.targets.sl) || 30;
  const tp1Pips = parseInt(newsSignal.targets.tp1) || 50;

  return {
    type: `NEWS_${e.currency || 'FX'}`,
    label: e.title?.slice(0, 40) || `News ${e.currency}`,
    expectedDirection: newsSignal.direction === 'up' ? 'CALL' : newsSignal.direction === 'down' ? 'PUT' : 'NEUTRAL',
    entryPrice: entryPips,
    stopLoss: entryPips + (newsSignal.direction === 'up' ? -slPips : slPips),
    takeProfit: entryPips + (newsSignal.direction === 'up' ? tp1Pips : -tp1Pips),
    spikeProbability: newsSignal.probability,
    volScale: e.impact === 'high' ? 1.5 : e.impact === 'medium' ? 1.0 : 0.7,
  };
}

export async function processNewsSignals() {
  try {
    const { signals } = await getEconomicCalendar();
    const now = Date.now();
    const activeSignals = [...activeTrades.values()].map(t => t.signal);

    for (const ns of signals) {
      const eventId = ns.event.id;

      // Skip déjà traité
      if (activeTrades.has(eventId)) continue;

      // Vérifier que l'événement est dans les 2h
      const eventDate = new Date(`${ns.event.date}T${ns.event.time}`).getTime();
      if (Math.abs(eventDate - now) > 2 * 60 * 60 * 1000) continue;

      const riskSignal = signalToRiskManagerFormat(ns);

      // Filtre risque
      const filtered = await riskManager.filterSignal(riskSignal, ACCOUNT_BALANCE, activeSignals);

      if (filtered.allowed) {
        const trade = {
          id: eventId,
          event: ns.event,
          direction: ns.direction,
          probability: ns.probability,
          reasoning: ns.reasoning,
          risk: filtered.signal.risk,
          timestamp: now,
        };

        activeTrades.set(eventId, { trade, signal: riskSignal });

        eventBus.emit('signal', {
          ...trade,
          type: 'news',
          label: `📰 ${ns.event.title}`,
        });

        console.log(`[NewsRiskBridge] Signal émis: ${ns.event.title} → ${ns.direction} (${filtered.signal.risk.fraction * 100}% size)`);
      } else {
        eventBus.emit('alert', {
          type: 'news_signal_blocked',
          reason: filtered.reason,
          eventId,
          title: ns.event.title,
        });
      }
    }
  } catch (err) {
    console.error('[NewsRiskBridge] Erreur:', err.message);
  }
}

// Nettoyer les trades expirés (> 6h)
setInterval(() => {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const [id, { trade }] of activeTrades) {
    if (trade.timestamp < cutoff) {
      activeTrades.delete(id);
    }
  }
}, 60 * 60 * 1000);

export function getActiveNewsTrades() {
  return [...activeTrades.values()].map(t => t.trade);
}

// Fonction utilitaire: enregistrer le résultat d'un trade news
export function recordNewsTrade(eventId, pnl, pnlPct) {
  const entry = activeTrades.get(eventId);
  if (!entry) return;

  riskManager.recordTrade({
    pnl,
    pnlPct,
    direction: entry.signal.expectedDirection,
    label: `[NEWS] ${entry.trade.event.title}`,
  });

  eventBus.emit('trade', {
    eventId,
    pnl,
    pnlPct,
    type: 'news',
  });

  activeTrades.delete(eventId);
}
