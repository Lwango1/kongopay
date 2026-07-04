const RATE_CDF_USDT = 2600;

export function cdfToUsdt(cdf: number): number {
  return cdf / RATE_CDF_USDT;
}

export function usdtToCdf(usdt: number): number {
  return usdt * RATE_CDF_USDT;
}

export function formatCdf(cdf: number): string {
  return `${cdf.toLocaleString()} CDF`;
}

export function formatUsdt(usdt: number): string {
  return `${usdt.toFixed(2)} USDT`;
}

export function formatCdfWithUsdt(cdf: number): string {
  return `${formatCdf(cdf)} (~${formatUsdt(cdfToUsdt(cdf))})`;
}
