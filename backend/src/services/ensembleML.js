import * as tf from '@tensorflow/tfjs';
import { db } from '../config/firebase.js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'models');

const FEATURE_NAMES = [
  'rsi', 'atr_ratio', 'volume', 'price_position',
  'consecutive_moves', 'time_since_spike', 'momentum',
  'sr_distance', 'mfi', 'macd_histogram',
  'bollinger_bandwidth', 'adx', 'trend_strength',
  'vwap_distance', 'stoch_rsi',
];
const INPUT_SIZE = FEATURE_NAMES.length;

class EnsembleMLService {
  constructor() {
    this.models = [];
    this.modelWeights = [1, 1, 1];
    this.ready = false;
    this.performanceHistory = [];
  }

  async init() {
    if (!fs.existsSync(MODELS_DIR)) {
      fs.mkdirSync(MODELS_DIR, { recursive: true });
    }
    await this.loadModels();
    this.ready = this.models.length > 0;
    if (!this.ready) {
      this.buildModels();
    }
  }

  buildModels() {
    this.models = [this.buildNNModel(), this.buildWideModel(), this.buildDeepModel()];
    this.ready = true;
  }

  buildNNModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({
      inputShape: [INPUT_SIZE],
      units: 16,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
    }));
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 3, activation: 'softmax' }));
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });
    return model;
  }

  buildWideModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({
      inputShape: [INPUT_SIZE],
      units: 32,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.0005 }),
    }));
    model.add(tf.layers.dense({ units: 3, activation: 'softmax' }));
    model.compile({
      optimizer: tf.train.adamax(0.002),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });
    return model;
  }

  buildDeepModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({
      inputShape: [INPUT_SIZE],
      units: 24,
      activation: 'selu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.0001 }),
    }));
    model.add(tf.layers.alphaDropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 16, activation: 'selu' }));
    model.add(tf.layers.alphaDropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 8, activation: 'selu' }));
    model.add(tf.layers.dense({ units: 3, activation: 'softmax' }));
    model.compile({
      optimizer: tf.train.rmsprop(0.0005),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });
    return model;
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
      signal.bollingerBandwidth || 0.5,
      signal.adx ? signal.adx / 100 : 0.5,
      signal.trendStrength ? (signal.trendStrength + 100) / 200 : 0.5,
      signal.vwapDistance || 0.5,
      signal.stochRsi ? signal.stochRsi / 100 : 0.5,
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
    if (this.models.length === 0) this.buildModels();
    const { xs, ys } = await this.collectTrainingData();

    if (xs.length < 15) {
      console.log(`[EnsembleML] Pas assez de données: ${xs.length} échantillons (min 15)`);
      return { trained: false, samples: xs.length };
    }

    const tensorX = tf.tensor2d(xs);
    const tensorY = tf.tensor2d(ys);

    const results = [];
    for (let i = 0; i < this.models.length; i++) {
      const model = this.models[i];
      try {
        const result = await model.fit(tensorX, tensorY, {
          epochs,
          batchSize: Math.min(16, xs.length),
          shuffle: true,
          validationSplit: 0.2,
          callbacks: {
            onEpochEnd: (epoch, logs) => {
              if (epoch % 10 === 0) {
                console.log(`[EnsembleML-Model${i}] Epoch ${epoch}: loss=${logs.loss.toFixed(4)}, acc=${logs.acc.toFixed(4)}`);
              }
            },
          },
        });
        const accuracy = result.history.acc[result.history.acc.length - 1];
        results.push(accuracy);
      } catch (err) {
        console.error(`[EnsembleML-Model${i}] Train error:`, err.message);
        results.push(0);
      }
    }

    tensorX.dispose();
    tensorY.dispose();

    for (let i = 0; i < results.length; i++) {
      this.modelWeights[i] = Math.max(0.1, results[i]);
    }

    this.performanceHistory.push({
      timestamp: new Date().toISOString(),
      accuracies: results,
      samples: xs.length,
    });

    await this.saveModels();

    const avgAccuracy = results.reduce((a, b) => a + b, 0) / results.length;
    console.log(`[EnsembleML] Entraînement terminé: accuracy moyenne=${(avgAccuracy * 100).toFixed(1)}%, samples=${xs.length}`);

    return { trained: true, samples: xs.length, accuracies: results, avgAccuracy: avgAccuracy * 100 };
  }

  predict(features) {
    if (!this.ready || this.models.length === 0) {
      return { up: 0, down: 0, neutral: 1, source: 'heuristic', confidence: 0 };
    }

    const input = tf.tensor2d([features]);
    const predictions = [];
    let totalWeight = 0;

    for (let i = 0; i < this.models.length; i++) {
      try {
        const output = this.models[i].predict(input);
        const probs = output.dataSync();
        const weight = this.modelWeights[i] || 1;
        predictions.push({ probs: Array.from(probs), weight });
        totalWeight += weight;
        output.dispose();
      } catch {
        predictions.push({ probs: [0.33, 0.33, 0.34], weight: 0.1 });
        totalWeight += 0.1;
      }
    }

    input.dispose();

    if (totalWeight === 0) {
      return { up: 0, down: 0, neutral: 1, source: 'heuristic', confidence: 0 };
    }

    const weightedAvg = [0, 0, 0];
    for (const pred of predictions) {
      for (let j = 0; j < 3; j++) {
        weightedAvg[j] += pred.probs[j] * pred.weight;
      }
    }
    for (let j = 0; j < 3; j++) {
      weightedAvg[j] /= totalWeight;
    }

    const maxProb = Math.max(...weightedAvg);
    const sumProbs = weightedAvg.reduce((a, b) => a + b, 0);

    return {
      up: weightedAvg[0] / sumProbs,
      down: weightedAvg[1] / sumProbs,
      neutral: weightedAvg[2] / sumProbs,
      source: 'ensemble_ml',
      confidence: maxProb,
      modelPredictions: predictions.map(p => p.probs),
    };
  }

  async saveModels() {
    if (!fs.existsSync(MODELS_DIR)) {
      fs.mkdirSync(MODELS_DIR, { recursive: true });
    }
    for (let i = 0; i < this.models.length; i++) {
      const modelPath = path.join(MODELS_DIR, `ensemble_model_${i}`);
      try {
        await this.models[i].save(`file://${modelPath}`);
      } catch (err) {
        console.error(`[EnsembleML] Save model ${i} failed:`, err.message);
      }
    }
    fs.writeFileSync(
      path.join(MODELS_DIR, 'weights.json'),
      JSON.stringify({ weights: this.modelWeights, performanceHistory: this.performanceHistory })
    );
    console.log(`[EnsembleML] ${this.models.length} models saved successfully`);
  }

  async loadModels() {
    if (!fs.existsSync(MODELS_DIR)) return false;

    let loaded = 0;
    for (let i = 0; i < 3; i++) {
      const modelPath = path.join(MODELS_DIR, `ensemble_model_${i}`);
      if (fs.existsSync(path.join(modelPath, 'model.json'))) {
        try {
          const model = await tf.loadLayersModel(`file://${path.join(modelPath, 'model.json')}`);
          this.models.push(model);
          loaded++;
        } catch (err) {
          console.error(`[EnsembleML] Load model ${i} failed:`, err.message);
        }
      }
    }

    const weightsPath = path.join(MODELS_DIR, 'weights.json');
    if (fs.existsSync(weightsPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));
        this.modelWeights = meta.weights || [1, 1, 1];
        this.performanceHistory = meta.performanceHistory || [];
      } catch { }
    }

    this.ready = loaded > 0;
    return loaded > 0;
  }

  async retrainIfNeeded() {
    const lastDoc = await db.collection('training_meta').doc('ensemble_ml').get();
    const lastTrain = lastDoc.exists ? lastDoc.data().lastTrainedAt : null;
    const signalCount = await this.countClosedSignals();

    if (!lastTrain) {
      if (signalCount >= 20) {
        await this.train(30);
        await db.collection('training_meta').doc('ensemble_ml').set({
          lastTrainedAt: new Date().toISOString(), signalCount,
        });
      }
      return;
    }

    const daysSinceTrain = (Date.now() - new Date(lastTrain).getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceTrain >= 0.5 && signalCount > (lastDoc.data().signalCount || 0) + 15) {
      await this.train(30);
      await db.collection('training_meta').doc('ensemble_ml').update({
        lastTrainedAt: new Date().toISOString(), signalCount,
      });
    }
  }

  async countClosedSignals() {
    const snapshot = await db.collection('signals')
      .where('status', '==', 'closed')
      .get();
    return snapshot.size;
  }
}

export const ensembleML = new EnsembleMLService();
