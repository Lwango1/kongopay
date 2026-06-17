// Features avancées : GARCH, Wavelet, Fourier

// === GARCH(1,1) Volatility Model ===
export interface GarchResult {
  omega: number;
  alpha: number;
  beta: number;
  conditionalVariance: number[];
  forecast: number;
  logLikelihood: number;
}

export function fitGarch11(returns: number[], maxIter = 500): GarchResult {
  const n = returns.length;
  if (n < 10) {
    const variance = returns.reduce((s, r) => s + r * r, 0) / Math.max(n, 1);
    return { omega: variance * 0.1, alpha: 0.1, beta: 0.8, conditionalVariance: [variance], forecast: variance, logLikelihood: 0 };
  }

  const initialVariance = returns.reduce((s, r) => s + r * r, 0) / n;
  let omega = initialVariance * 0.1;
  let alpha = 0.1;
  let beta = 0.8;

  // MLE via gradient descent
  let prevLikelihood = -Infinity;
  for (let iter = 0; iter < maxIter; iter++) {
    const variance = [initialVariance];
    for (let i = 1; i < n; i++) {
      const v = omega + alpha * returns[i - 1] * returns[i - 1] + beta * variance[i - 1];
      variance.push(Math.max(v, 1e-10));
    }

    let likelihood = 0;
    for (let i = 0; i < n; i++) {
      likelihood += -0.5 * Math.log(2 * Math.PI) - 0.5 * Math.log(variance[i]) - 0.5 * returns[i] * returns[i] / variance[i];
    }

    if (likelihood < prevLikelihood + 1e-6 && iter > 10) break;
    prevLikelihood = likelihood;

    // Simple gradient step (numerical approximation)
    const eps = 1e-6;
    const grad = (param: number, paramName: 'omega' | 'alpha' | 'beta') => {
      const p = { omega, alpha, beta, [paramName]: param + eps };
      const v = [initialVariance];
      for (let i = 1; i < n; i++) {
        v.push(Math.max(p.omega + p.alpha * returns[i - 1] * returns[i - 1] + p.beta * v[i - 1], 1e-10));
      }
      let ll = 0;
      for (let i = 0; i < n; i++) {
        ll += -0.5 * Math.log(2 * Math.PI) - 0.5 * Math.log(v[i]) - 0.5 * returns[i] * returns[i] / v[i];
      }
      return (ll - likelihood) / eps;
    };

    const lr = 0.001 / Math.sqrt(iter + 1);
    omega += lr * grad(omega, 'omega');
    alpha = Math.max(0.01, Math.min(alpha + lr * grad(alpha, 'alpha'), 0.99));
    beta = Math.max(0.01, Math.min(beta + lr * grad(beta, 'beta'), 0.99 - alpha));

    omega = Math.max(1e-8, omega);
  }

  // Forecast next variance
  const lastVar = returns.length > 0
    ? (() => {
        let v = initialVariance;
        for (let i = 1; i < n; i++) {
          v = omega + alpha * returns[i - 1] * returns[i - 1] + beta * v;
        }
        return v;
      })()
    : initialVariance;

  const forecast = omega + alpha * returns[returns.length - 1] * returns[returns.length - 1] + beta * lastVar;
  const variance = [initialVariance];
  for (let i = 1; i < n; i++) {
    variance.push(omega + alpha * returns[i - 1] * returns[i - 1] + beta * variance[i - 1]);
  }

  return { omega, alpha, beta, conditionalVariance: variance, forecast, logLikelihood: prevLikelihood };
}

export function garchVolatilityRatio(prices: number[]): number {
  if (prices.length < 30) return 1;
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  const garch = fitGarch11(returns.slice(-100));
  const recentVol = Math.sqrt(garch.forecast);
  const histVol = Math.sqrt(garch.conditionalVariance.reduce((s, v) => s + v, 0) / garch.conditionalVariance.length);
  return histVol > 0 ? recentVol / histVol : 1;
}

// === Wavelet Transform (Haar) for multi-scale spike detection ===
export interface WaveletResult {
  scales: number[][];
  dominantScale: number;
  spikeScore: number;
}

