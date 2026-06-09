import { db } from '../config/firebase.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

class TelegramService {
  get isConfigured() {
    return TELEGRAM_BOT_TOKEN.length > 0;
  }

  async sendMessage(chatId, text) {
    if (!this.isConfigured) return;
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      });
      return res.ok;
    } catch { return false; }
  }

  async broadcastSignal(signal) {
    if (!this.isConfigured || !signal) return;

    const emoji = signal.direction === 'up' ? '🟢' : '🔴';
    const typeLabel = signal.type === 'BOOM' ? 'Boom' : 'Crash';

    const text = [
      `<b>🚀 Signal ${signal.signal} ${emoji}</b>`,
      ``,
      `<b>${typeLabel} ${signal.number}</b>`,
      `Direction: <b>${signal.direction === 'up' ? 'ACHAT' : 'VENTE'}</b>`,
      `Probabilité: <b>${signal.probability}%</b>`,
      `Entrée: <b>${signal.entryPrice}</b>`,
      `SL: <b>${signal.stopLoss}</b>`,
      `TP: <b>${signal.takeProfit}</b>`,
      `Ampleur estimée: <b>${signal.magnitude}</b>`,
      ``,
      `⚠️ Trade avec gestion des risques`,
      `<i>KongoPay - #1 Prédiction Spike</i>`,
    ].join('\n');

    const subscribers = await this.getSubscribers();
    for (const sub of subscribers) {
      await this.sendMessage(sub.chatId, text);
    }
  }

  async broadcastStats(stats) {
    if (!this.isConfigured || !stats) return;

    const text = [
      `<b>📊 Stats KongoPay</b>`,
      ``,
      `Signaux: <b>${stats.total}</b>`,
      `Gagnés: <b>${stats.wins}</b>`,
      `Perdus: <b>${stats.losses}</b>`,
      `Win Rate: <b>${stats.winRate}%</b>`,
      `ROI: <b>${stats.roi}%</b>`,
      `Profit Factor: <b>${stats.profitFactor}</b>`,
    ].join('\n');

    const subscribers = await this.getSubscribers();
    for (const sub of subscribers) {
      await this.sendMessage(sub.chatId, text);
    }
  }

  async getSubscribers() {
    const snapshot = await db.collection('telegram_subscribers').get();
    return snapshot.docs.map(d => ({
      chatId: d.id,
      ...d.data(),
    }));
  }

  async subscribe(chatId, userId = null) {
    await db.collection('telegram_subscribers').doc(String(chatId)).set({
      chatId: String(chatId),
      userId: userId || null,
      subscribedAt: new Date().toISOString(),
      active: true,
    });
  }

  async unsubscribe(chatId) {
    await db.collection('telegram_subscribers').doc(String(chatId)).delete();
  }
}

export const telegramService = new TelegramService();
