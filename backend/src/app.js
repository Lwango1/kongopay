import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { initializeFirebase } from './config/firebase.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter, authLimiter } from './middleware/rateLimiter.js';
import { derivService } from './services/deriv.js';
import { mlService } from './services/mlPrediction.js';
import { signalTracker } from './services/signalTracker.js';
import authRoutes from './routes/auth.js';
import walletRoutes from './routes/wallet.js';
import tradingRoutes from './routes/trading.js';
import adminRoutes from './routes/admin.js';
import mobileMoneyRoutes from './routes/mobileMoney.js';
import derivRoutes from './routes/deriv.js';
import p2pRoutes from './routes/p2p.js';
import kycRoutes from './routes/kyc.js';
import feesRoutes from './routes/fees.js';
import engagementRoutes from './routes/engagement.js';
import subscriptionRoutes from './routes/subscription.js';
import notificationsRoutes from './routes/notifications.js';
import signalsRoutes from './routes/signals.js';
import telegramRoutes from './routes/telegram.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10kb' }));
app.use('/api/', apiLimiter);

initializeFirebase();

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mobile-money', mobileMoneyRoutes);
app.use('/api/deriv', derivRoutes);
app.use('/api/p2p', p2pRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/engagement', engagementRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/signals', signalsRoutes);
app.use('/api/telegram', telegramRoutes);

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', version: '2.0.0', name: 'KongoPay API' });
});

app.use(errorHandler);

async function startBackgroundTasks() {
  mlService.init();

  const derivGetPrice = async (type, num) => {
    const key = `${type}_${num}`;
    const st = derivService.stateMap?.get?.(key);
    return st?.price ?? null;
  };

  setInterval(async () => {
    try {
      await signalTracker.checkOpenSignals(derivGetPrice);

      for (const idx of [{ type: 'BOOM', number: 500 }, { type: 'BOOM', number: 1000 },
        { type: 'CRASH', number: 500 }, { type: 'CRASH', number: 1000 }]) {
        const signal = derivService.generateSignal(idx.type, idx.number);
        if (signal && signal.spikeProbability > 75) {
          await derivService.emitSignal(idx.type, idx.number);
        }
      }
    } catch { /* background */ }
  }, 30000);
}

app.listen(PORT, () => {
  console.log(`KongoPay API running on port ${PORT}`);
  derivService.connect();
  startBackgroundTasks();
});
