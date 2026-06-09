import { Router } from 'express';
import { telegramService } from '../services/telegram.js';

const router = Router();

router.post('/webhook', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || !message.text || !message.chat) {
      return res.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim().toLowerCase();
    const userId = message.from?.id?.toString();

    if (text === '/start' || text === '/subscribe') {
      await telegramService.subscribe(chatId, userId);
      await telegramService.sendMessage(chatId,
        '🤖 <b>Bienvenue sur KongoPay!</b>\n\n'
        + 'Tu recevras les signaux spike en temps réel.\n'
        + 'Utilise /unsubscribe pour te désabonner.'
      );
    } else if (text === '/unsubscribe') {
      await telegramService.unsubscribe(chatId);
      await telegramService.sendMessage(chatId, 'Désabonné. Reviens avec /subscribe !');
    } else if (text === '/stats') {
      const { signalTracker } = await import('../services/signalTracker.js');
      const stats = await signalTracker.getStats();
      await telegramService.sendMessage(chatId,
        `<b>📊 Stats KongoPay</b>\n\n`
        + `Signaux: ${stats.total}\n`
        + `Gagnés: ${stats.wins}\n`
        + `Perdus: ${stats.losses}\n`
        + `Win Rate: ${stats.winRate}%\n`
        + `ROI: ${stats.roi}%`
      );
    } else {
      await telegramService.sendMessage(chatId,
        'Commandes:\n'
        + '/subscribe - Recevoir les signaux\n'
        + '/unsubscribe - Stop\n'
        + '/stats - Statistiques'
      );
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
