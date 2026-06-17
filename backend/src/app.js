import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { initializeFirebase } from './config/firebase.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter, authLimiter } from './middleware/rateLimiter.js';
import { derivService } from './services/deriv.js';
import { binanceLiveService } from './services/binanceLive.js';
import { mlService } from './services/mlPrediction.js';
import { ensembleML } from './services/ensembleML.js';
import { signalTracker } from './services/signalTracker.js';
import { riskManager } from './services/riskManager.js';
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
import cryptoRoutes from './routes/crypto.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://*.firebaseio.com'],
      connectSrc: ["'self'", 'wss://ws.binaryws.com', 'wss://stream.binance.com:9443', 'https://*.firebaseio.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, false);
  },
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10kb' }));
app.use('/api/', apiLimiter);

initializeFirebase();

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/wallet', authLimiter, walletRoutes);
app.use('/api/trading', authLimiter, tradingRoutes);
app.use('/api/admin', authLimiter, adminRoutes);
app.use('/api/mobile-money', authLimiter, mobileMoneyRoutes);
app.use('/api/deriv', authLimiter, derivRoutes);
app.use('/api/crypto', authLimiter, cryptoRoutes);
app.use('/api/p2p', authLimiter, p2pRoutes);
app.use('/api/kyc', authLimiter, kycRoutes);
app.use('/api/subscription', authLimiter, subscriptionRoutes);
app.use('/api/engagement', authLimiter, engagementRoutes);
app.use('/api/fees', authLimiter, feesRoutes);
app.use('/api/notifications', authLimiter, notificationsRoutes);
app.use('/api/signals', authLimiter, signalsRoutes);

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', version: '2.0.0', name: 'KongoPay API' });
});

app.get('/api/risk/stats', (_, res) => {
  const stats = riskManager.getPerformanceStats();
  res.json({
    ...stats,
    consecutiveLosses: riskManager.consecutiveLosses,
    tradeHistory: riskManager.tradeHistory.slice(-20),
  });
});

app.use(errorHandler);

async function startBackgroundTasks() {
  mlService.init();
  ensembleML.init();
  try {
    const { lstmService } = await import('./services/lstrmPrediction.js');
    lstmService.init();
  } catch { /* LSTM optionnel */ }

  const derivGetPrice = async (type, num) => {
    const key = `${type}_${num}`;
    const st = derivService.stateMap?.get?.(key);
    return st?.price ?? null;
  };

  setInterval(async () => {
    try {
      await signalTracker.checkOpenSignals(derivGetPrice);

      const activeSignals = []; // collect from signalTracker if needed
      const accountBalance = 1000; // TODO: get from user wallet

      for (const idx of [{ type: 'BOOM', number: 500 }, { type: 'BOOM', number: 1000 },
        { type: 'CRASH', number: 500 }, { type: 'CRASH', number: 1000 }]) {
        const signal = await derivService.generateSignal(idx.type, idx.number);
        if (signal && signal.spikeProbability > 75) {
          // Risk management filter
          const filtered = await riskManager.filterSignal(signal, accountBalance, activeSignals);
          if (filtered.allowed) {
            const emitted = await derivService.emitSignal(idx.type, idx.number);
            if (emitted) {
              riskManager.recordTrade({
                pnl: 0,
                pnlPct: 0,
                direction: emitted.direction,
                label: emitted.label,
              });
            }
          }
        }
      }
    } catch { /* background */ }
  }, 30000);

  setInterval(async () => {
    try {
      await ensembleML.retrainIfNeeded();
    } catch { /* background */ }
  }, 60 * 60 * 1000);
}

app.listen(PORT, () => {
  console.log(`KongoPay API running on port ${PORT}`);
  derivService.connect();
  startBackgroundTasks();
});
