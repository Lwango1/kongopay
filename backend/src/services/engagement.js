import { db, admin } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

const ENGAGEMENT_COLLECTION = 'engagement';

const STREAK_REWARDS = {
  1: { cdf: 500, label: 'Jour 1' },
  2: { cdf: 600, label: 'Jour 2' },
  3: { cdf: 800, label: 'Jour 3' },
  4: { cdf: 1000, label: 'Jour 4' },
  5: { cdf: 1500, label: 'Jour 5' },
  6: { cdf: 2000, label: 'Jour 6' },
  7: { cdf: 3000, label: 'Jour 7 🎉' },
  14: { cdf: 5000, label: '14 jours 🔥' },
  21: { cdf: 7500, label: '21 jours ⚡' },
  30: { cdf: 10000, label: '30 jours 💎' },
};

const XP_RULES = {
  login: 10,
  trade: 50,
  dailyMission: 100,
  referral: 200,
};

const LEVELS = [
  { level: 1, xp: 0, title: 'Débutant' },
  { level: 2, xp: 200, title: 'Apprenti Trader' },
  { level: 3, xp: 500, title: 'Trader Actif' },
  { level: 4, xp: 1000, title: 'Trader Confirmé' },
  { level: 5, xp: 2000, title: 'Expert' },
  { level: 6, xp: 3500, title: 'Légende' },
  { level: 7, xp: 5000, title: 'VIP' },
  { level: 8, xp: 10000, title: 'Elite' },
  { level: 9, xp: 20000, title: 'Pro' },
  { level: 10, xp: 50000, title: 'Kongo King 👑' },
];

class EngagementService {
  async getOrCreate(userId) {
    const ref = db.collection(ENGAGEMENT_COLLECTION).doc(userId);
    const doc = await ref.get();
    if (doc.exists) return doc.data();

    const data = {
      userId,
      xp: 0,
      level: 1,
      title: 'Débutant',
      streak: 0,
      lastLoginDate: null,
      bestStreak: 0,
      totalLogins: 0,
      totalTrades: 0,
      todayMissions: { login: false, trade: false, visitP2P: false },
      missionsResetAt: null,
      createdAt: new Date().toISOString(),
    };
    await ref.set(data);
    return data;
  }

  async processDailyLogin(userId) {
    const eng = await this.getOrCreate(userId);
    const today = new Date().toISOString().split('T')[0];
    const lastDate = eng.lastLoginDate;
    const todayDate = today;

    let streak = eng.streak || 0;
    let reward = null;

    if (lastDate === todayDate) {
      return { ...eng, alreadyClaimed: true };
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastDate === yesterdayStr) {
      streak += 1;
    } else if (lastDate !== todayDate) {
      streak = 1;
    }

    const streakData = this.getStreakReward(streak);
    reward = streakData;

    const newXp = (eng.xp || 0) + XP_RULES.login;
    const levelData = this.calculateLevel(newXp);

    const updates = {
      streak,
      lastLoginDate: todayDate,
      totalLogins: admin.firestore.FieldValue.increment(1),
      xp: newXp,
      level: levelData.level,
      title: levelData.title,
      bestStreak: admin.firestore.FieldValue.max(streak),
    };

    await db.collection(ENGAGEMENT_COLLECTION).doc(userId).update(updates);

    if (reward && reward.cdf > 0) {
      const { walletService } = await import('./wallet.js');
      await walletService.creditCdf(userId, reward.cdf, `Récompense journalière - ${streakData.label}`);
    }

    return {
      streak,
      reward,
      xp: newXp,
      level: levelData.level,
      title: levelData.title,
      alreadyClaimed: false,
    };
  }

  getStreakReward(streak) {
    const keys = Object.keys(STREAK_REWARDS).map(Number).sort((a, b) => b - a);
    for (const key of keys) {
      if (streak >= key) return STREAK_REWARDS[key];
    }
    return { cdf: 100, label: `Jour ${streak}` };
  }