export function haarWavelet(prices: number[], levels: number = 4): WaveletResult {
  const n = prices.length;
  if (n < 4) return { scales: [], dominantScale: 0, spikeScore: 0 };

  let data = [...prices];
  const scales: number[][] = [];

  for (let level = 0; level < Math.min(levels, Math.floor(Math.log2(n))); level++) {
    const half = Math.floor(data.length / 2);
    const approx: number[] = [];
    const detail: number[] = [];

    for (let i = 0; i < half; i++) {
      approx.push((data[2 * i] + data[2 * i + 1]) / 2);
      detail.push((data[2 * i] - data[2 * i + 1]) / 2);
    }

    scales.push(detail);
    data = approx;
  }

  // Find the scale with highest energy (most likely to contain spike pattern)
  let maxEnergy = 0;
  let dominantScale = 0;
  let spikeScore = 0;

  for (let s = 0; s < scales.length; s++) {
    const energy = scales[s].reduce((sum, v) => sum + v * v, 0) / Math.max(scales[s].length, 1);
    if (energy > maxEnergy) {
      maxEnergy = energy;
      dominantScale = s + 1;
    }
  }

  // Spike score based on high-frequency energy ratio
  const totalEnergy = scales.reduce((sum, scale) => sum + scale.reduce((s, v) => s + v * v, 0), 0);
  if (totalEnergy > 0 && scales[0]) {
    const hfEnergy = scales[0].reduce((s, v) => s + v * v, 0);
    spikeScore = hfEnergy / totalEnergy;
  }

  return { scales, dominantScale, spikeScore };
}

export function waveletSpikeIndicator(prices: number[]): number {
  if (prices.length < 8) return 0.5;
  const result = haarWavelet(prices.slice(-64), 4);
  // High spike score + dominant scale 1 or 2 = imminent spike
  if (result.spikeScore > 0.3 && result.dominantScale <= 2) {
    return Math.min(result.spikeScore * 2, 1);
  }
  return 0;
}

// === Fourier Analysis for periodicity ===
export interface FourierResult {
  dominantFreq: number;
  dominantPeriod: number;
  periodicityScore: number;
  spectrum: { freq: number; magnitude: number }[];
}

export function fftPeriodicity(prices: number[]): FourierResult {
  const n = prices.length;
  if (n < 10) {
    return { dominantFreq: 0, dominantPeriod: 0, periodicityScore: 0, spectrum: [] };
  }

  // Detrend
  const mean = prices.reduce((s, v) => s + v, 0) / n;
  const detrended = prices.map(v => v - mean);

  // Simple DFT
  const spectrum: { freq: number; magnitude: number }[] = [];
  let maxMag = 0;
  let dominantFreq = 0;

  for (let k = 1; k < Math.min(Math.floor(n / 2), 50); k++) {
    let real = 0;
    let imag = 0;
    for (let i = 0; i < n; i++) {
      const theta = (2 * Math.PI * k * i) / n;
      real += detrended[i] * Math.cos(theta);
      imag -= detrended[i] * Math.sin(theta);
    }
    const magnitude = Math.sqrt(real * real + imag * imag);
    const freq = k / n;
    spectrum.push({ freq, magnitude });

    if (magnitude > maxMag) {
      maxMag = magnitude;
      dominantFreq = freq;
    }
  }

  const dominantPeriod = dominantFreq > 0 ? Math.round(1 / dominantFreq) : 0;

  // Periodicity score: how much of the signal is explained by dominant frequency
  const totalPower = spectrum.reduce((s, v) => s + v.magnitude, 0);
  const periodicityScore = totalPower > 0 ? maxMag / totalPower : 0;

  return { dominantFreq, dominantPeriod, periodicityScore, spectrum };
}

export function fourierSpikeIndicator(prices: number[]): number {
  if (prices.length < 20) return 0.5;
  const result = fftPeriodicity(prices.slice(-100));

  // If there's strong periodicity matching typical spike intervals (5-30 ticks)
  if (result.periodicityScore > 0.3 && result.dominantPeriod >= 5 && result.dominantPeriod <= 30) {
    return Math.min(result.periodicityScore * 1.5, 1);
  }
  return 0;
}

// === Composite Advanced Feature Score ===
export interface AdvancedFeatures {
  garchVolRatio: number;
  waveletSpikeScore: number;
  fourierSpikeScore: number;
  compositeScore: number;
  dominantPeriod: number;
}

export function computeAdvancedFeatures(prices: number[]): AdvancedFeatures {
  const garchVolRatio = garchVolatilityRatio(prices);
  const waveletSpikeScore = waveletSpikeIndicator(prices);
  const fourierSpikeScore = fourierSpikeIndicator(prices);
  const fourier = fftPeriodicity(prices.slice(-100));

  // Composite: weighted combination
  const compositeScore = Math.min(
    garchVolRatio * 0.3 + waveletSpikeScore * 0.4 + fourierSpikeScore * 0.3,
    1
  );

  return {
    garchVolRatio,
    waveletSpikeScore,
    fourierSpikeScore,
    compositeScore,
    dominantPeriod: fourier.dominantPeriod,
  };
}
