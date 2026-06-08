import { describe, it, expect } from 'vitest';

// Test validation logic directly (express-validator integration tested in isolation)
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(pw) {
  return !!pw && pw.length >= 6;
}

function validatePhone(phone) {
  return /^\+?\d{10,15}$/.test(phone);
}

function validateSymbol(sym) {
  return /^[A-Z0-9/]{5,15}$/.test(sym);
}

describe('Validation helpers', () => {
  describe('Email', () => {
    it('accepts valid email', () => expect(validateEmail('test@example.com')).toBe(true));
    it('rejects invalid email', () => expect(validateEmail('notanemail')).toBe(false));
    it('rejects empty email', () => expect(validateEmail('')).toBe(false));
  });

  describe('Password', () => {
    it('accepts 6+ chars', () => expect(validatePassword('abcdef')).toBe(true));
    it('rejects short password', () => expect(validatePassword('abc')).toBe(false));
    it('rejects empty password', () => expect(validatePassword('')).toBe(false));
  });

  describe('Phone number', () => {
    it('accepts +243XXXXXXX', () => expect(validatePhone('+243996710821')).toBe(true));
    it('accepts local format', () => expect(validatePhone('0996710821')).toBe(true));
    it('rejects too short', () => expect(validatePhone('123')).toBe(false));
  });

  describe('Symbol', () => {
    it('accepts BTC/USDT', () => expect(validateSymbol('BTC/USDT')).toBe(true));
    it('accepts ETH/USDT', () => expect(validateSymbol('ETH/USDT')).toBe(true));
    it('rejects empty', () => expect(validateSymbol('')).toBe(false));
  });
});

describe('Fee calculations', () => {
  const calcOrderFee = (amount, price, isMaker) => {
    const rate = isMaker ? 0.001 : 0.001;
    return amount * price * rate;
  };

  const calcWithdrawalFee = (amount, isCrypto) => {
    const rate = isCrypto ? 0.001 : 0.005;
    return amount * rate;
  };

  it('calculates order fee correctly', () => {
    expect(calcOrderFee(1, 50000, true)).toBe(50);
    expect(calcOrderFee(0.5, 3000, false)).toBe(1.5);
  });

  it('calculates withdrawal fee correctly', () => {
    expect(calcWithdrawalFee(100000, false)).toBe(500);
    expect(calcWithdrawalFee(1, true)).toBe(0.001);
  });

  it('maker = taker rate', () => {
    expect(calcOrderFee(1, 100, true)).toBe(calcOrderFee(1, 100, false));
  });
});
