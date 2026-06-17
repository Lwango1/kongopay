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

  // Build features from recent price history
  buildSequence(prices, indicators) {
    if (prices.length < SEQ_LENGTH + 1) return null;

    const seq = [];
    for (let t = prices.length - SEQ_LENGTH; t < prices.length; t++) {
      const priceChange = t > 0 ? (prices[t] - prices[t - 1]) / (prices[t - 1] || 1) : 0;
      seq.push([
        priceChange,
        indicators.rsiAtTime ? indicators.rsiAtTime(t) : 0.5,
        indicators.atrRatioAtTime ? indicators.atrRatioAtTime(t) : 0.5,
        indicators.momentumAtTime ? indicators.momentumAtTime(t) : 0,
        indicators.srDistanceAtTime ? indicators.srDistanceAtTime(t) : 0.5,
        indicators.consecutiveMovesAtTime ? indicators.consecutiveMovesAtTime(t) : 0,
        indicators.volumeRatioAtTime ? indicators.volumeRatioAtTime(t) : 0.5,
        indicators.volRegimeAtTime ? indicators.volRegimeAtTime(t) : 0.5,
        indicators.timeSinceSpikeAtTime ? indicators.timeSinceSpikeAtTime(t) : 0.5,
        indicators.advancedCompositeAtTime ? indicators.advancedCompositeAtTime(t) : 0.5,
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
      if (!s.features || !s.priceHistory) continue;

      const prices = s.priceHistory;
      if (prices.length < SEQ_LENGTH + 1) continue;

      // Build features at signal time
      const seq = this.buildSequence(prices, {
        rsiAtTime: (t) => s.features.rsiAtTime?.[t] ?? 0.5,
        atrRatioAtTime: (t) => s.features.atrRatioAtTime?.[t] ?? 0.5,
        momentumAtTime: (t) => s.features.momentumAtTime?.[t] ?? 0,
        srDistanceAtTime: (t) => s.features.srDistAtTime?.[t] ?? 0.5,
        consecutiveMovesAtTime: (t) => s.features.consecAtTime?.[t] ?? 0,
        volumeRatioAtTime: (t) => 0.5,
        volRegimeAtTime: (t) => 0.5,
        timeSinceSpikeAtTime: (t) => t > 0 ? Math.min(t / 100, 1) : 0,
        advancedCompositeAtTime: (t) => 0.5,
      });

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

  // Real-time sequence builder from current state
  buildCurrentSequence(prices, indicators) {
    if (prices.length < SEQ_LENGTH + 1) return null;
    return this.buildSequence(prices, indicators);
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
