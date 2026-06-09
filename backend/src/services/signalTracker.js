import { db, admin } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

const SIGNALS_COLLECTION = 'signals';
const STATS_COLLECTION = 'signal_stats';

class SignalTracker {
  async recordSignal(signal) {
    if (!signal || signal.signal === 'NEUTRAL') return null;

    const id = uuidv4().slice(0, 8).toUpperCase();
    const doc = {
      id: `SIG-${id}`,
      type: signal.type,
      number: signal.number,
      label: `${signal.type === 'BOOM' ? 'Boom' : 'Crash'} ${signal.number}`,
      direction: signal.expectedDirection,
      signal: signal.signal,
      entryPrice: signal.entryPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      probability: signal.spikeProbability,
      magnitude: signal.estimatedMagnitude,
      currentPrice: signal.currentPrice,
      upScore: signal.upScore,
      downScore: signal.downScore,
      rsi: signal.rsi || null,
      createdAt: new Date().toISOString(),
      status: 'active',
      result: null,
      exitPrice: null,
      exitReason: null,
      resolvedAt: null,
      maxFavorable: 0,
      maxAdverse: 0,
    };

    await db.collection(SIGNALS_COLLECTION).doc(doc.id).set(doc);
    return doc;
  }

  async checkOpenSignals(getPrice) {
    const snapshot = await db.collection(SIGNALS_COLLECTION)
      .where('status', '==', 'active')
      .get();

    const resolved = [];
    for (const doc of snapshot.docs) {
      const signal = doc.data();
      try {
        const currentPrice = await getPrice(signal.type, signal.number);
        if (!currentPrice) continue;

        const isBuy = signal.direction === 'up';
        const diff = isBuy ? currentPrice - signal.entryPrice : signal.entryPrice - currentPrice;
        const diffPct = diff / signal.entryPrice;

        const maxFav = Math.max(signal.maxFavorable || 0, diff);
        const maxAdv = Math.max(signal.maxAdverse || 0, -diff);

        let status = 'active';
        let result = null;
        let exitPrice = null;
        let exitReason = null;

        if (isBuy && currentPrice <= signal.stopLoss) {
          status = 'closed';
          result = 'loss';
          exitPrice = currentPrice;
          exitReason = 'stop_loss';
        } else if (!isBuy && currentPrice >= signal.stopLoss) {
          status = 'closed';
          result = 'loss';
          exitPrice = currentPrice;
          exitReason = 'stop_loss';
        } else if (isBuy && currentPrice >= signal.takeProfit) {
          status = 'closed';
          result = 'win';
          exitPrice = currentPrice;
          exitReason = 'take_profit';
        } else if (!isBuy && currentPrice <= signal.takeProfit) {
          status = 'closed';
          result = 'win';
          exitPrice = currentPrice;
          exitReason = 'take_profit';
        }

        const elapsed = Date.now() - new Date(signal.createdAt).getTime();
        if (status === 'active' && elapsed > 12 * 60 * 60 * 1000) {
          status = 'closed';
          result = 'timeout';
          exitPrice = currentPrice;
          exitReason = 'expired';
        }

        const updates = { maxFavorable: maxFav, maxAdverse: maxAdv };
        if (status !== 'active') {
          updates.status = status;
          updates.result = result;
          updates.exitPrice = exitPrice;
          updates.exitReason = exitReason;
          updates.resolvedAt = new Date().toISOString();
          resolved.push({ ...signal, result, exitPrice, exitReason });
        }

        await db.collection(SIGNALS_COLLECTION).doc(signal.id).update(updates);
      } catch { /* skip */ }
    }

    if (resolved.length > 0) {
      await this.updateStats();
    }

    return resolved;
  }

  async updateStats() {
    const snapshot = await db.collection(SIGNALS_COLLECTION)
      .where('status', '==', 'closed')
      .get();

    const signals = snapshot.docs.map(d => d.data());
    const total = signals.length;
    const wins = signals.filter(s => s.result === 'win').length;
    const losses = signals.filter(s => s.result === 'loss').length;
    const timeouts = signals.filter(s => s.result === 'timeout').length;

    let totalReturn = 0;
    let totalRisk = 0;
    for (const s of signals) {
      if (s.result === 'win') {
        const risk = Math.abs(s.entryPrice - s.stopLoss);
        const reward = Math.abs(s.takeProfit - s.entryPrice);
        totalReturn += reward / risk;
        totalRisk += 1;
      } else if (s.result === 'loss') {
        totalReturn -= 1;
        totalRisk += 1;
      }
    }

    const winRate = total > 0 ? (wins / total * 100) : 0;
    const roi = totalRisk > 0 ? (totalReturn / totalRisk * 100) : 0;

    const stats = {
      total,
      wins,
      losses,
      timeouts,
      winRate: Math.round(winRate * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      profitFactor: losses > 0 ? (wins / losses) : wins > 0 ? Infinity : 0,
      updatedAt: new Date().toISOString(),
    };

    await db.collection(STATS_COLLECTION).doc('global').set(stats, { merge: true });
    return stats;
  }

  async getStats() {
    const doc = await db.collection(STATS_COLLECTION).doc('global').get();
    if (!doc.exists) {
      return { total: 0, wins: 0, losses: 0, timeouts: 0, winRate: 0, roi: 0, profitFactor: 0 };
    }
    return doc.data();
  }

  async getRecentSignals(limit = 20) {
    const snapshot = await db.collection(SIGNALS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  async getSignalsByLabel(label, limit = 50) {
    const snapshot = await db.collection(SIGNALS_COLLECTION)
      .where('label', '==', label)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(d => d.data());
  }
}

export const signalTracker = new SignalTracker();
