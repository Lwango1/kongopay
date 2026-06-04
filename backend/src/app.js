import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { initializeFirebase } from './config/firebase.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import walletRoutes from './routes/wallet.js';
import tradingRoutes from './routes/trading.js';
import adminRoutes from './routes/admin.js';
import mobileMoneyRoutes from './routes/mobileMoney.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('dev'));
app.use(express.json());

initializeFirebase();

app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mobile-money', mobileMoneyRoutes);

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', version: '2.0.0', name: 'KongoPay API' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`KongoPay API running on port ${PORT}`);
});