  calculateLevel(totalXp) {
    let result = LEVELS[0];
    for (const l of LEVELS) {
      if (totalXp >= l.xp) result = l;
    }
    return result;
  }

  async addXp(userId, action, amount = 0) {
    const rule = XP_RULES[action];
    if (!rule) return;

    const eng = await this.getOrCreate(userId);
    const bonus = action === 'trade' ? Math.min(Math.floor(amount / 100), 200) : 0;
    const totalBonus = rule + bonus;
    const newXp = (eng.xp || 0) + totalBonus;
    const levelData = this.calculateLevel(newXp);

    await db.collection(ENGAGEMENT_COLLECTION).doc(userId).update({
      xp: newXp,
      level: levelData.level,
      title: levelData.title,
      totalTrades: action === 'trade' ? admin.firestore.FieldValue.increment(1) : admin.firestore.FieldValue.increment(0),
    });

    return { xp: newXp, added: totalBonus, level: levelData.level, title: levelData.title };
  }

  async getMissions(userId) {
    const eng = await this.getOrCreate(userId);
    const today = new Date().toISOString().split('T')[0];

    if (eng.missionsResetAt !== today) {
      await db.collection(ENGAGEMENT_COLLECTION).doc(userId).update({
        todayMissions: { login: false, trade: false, visitP2P: false },
        missionsResetAt: today,
      });
      return { login: false, trade: false, visitP2P: false };
    }

    return eng.todayMissions || { login: false, trade: false, visitP2P: false };
  }

  async completeMission(userId, mission) {
    const allowed = ['login', 'trade', 'visitP2P'];
    if (!allowed.includes(mission)) return;

    const eng = await this.getOrCreate(userId);
    const missions = await this.getMissions(userId);
    if (missions[mission]) return { alreadyDone: true };

    const field = `todayMissions.${mission}`;
    await db.collection(ENGAGEMENT_COLLECTION).doc(userId).update({
      [field]: true,
    });

    await this.addXp(userId, 'dailyMission');

    const allDone = { ...missions, [mission]: true };
    const completed = Object.values(allDone).filter(Boolean).length;

    if (completed === 3) {
      const { walletService } = await import('./wallet.js');
      await walletService.creditCdf(userId, 2000, 'Bonus 3 missions quotidiennes complétées');
      return { mission, completed, bonus: 2000 };
    }

    return { mission, completed, bonus: 0 };
  }

  async getLeaderboard(limit = 20) {
    const snapshot = await db.collection(ENGAGEMENT_COLLECTION)
      .orderBy('xp', 'desc')
      .limit(limit)
      .get();

    const list = snapshot.docs.map(d => {
      const data = d.data();
      return {
        userId: data.userId,
        xp: data.xp || 0,
        level: data.level || 1,
        title: data.title || 'Débutant',
        streak: data.streak || 0,
        totalTrades: data.totalTrades || 0,
      };
    });

    return list;
  }

  async getFullProfile(userId) {
    const eng = await this.getOrCreate(userId);
    const missions = await this.getMissions(userId);
    const today = new Date().toISOString().split('T')[0];
    const loggedInToday = eng.lastLoginDate === today;

    const nextLevel = LEVELS.find(l => l.level === (eng.level || 1) + 1) || null;
    const xpForCurrent = LEVELS.find(l => l.level === (eng.level || 1))?.xp || 0;
    const xpForNext = nextLevel?.xp || xpForCurrent + 1000;
    const progress = xpForNext > xpForCurrent
      ? Math.min(((eng.xp || 0) - xpForCurrent) / (xpForNext - xpForCurrent) * 100, 100)
      : 0;

    return {
      ...eng,
      missions,
      loggedInToday,
      xpProgress: Math.round(progress),
      nextLevel: nextLevel?.title || null,
      streakReward: this.getStreakReward(eng.streak || 0),
    };
  }
}

export const engagementService = new EngagementService();
