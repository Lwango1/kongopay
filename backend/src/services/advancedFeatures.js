// Features avancées : GARCH, Wavelet, Fourier (version backend)

function fitGarch11(returns, maxIter = 500) {
  const n = returns.length;
  if (n < 10) {
    const variance = returns.reduce((s, r) => s + r * r, 0) / Math.max(n, 1);
    return { omega: variance * 0.1, alpha: 0.1, beta: 0.8, conditionalVariance: [variance], forecast: variance, logLikelihood: 0 };
  }

  const initialVariance = returns.reduce((s, r) => s + r * r, 0) / n;
  let omega = initialVariance * 0.1;
  let alpha = 0.1;
  let beta = 0.8;

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

    const eps = 1e-6;
    const grad = (param, paramName) => {
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

  const lastReturns = returns[returns.length - 1] || 0;
  let lastVar = initialVariance;
  for (let i = 1; i < n; i++) {
    lastVar = omega + alpha * returns[i - 1] * returns[i - 1] + beta * lastVar;
  }
  const forecast = omega + alpha * lastReturns * lastReturns + beta * lastVar;

  const variance = [initialVariance];
  for (let i = 1; i < n; i++) {
    variance.push(omega + alpha * returns[i - 1] * returns[i - 1] + beta * variance[i - 1]);
  }

  return { omega, alpha, beta, conditionalVariance: variance, forecast, logLikelihood: prevLikelihood };
}

function garchVolatilityRatio(prices) {
  if (prices.length < 30) return 1;
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  const garch = fitGarch11(returns.slice(-100));
  const recentVol = Math.sqrt(garch.forecast);
  const avgVar = garch.conditionalVariance.reduce((s, v) => s + v, 0) / garch.conditionalVariance.length;
  const histVol = Math.sqrt(avgVar);
  return histVol > 0 ? recentVol / histVol : 1;
}

function haarWavelet(prices, levels = 4) {
  const n = prices.length;
  if (n < 4) return { scales: [], dominantScale: 0, spikeScore: 0 };

  let data = [...prices];
  const scales = [];

  for (let level = 0; level < Math.min(levels, Math.floor(Math.log2(n))); level++) {
    const half = Math.floor(data.length / 2);
    const approx = [];
    const detail = [];

    for (let i = 0; i < half; i++) {
      approx.push((data[2 * i] + data[2 * i + 1]) / 2);
      detail.push((data[2 * i] - data[2 * i + 1]) / 2);
    }

    scales.push(detail);
    data = approx;
  }

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

  const totalEnergy = scales.reduce((sum, scale) => sum + scale.reduce((s, v) => s + v * v, 0), 0);
  if (totalEnergy > 0 && scales[0]) {
    const hfEnergy = scales[0].reduce((s, v) => s + v * v, 0);
    spikeScore = hfEnergy / totalEnergy;
  }

  return { scales, dominantScale, spikeScore };
}

function waveletSpikeIndicator(prices) {
  if (prices.length < 8) return 0.5;
  const result = haarWavelet(prices.slice(-64), 4);
  if (result.spikeScore > 0.3 && result.dominantScale <= 2) {
    return Math.min(result.spikeScore * 2, 1);
  }
  return 0;
}

function fftPeriodicity(prices) {
  const n = prices.length;
  if (n < 10) {
    return { dominantFreq: 0, dominantPeriod: 0, periodicityScore: 0, spectrum: [] };
  }

  const mean = prices.reduce((s, v) => s + v, 0) / n;
  const detrended = prices.map(v => v - mean);

  const spectrum = [];
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
  const totalPower = spectrum.reduce((s, v) => s + v.magnitude, 0);
  const periodicityScore = totalPower > 0 ? maxMag / totalPower : 0;

  return { dominantFreq, dominantPeriod, periodicityScore, spectrum };
}

function fourierSpikeIndicator(prices) {
  if (prices.length < 20) return 0.5;
  const result = fftPeriodicity(prices.slice(-100));
  if (result.periodicityScore > 0.3 && result.dominantPeriod >= 5 && result.dominantPeriod <= 30) {
    return Math.min(result.periodicityScore * 1.5, 1);
  }
  return 0;
}

export function computeAdvancedFeatures(prices) {
  const garchVolRatio = garchVolatilityRatio(prices);
  const waveletSpikeScore = waveletSpikeIndicator(prices);
  const fourierSpikeScore = fourierSpikeIndicator(prices);
  const fourier = fftPeriodicity(prices.slice(-100));

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
