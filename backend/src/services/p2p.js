import { db, admin } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

const OFFERS_COLLECTION = 'p2p_offers';
const TRADES_COLLECTION = 'p2p_trades';
const MESSAGES_COLLECTION = 'p2p_messages';
const CHATS_COLLECTION = 'p2p_chats';

const ADMIN_UID = process.env.P2P_ADMIN_UID || '';

export class P2PService {
  async createOffer({ userId, type, crypto, fiatAmount, cryptoAmount, pricePerUnit, paymentMethod, minAmount, maxAmount }) {
    const id = uuidv4().slice(0, 8).toUpperCase();
    const offer = {
      id: `P2P-${id}`,
      userId,
      type,
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

  async getAdminPaymentDetails() {
    return {
      airtelMoney: process.env.AIRTEL_MONEY_NUMBER || '',
      orangeMoney: process.env.ORANGE_MONEY_NUMBER || '',
      mpesa: process.env.MPESA_NUMBER || '',
      binanceWallet: process.env.P2P_ADMIN_BINANCE_WALLET || '',
    };
  }

  async placeOrder({ offerId, buyerId, buyerName, amount }) {
    const offerRef = db.collection(OFFERS_COLLECTION).doc(offerId);
    const offerDoc = await offerRef.get();

    if (!offerDoc.exists) throw Object.assign(new Error('Annonce introuvable'), { status: 404 });
    const offer = offerDoc.data();
    if (offer.status !== 'active') throw Object.assign(new Error('Annonce plus disponible'), { status: 400 });
    if (amount < offer.minAmount || amount > offer.maxAmount) {
      throw Object.assign(new Error(`Montant doit être entre ${offer.minAmount} et ${offer.maxAmount} CDF`), { status: 400 });
    }

    const cryptoAmount = parseFloat((amount / offer.pricePerUnit).toFixed(6));
    const id = uuidv4().slice(0, 8).toUpperCase();

    const trade = {
      id: `TRADE-${id}`,
      offerId,
      buyerId,
      buyerName,
      sellerId: ADMIN_UID,
      type: offer.type,
      crypto: offer.crypto,
      fiatAmount: amount,
      cryptoAmount,
      pricePerUnit: offer.pricePerUnit,
      paymentMethod: offer.paymentMethod,
      status: 'awaiting_payment',
      transactionId: null,
      buyerPaymentMethod: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection(TRADES_COLLECTION).doc(trade.id).set(trade);

    await this._addSystemMessage(trade.id,
      `Ordre créé. ${offer.type === 'sell' ? 'Envoie le paiement à l\'administrateur pour recevoir ' + offer.crypto : 'Envoie ' + offer.crypto + ' à l\'administrateur pour recevoir le paiement'}.`
    );

    const paymentDetails = await this.getAdminPaymentDetails();
    return { trade, paymentDetails };
  }

  async getTrade(tradeId) {
    const doc = await db.collection(TRADES_COLLECTION).doc(tradeId).get();
    if (!doc.exists) throw Object.assign(new Error('Transaction introuvable'), { status: 404 });
    return doc.data();
  }

  async getUserTrades(userId) {
    const snapshot = await db.collection(TRADES_COLLECTION)
      .where('buyerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  async getAllTrades() {
    const snapshot = await db.collection(TRADES_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  async sendMessage(tradeId, senderId, senderName, content) {
    const trade = await this.getTrade(tradeId);
    if (trade.buyerId !== senderId && trade.sellerId !== senderId) {
      throw Object.assign(new Error('Non autorisé'), { status: 403 });
    }

    const message = {
      id: uuidv4(),
      tradeId,
      senderId,
      senderName,
      content,
      type: 'text',
      createdAt: new Date().toISOString(),
    };

    await db.collection(MESSAGES_COLLECTION).doc(message.id).set(message);
    await db.collection(TRADES_COLLECTION).doc(tradeId).update({ updatedAt: new Date().toISOString() });

    return message;
  }

  async getMessages(tradeId) {
    const snapshot = await db.collection(MESSAGES_COLLECTION)
      .where('tradeId', '==', tradeId)
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  async _addSystemMessage(tradeId, content) {
    const message = {
      id: uuidv4(),
      tradeId,
      senderId: 'system',
      senderName: 'Système',
      content,
      type: 'system',
      createdAt: new Date().toISOString(),
    };
    await db.collection(MESSAGES_COLLECTION).doc(message.id).set(message);
  }

  async confirmPayment(tradeId, userId, transactionId, paymentMethod) {
    const trade = await this.getTrade(tradeId);
    if (trade.buyerId !== userId) throw Object.assign(new Error('Non autorisé'), { status: 403 });
    if (trade.status !== 'awaiting_payment') throw Object.assign(new Error('Action non disponible'), { status: 400 });

    await db.collection(TRADES_COLLECTION).doc(tradeId).update({
      status: 'paid',
      transactionId,
      buyerPaymentMethod: paymentMethod,
      updatedAt: new Date().toISOString(),
    });

    await this._addSystemMessage(tradeId,
      `Paiement confirmé (ID: ${transactionId}). En attente de validation par l'administrateur.`
    );

    return { message: 'Paiement confirmé, en attente de validation' };
  }

  async releaseFunds(tradeId, adminId) {
    if (adminId !== ADMIN_UID) throw Object.assign(new Error('Non autorisé'), { status: 403 });

    const trade = await this.getTrade(tradeId);
    if (trade.status !== 'paid') throw Object.assign(new Error('Le paiement n\'a pas encore été confirmé'), { status: 400 });

    await db.collection(TRADES_COLLECTION).doc(tradeId).update({
      status: 'completed',
      updatedAt: new Date().toISOString(),
    });

    await this._addSystemMessage(tradeId, 'Transaction complétée. Fonds libérés.');

    return { message: 'Fonds libérés avec succès' };
  }

  async cancelTrade(tradeId, userId) {
    const trade = await this.getTrade(tradeId);
    if (trade.buyerId !== userId && trade.sellerId !== userId) {
      throw Object.assign(new Error('Non autorisé'), { status: 403 });
    }
    if (!['awaiting_payment', 'pending'].includes(trade.status)) {
      throw Object.assign(new Error('Impossible d\'annuler cette transaction'), { status: 400 });
    }

    await db.collection(TRADES_COLLECTION).doc(tradeId).update({
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    });

    await this._addSystemMessage(tradeId, 'Transaction annulée.');

    return { message: 'Transaction annulée' };
  }

  async getOrCreateChat(offerId, userId, userName) {
    const chatId = `CHAT-${offerId}-${userId}`;
    const ref = db.collection(CHATS_COLLECTION).doc(chatId);
    const doc = await ref.get();

    if (doc.exists) return doc.data();

    const offerRef = db.collection(OFFERS_COLLECTION).doc(offerId);
    const offerDoc = await offerRef.get();
    if (!offerDoc.exists) throw Object.assign(new Error('Annonce introuvable'), { status: 404 });
    const offer = offerDoc.data();

    const chat = {
      id: chatId,
      offerId,
      buyerId: userId,
      buyerName: userName,
      sellerId: offer.userId,
      offerType: offer.type,
      offerCrypto: offer.crypto,
      offerPricePerUnit: offer.pricePerUnit,
      offerMinAmount: offer.minAmount,
      offerMaxAmount: offer.maxAmount,
      offerPaymentMethod: offer.paymentMethod,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await ref.set(chat);

    await this._addChatMessage(chatId, 'system', 'Système', 'Conversation ouverte. Discutez avec l\'annonceur avant de passer commande.');

    return chat;
  }

  async getUserChats(userId) {
    const snapshot = await db.collection(CHATS_COLLECTION)
      .where('buyerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  async getChat(chatId) {
    const ref = db.collection(CHATS_COLLECTION).doc(chatId);
    const doc = await ref.get();
    if (!doc.exists) throw Object.assign(new Error('Conversation introuvable'), { status: 404 });
    return doc.data();
  }

  async getAdminChats(adminId) {
    const snapshot = await db.collection(CHATS_COLLECTION)
      .where('sellerId', '==', adminId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  async sendChatMessage(chatId, senderId, senderName, content) {
    const ref = db.collection(CHATS_COLLECTION).doc(chatId);
    const doc = await ref.get();
    if (!doc.exists) throw Object.assign(new Error('Conversation introuvable'), { status: 404 });

    const message = {
      id: uuidv4(),
      chatId,
      senderId,
      senderName,
      content,
      type: 'text',
      createdAt: new Date().toISOString(),
    };

    const messagesRef = db.collection(CHATS_COLLECTION).doc(chatId).collection('messages');
    await messagesRef.doc(message.id).set(message);
    await ref.update({ updatedAt: new Date().toISOString(), lastMessage: content });

    return message;
  }

  async getChatMessages(chatId) {
    const snapshot = await db.collection(CHATS_COLLECTION).doc(chatId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  async _addChatMessage(chatId, senderId, senderName, content) {
    const message = {
      id: uuidv4(),
      chatId,
      senderId,
      senderName,
      content,
      type: 'system',
      createdAt: new Date().toISOString(),
    };
    const messagesRef = db.collection(CHATS_COLLECTION).doc(chatId).collection('messages');
    await messagesRef.doc(message.id).set(message);
  }

  async placeOrderFromChat(chatId, userId, amount) {
    const ref = db.collection(CHATS_COLLECTION).doc(chatId);
    const doc = await ref.get();
    if (!doc.exists) throw Object.assign(new Error('Conversation introuvable'), { status: 404 });

    const chat = doc.data();
    if (chat.buyerId !== userId) throw Object.assign(new Error('Non autorisé'), { status: 403 });

    const result = await this.placeOrder({
      offerId: chat.offerId,
      buyerId: userId,
      buyerName: chat.buyerName,
      amount,
    });

    await ref.update({ status: 'ordered', orderedAt: new Date().toISOString() });
    await this._addChatMessage(chatId, 'system', 'Système', 'Commande placée !');

    return result;
  }
}

export const p2pService = new P2PService();
