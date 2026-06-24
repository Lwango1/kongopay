import * as tf from '@tensorflow/tfjs';
import { db } from '../config/firebase.js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'models', 'lstm');

const SEQ_LENGTH = 20;
const NUM_FEATURES = 10;
const OUTPUT_SIZE = 3;

const FEATURE_NAMES = [
  'price_change', 'rsi', 'atr_ratio', 'momentum',
  'sr_distance', 'consecutive_moves', 'volume_ratio',
  'volatility_regime', 'time_since_spike', 'advanced_composite',
];

class LSTMPredictionService {
  constructor() {
    this.model = null;
    this.ready = false;
    this.priceHistory = new Map(); // index -> price array
  }

  buildModel() {
    const model = tf.sequential();

    // First LSTM layer (return sequences for stacking)
    model.add(tf.layers.lstm({
      inputShape: [SEQ_LENGTH, NUM_FEATURES],
      units: 32,
      returnSequences: true,
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
      recurrentRegularizer: tf.regularizers.l2({ l2: 0.001 }),
    }));
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(tf.layers.batchNormalization());

    // Second LSTM layer
    model.add(tf.layers.lstm({
      units: 16,
      returnSequences: false,
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // Dense layers
    model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: OUTPUT_SIZE, activation: 'softmax' }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    this.model = model;
    this.ready = true;
    console.log('[LSTM] Modèle LSTM construit:', `${SEQ_LENGTH}×${NUM_FEATURES} → 32→16→8→3`);
  }

  // Compute RSI from a slice of prices
  _calcRSI(prices) {
    if (prices.length < 15) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    if (losses === 0) return 100;
    return 100 - 100 / (1 + gains / losses);
  }

  // Compute ATR from a slice of prices
  _calcATR(prices, period = 14) {
    if (prices.length < period + 1) return 0;
    let sum = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      sum += Math.abs(prices[i] - prices[i - 1]);
    }
    return sum / period;
  }

  // Build features from recent price history
  buildSequence(prices) {
    if (prices.length < SEQ_LENGTH + 1) return null;

    const seq = [];
    for (let t = prices.length - SEQ_LENGTH; t < prices.length; t++) {
      const priceChange = t > 0 ? (prices[t] - prices[t - 1]) / (prices[t - 1] || 1) : 0;

      // Compute indicators from price history up to time t
      const priceSlice = prices.slice(Math.max(0, t - 20), t + 1);
      const rsi = this._calcRSI(priceSlice);
      const atr = this._calcATR(priceSlice);
      const avgPrice = priceSlice.reduce((a, b) => a + b, 0) / priceSlice.length;
      const atrRatio = avgPrice > 0 ? atr / avgPrice : 0;

      // Momentum: avg change over last 5 ticks
      const recent5 = priceSlice.slice(-5);
      const momentum = recent5.length > 1
        ? (recent5[recent5.length - 1] - recent5[0]) / recent5.length / (avgPrice || 1)
        : 0;

      // SR distance: distance from current price to recent min/max
      const periodMin = Math.min(...priceSlice);
      const periodMax = Math.max(...priceSlice);
      const range = periodMax - periodMin || 1;
      const srDistance = (prices[t] - periodMin) / range;

      // Consecutive moves in same direction
      let consec = 0;
      for (let i = t; i > Math.max(1, t - 5); i--) {
        if ((prices[i] - prices[i - 1]) * (priceChange >= 0 ? 1 : -1) > 0) consec++;
        else break;
      }
      const consecutiveMoves = Math.min(consec / 5, 1);

      // Volatility regime: recent ATR / medium-term ATR
      const atrShort = this._calcATR(priceSlice, 7);
      const atrLong = this._calcATR(priceSlice, 20);
      const volRegime = atrLong > 0 ? Math.min(atrShort / atrLong, 2) / 2 : 0.5;

      seq.push([
        Math.tanh(priceChange * 100),      // price_change (normalized)
        rsi / 100,                          // rsi
        Math.min(atrRatio * 1000, 1),       // atr_ratio
        Math.tanh(momentum * 100),          // momentum
        srDistance,                         // sr_distance
        consecutiveMoves,                   // consecutive_moves
        0.5,                                // volume_ratio (no volume data)
        volRegime,                          // volatility_regime
        0.5,                                // time_since_spike
        0.5,                                // advanced_composite
      ]);
    }
    return seq;
  }

  async collectTrainingData() {
    const snapshot = await db.collection('signals')
      .where('status', '==', 'closed')
      .where('result', 'in', ['win', 'loss'])
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();

    const xs = [];
    const ys = [];

    for (const doc of snapshot.docs) {
      const s = doc.data();
      if (!s.priceHistory) continue;

      const prices = s.priceHistory;
      if (prices.length < SEQ_LENGTH + 1) continue;

      const seq = this.buildSequence(prices);
      if (!seq) continue;
      xs.push(seq);

      if (s.result === 'win') {
        ys.push(s.direction === 'up' ? [1, 0, 0] : [0, 1, 0]);
      } else {
        ys.push([0, 0, 1]);
      }
    }

    return { xs, ys };
  }

  async train(epochs = 100) {
    if (!this.model) this.buildModel();
    const { xs, ys } = await this.collectTrainingData();

    if (xs.length < 20) {
      console.log(`[LSTM] Pas assez de séquences: ${xs.length}`);
      return { trained: false, samples: xs.length };
    }

    const tensorX = tf.tensor3d(xs); // [batch, seq_len, features]
    const tensorY = tf.tensor2d(ys);

    const result = await this.model.fit(tensorX, tensorY, {
      epochs,
      batchSize: Math.min(16, xs.length),
      shuffle: true,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 20 === 0) {
            console.log(`[LSTM] Epoch ${epoch}: loss=${logs.loss.toFixed(4)}, acc=${(logs.acc * 100).toFixed(1)}%`);
          }
        },
      },
    });

    tensorX.dispose();
    tensorY.dispose();

    const accuracy = result.history.acc[result.history.acc.length - 1];
    console.log(`[LSTM] Entraînement terminé: accuracy=${(accuracy * 100).toFixed(1)}%`);

    await this.saveModel();
    return { trained: true, samples: xs.length, accuracy: accuracy * 100 };
  }

  predict(sequence) {
    if (!this.ready || !this.model || !sequence || sequence.length !== SEQ_LENGTH) {
      return { up: 0, down: 0, neutral: 1, source: 'heuristic' };
    }

    const input = tf.tensor3d([sequence]); // [1, seq_len, features]
    const output = this.model.predict(input);
    const probs = output.dataSync();
    input.dispose();
    output.dispose();

    return {
      up: probs[0],
      down: probs[1],
      neutral: probs[2],
      source: 'lstm',
    };
  }

  // Real-time sequence builder from current price history
  buildCurrentSequence(prices) {
    if (prices.length < SEQ_LENGTH + 1) return null;
    return this.buildSequence(prices);
  }

  async saveModel() {
    if (!fs.existsSync(MODELS_DIR)) {
      fs.mkdirSync(MODELS_DIR, { recursive: true });
    }
    try {
      await this.model.save(`file://${MODELS_DIR}`);
      console.log(`[LSTM] Modèle sauvegardé: ${MODELS_DIR}`);
    } catch (err) {
      console.error('[LSTM] Erreur sauvegarde:', err.message);
    }
  }

  async loadModel() {
    const modelPath = path.join(MODELS_DIR, 'model.json');
    if (fs.existsSync(modelPath)) {
      try {
        this.model = await tf.loadLayersModel(`file://${modelPath}`);
        this.ready = true;
        console.log('[LSTM] Modèle chargé du disque');
        return true;
      } catch (err) {
        console.error('[LSTM] Erreur chargement:', err.message);
      }
    }
    this.buildModel();
    return false;
  }

  async init() {
    await this.loadModel();
    setInterval(() => this.retrainIfNeeded(), 2 * 60 * 60 * 1000);
  }

  async retrainIfNeeded() {
    const snapshot = await db.collection('signals')
      .where('status', '==', 'closed')
      .get();
    if (snapshot.size >= 30) {
      await this.train(50);
    }
  }
}

export const lstmService = new LSTMPredictionService();
