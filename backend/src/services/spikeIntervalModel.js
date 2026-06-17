// Modélisation statistique des intervalles inter-spikes (loi de Weibull)
// Version JS pour le backend Express

function gamma(z) {
  if (z < 0.5) {
    return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  }
  z -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

function weibullMLE(intervals) {
  const n = intervals.length;
  if (n < 3) return { shape: 1, scale: intervals.reduce((a, b) => a + b, 0) / n || 1 };

  const mean = intervals.reduce((a, b) => a + b, 0) / n;
  const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const cv = Math.sqrt(variance) / mean;
  let shape = Math.pow(cv, -1.086);
  shape = Math.max(0.5, Math.min(shape, 10));

  let iter = 0;
  const maxIter = 50;
  const tol = 1e-6;
  while (iter < maxIter) {
    const sumLog = intervals.reduce((s, v) => s + Math.log(v), 0);
    const sumPow = intervals.reduce((s, v) => s + Math.pow(v, shape), 0);
    const sumPowLog = intervals.reduce((s, v) => s + Math.pow(v, shape) * Math.log(v), 0);

    const dL_dk = n / shape + sumLog - (n * sumPowLog) / sumPow;
    const d2L_dk2 = -n / (shape * shape) - n * (sumPow * sumPowLog - sumPowLog * sumPowLog) / (sumPow * sumPow);

    if (Math.abs(d2L_dk2) < 1e-12) break;
    const newShape = shape - dL_dk / d2L_dk2;
    if (Math.abs(newShape - shape) < tol) {
      shape = newShape;
      break;
    }
    shape = Math.max(0.5, Math.min(newShape, 10));
    iter++;
  }

  const sumPow = intervals.reduce((s, v) => s + Math.pow(v, shape), 0);
  const scale = Math.pow(sumPow / n, 1 / shape);

  return { shape, scale };
}

export function fitSpikeIntervals(intervals) {
  if (intervals.length < 2) {
    return { shape: 1, scale: 1, mean: 0, stdDev: 0, sampleSize: intervals.length, ready: false };
  }

  const { shape, scale } = weibullMLE(intervals);
  const mean = scale * gamma(1 + 1 / shape);
  const g2 = gamma(1 + 2 / shape);
  const stdDev = scale * Math.sqrt(g2 - Math.pow(gamma(1 + 1 / shape), 2));

  return { shape, scale, mean, stdDev, sampleSize: intervals.length, ready: true };
}

export function spikeProbability(model, timeSinceLastSpikeMs, horizonMs = 60000) {
  if (!model.ready || model.sampleSize < 2) {
    return Math.min(timeSinceLastSpikeMs / (30 * 60 * 1000), 1);
  }

  const t = Math.max(timeSinceLastSpikeMs / 1000, 0.1);
  const h = horizonMs / 1000;
  const k = model.shape;
  const l = model.scale;

  const S_t = Math.exp(-Math.pow(t / l, k));
  const S_t_plus_h = Math.exp(-Math.pow((t + h) / l, k));

  if (S_t < 1e-10) return 1;

  const condProb = 1 - S_t_plus_h / S_t;
  return Math.min(Math.max(condProb, 0), 1);
}

export function hazardRate(model, timeSinceLastSpikeMs) {
  if (!model.ready) return 0;
  const t = Math.max(timeSinceLastSpikeMs / 1000, 0.1);
  const k = model.shape;
  const l = model.scale;
  return (k / l) * Math.pow(t / l, k - 1);
}
