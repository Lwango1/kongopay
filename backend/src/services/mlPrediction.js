import * as tf from '@tensorflow/tfjs';
import { db } from '../config/firebase.js';

const FEATURES = [
  'rsi', 'atr_ratio', 'volume', 'price_position',
  'consecutive_moves', 'time_since_spike', 'momentum',
  'sr_distance', 'mfi', 'macd_histogram',
];
const INPUT_SIZE = FEATURES.length;
const HIDDEN_SIZE = 16;
const OUTPUT_SIZE = 3; // up, down, neutral

class MLPredictionService {
  constructor() {
    this.model = null;
    this.ready = false;
  }

  buildModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({
      inputShape: [INPUT_SIZE],
      units: HIDDEN_SIZE,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
    }));
    model.add(tf.layers.dropout({ rate: 0.3 }));
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
  }

  extractFeatures(signal) {
    return [
      signal.rsi ? signal.rsi / 100 : 0.5,
      signal.atrRatio || 0.5,
      signal.volume || 0.5,
      signal.pricePosition ? signal.pricePosition / 100 : 0.5,
      signal.consecutiveMoves ? signal.consecutiveMoves / 10 : 0.5,
      Math.min((signal.timeSinceLastSpike || 999) / 100, 1),
      signal.momentum || 0.5,
      signal.srDistance || 0.5,
      signal.mfi || 0.5,
      signal.macdHistogram || 0.5,
    ];
  }

  async collectTrainingData() {
    const snapshot = await db.collection('signals')
      .where('status', '==', 'closed')
      .where('result', 'in', ['win', 'loss'])
      .get();

    const xs = [];
    const ys = [];

    for (const doc of snapshot.docs) {
      const s = doc.data();
      if (!s.features) continue;

      const features = this.extractFeatures({ ...s, ...s.features });
      xs.push(features);

      if (s.result === 'win') {
        ys.push(s.direction === 'up' ? [1, 0, 0] : [0, 1, 0]);
      } else {
        ys.push([0, 0, 1]);
      }
    }

    return { xs, ys };
  }

  async train(epochs = 50) {
    if (!this.model) this.buildModel();
    const { xs, ys } = await this.collectTrainingData();

    if (xs.length < 10) {
      console.log(`[ML] Pas assez de données: ${xs.length} échantillons`);
      return { trained: false, samples: xs.length };
    }

    const tensorX = tf.tensor2d(xs);
    const tensorY = tf.tensor2d(ys);

    const result = await this.model.fit(tensorX, tensorY, {
      epochs,
      batchSize: Math.min(32, xs.length),
      shuffle: true,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(`[ML] Epoch ${epoch}: loss=${logs.loss.toFixed(4)}, acc=${logs.acc.toFixed(4)}`);
          }
        },
      },
    });

    tensorX.dispose();
    tensorY.dispose();

    const accuracy = result.history.acc[result.history.acc.length - 1];
    const loss = result.history.loss[result.history.loss.length - 1];
    console.log(`[ML] Entraînement terminé: accuracy=${(accuracy * 100).toFixed(1)}%, loss=${loss.toFixed(4)}`);

    await this.saveModel();

    return { trained: true, samples: xs.length, accuracy: accuracy * 100, loss };
  }

  predict(features) {
    if (!this.ready) {
      return { up: 0, down: 0, neutral: 1, source: 'heuristic' };
    }

    const input = tf.tensor2d([features]);
    const output = this.model.predict(input);
    const probs = output.dataSync();
    input.dispose();
    output.dispose();

    return {
      up: probs[0],
      down: probs[1],
      neutral: probs[2],
      source: 'ml',
    };
  }

  async saveModel() {
    try {
      await this.model.save('file://./ml_model');
      console.log('[ML] Modèle sauvegardé');
    } catch (err) {
      console.error('[ML] Échec sauvegarde modèle:', err.message);
    }
  }

  async loadModel() {
    try {
      this.model = await tf.loadLayersModel('file://./ml_model/model.json');
      this.ready = true;
      console.log('[ML] Modèle chargé depuis le disque');
    } catch {
      console.log('[ML] Aucun modèle sauvegardé, création nouveau modèle');
      this.buildModel();
    }
  }

  async retrainIfNeeded() {
    const lastDoc = await db.collection('training_meta').doc('ml').get();
    const lastTrain = lastDoc.exists ? lastDoc.data().lastTrainedAt : null;

    const signalCount = await this.countClosedSignals();
    if (!lastTrain) {
      if (signalCount >= 20) {
        await this.train(30);
        await db.collection('training_meta').doc('ml').set({ lastTrainedAt: new Date().toISOString(), signalCount });
      }
      return;
    }

    const daysSinceTrain = (Date.now() - new Date(lastTrain).getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceTrain >= 1 && signalCount > (lastDoc.data().signalCount || 0) + 20) {
      await this.train(30);
      await db.collection('training_meta').doc('ml').update({
        lastTrainedAt: new Date().toISOString(),
        signalCount,
      });
    }
  }

  async countClosedSignals() {
    const snapshot = await db.collection('signals')
      .where('status', '==', 'closed')
      .get();
    return snapshot.size;
  }

  async init() {
    await this.loadModel();
    this.retrainIfNeeded();
    setInterval(() => this.retrainIfNeeded(), 60 * 60 * 1000);
  }
}

export const mlService = new MLPredictionService();
