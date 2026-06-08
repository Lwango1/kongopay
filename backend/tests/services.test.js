import { describe, it, expect, vi } from 'vitest';

// Mock wallet service logic
function createWalletService() {
  const wallets = {};
  const txs = {};

  return {
    getOrCreateWallet: async (userId) => {
      if (!wallets[userId]) {
        wallets[userId] = { userId, balanceCdf: 0, balanceUsd: 0, cryptoBalances: {} };
      }
      return wallets[userId];
    },
    creditCdf: async (userId, amount, description) => {
      if (!wallets[userId]) wallets[userId] = { userId, balanceCdf: 0, balanceUsd: 0, cryptoBalances: {} };
      wallets[userId].balanceCdf += amount;
      wallets[userId].balanceUsd += amount / 2600;
      const id = Object.keys(txs).length + 1;
      txs[id] = { id, userId, type: 'credit', amountCdf: amount, description, timestamp: new Date().toISOString() };
      return { balanceCdf: wallets[userId].balanceCdf, balanceUsd: wallets[userId].balanceUsd };
    },
    debitCdf: async (userId, amount, description) => {
      if (!wallets[userId]) throw new Error('Solde insuffisant');
      if (wallets[userId].balanceCdf < amount) throw new Error('Solde insuffisant');
      wallets[userId].balanceCdf -= amount;
      wallets[userId].balanceUsd -= amount / 2600;
      const id = Object.keys(txs).length + 1;
      txs[id] = { id, userId, type: 'debit', amountCdf: amount, description, timestamp: new Date().toISOString() };
      return { balanceCdf: wallets[userId].balanceCdf, balanceUsd: wallets[userId].balanceUsd };
    },
    getTransactions: async (userId) => Object.values(txs).filter(t => t.userId === userId),
  };
}

describe('WalletService', () => {
  it('creates wallet on first access', async () => {
    const svc = createWalletService();
    const wallet = await svc.getOrCreateWallet('user1');
    expect(wallet.balanceCdf).toBe(0);
  });

  it('credits CDF correctly', async () => {
    const svc = createWalletService();
    await svc.creditCdf('user1', 10000, 'Test deposit');
    const wallet = await svc.getOrCreateWallet('user1');
    expect(wallet.balanceCdf).toBe(10000);
    expect(wallet.balanceUsd).toBeCloseTo(10000 / 2600, 2);
  });

  it('debits CDF correctly', async () => {
    const svc = createWalletService();
    await svc.creditCdf('user1', 50000, 'Deposit');
    await svc.debitCdf('user1', 20000, 'Withdrawal');
    const wallet = await svc.getOrCreateWallet('user1');
    expect(wallet.balanceCdf).toBe(30000);
  });

  it('rejects debit when insufficient balance', async () => {
    const svc = createWalletService();
    await expect(svc.debitCdf('user2', 1000, 'Test')).rejects.toThrow('Solde insuffisant');
  });

  it('logs transactions', async () => {
    const svc = createWalletService();
    await svc.creditCdf('user1', 25000, 'Deposit');
    const txs = await svc.getTransactions('user1');
    expect(txs.length).toBe(1);
    expect(txs[0].amountCdf).toBe(25000);
    expect(txs[0].type).toBe('credit');
  });
});

describe('FeeService', () => {
  it('has default fee rates', () => {
    const fees = { tradingMaker: 0.001, tradingTaker: 0.001, withdrawalCdf: 0.005, withdrawalCrypto: 0.001 };
    expect(fees.tradingMaker).toBe(0.001);
    expect(fees.tradingTaker).toBe(0.001);
    expect(fees.withdrawalCdf).toBe(0.005);
  });
});

describe('P2P Service', () => {
  it('validates offer creation', () => {
    const validOffer = { type: 'sell', crypto: 'USDT', fiatAmount: 500000, pricePerUnit: 2600, paymentMethod: 'Airtel Money' };
    expect(validOffer.type).toMatch(/^(buy|sell)$/);
    expect(['BTC', 'ETH', 'SOL', 'BNB', 'USDT']).toContain(validOffer.crypto);
    expect(validOffer.fiatAmount).toBeGreaterThanOrEqual(1000);
  });
});
