import { auth } from '../config/firebase.js';

const ADMIN_UID = process.env.ADMIN_UID || '';

async function ensureAdminClaims(uid) {
  if (!ADMIN_UID || uid !== ADMIN_UID) return;
  try {
    const user = await auth.getUser(uid);
    const claims = user.customClaims || {};
    if (!claims.admin) {
      await auth.setCustomUserClaims(uid, { admin: true });
      console.log(`Admin claims granted to ${uid}`);
    }
  } catch (err) {
    console.error('Failed to set admin claims:', err.message);
  }
}

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token requis' });
    }
    const token = header.split(' ')[1];
    const decoded = await auth.verifyIdToken(token);
    req.user = decoded;
    await ensureAdminClaims(decoded.uid);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const user = await auth.getUser(req.user.uid);
    const claims = user.customClaims || {};
    if (!claims.admin) {
      return res.status(403).json({ error: 'Accès admin requis' });
    }
    next();
  } catch {
    res.status(403).json({ error: 'Accès refusé' });
  }
}
