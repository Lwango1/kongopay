import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { engagementService } from '../services/engagement.js';

const router = Router();

router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const profile = await engagementService.getFullProfile(req.user.uid);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.post('/daily-login', authenticate, async (req, res, next) => {
  try {
    const result = await engagementService.processDailyLogin(req.user.uid);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/missions', authenticate, async (req, res, next) => {
  try {
    const missions = await engagementService.getMissions(req.user.uid);
    res.json(missions);
  } catch (err) {
    next(err);
  }
});

router.post('/missions/:mission', authenticate, async (req, res, next) => {
  try {
    const result = await engagementService.completeMission(req.user.uid, req.params.mission);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/xp/:action', authenticate, async (req, res, next) => {
  try {
    const result = await engagementService.addXp(req.user.uid, req.params.action, req.body?.amount || 0);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/leaderboard', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const board = await engagementService.getLeaderboard(limit);
    res.json(board);
  } catch (err) {
    next(err);
  }
});

export default router;
