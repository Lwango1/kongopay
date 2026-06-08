import { db } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

const OFFERS_COLLECTION = 'p2p_offers';

export class P2PService {
  async createOffer({ userId, type, crypto, fiatAmount, cryptoAmount, pricePerUnit, paymentMethod, minAmount, maxAmount }) {
    const id = uuidv4().slice(0, 8).toUpperCase();
    const offer = {
      id: `P2P-${id}`,
      userId,
      type, // 'buy' or 'sell'
      crypto,
      fiatAmount,
      cryptoAmount,
      pricePerUnit,
      paymentMethod,
      minAmount: minAmount || fiatAmount * 0.1,
      maxAmount: maxAmount || fiatAmount,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection(OFFERS_COLLECTION).doc(offer.id).set(offer);
    return offer;
  }

  async getActiveOffers(type = null, crypto = null) {
    let query = db.collection(OFFERS_COLLECTION).where('status', '==', 'active');

    if (type) query = query.where('type', '==', type);
    if (crypto) query = query.where('crypto', '==', crypto);

    const snapshot = await query.orderBy('createdAt', 'desc').limit(50).get();
    return snapshot.docs.map(d => d.data());
  }

  async getMyOffers(userId) {
    const snapshot = await db.collection(OFFERS_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  async cancelOffer(offerId, userId) {
    const ref = db.collection(OFFERS_COLLECTION).doc(offerId);
    const doc = await ref.get();
    if (!doc.exists) throw Object.assign(new Error('Annonce introuvable'), { status: 404 });
    if (doc.data().userId !== userId) throw Object.assign(new Error('Non autorisé'), { status: 403 });
    await ref.update({ status: 'cancelled', updatedAt: new Date().toISOString() });
    return { message: 'Annonce annulée' };
  }
}

export const p2pService = new P2PService();
