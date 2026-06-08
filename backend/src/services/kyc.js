import { db } from '../config/firebase.js';

const KYC_COLLECTION = 'kyc_requests';

export class KYCService {
  async submitRequest({ userId, fullName, dateOfBirth, nationality, idType, idNumber, address }) {
    const doc = {
      userId,
      fullName,
      dateOfBirth,
      nationality,
      idType, // 'passport', 'national_id', 'drivers_license'
      idNumber,
      address,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection(KYC_COLLECTION).doc(userId).set(doc);
    return { status: 'pending', message: 'Document KYC soumis, en attente de vérification' };
  }

  async getStatus(userId) {
    const doc = await db.collection(KYC_COLLECTION).doc(userId).get();
    if (!doc.exists) return { status: 'not_submitted' };
    return doc.data();
  }

  async approveRequest(userId, adminId) {
    const ref = db.collection(KYC_COLLECTION).doc(userId);
    const doc = await ref.get();
    if (!doc.exists) throw Object.assign(new Error('Demande KYC introuvable'), { status: 404 });

    await ref.update({
      status: 'approved',
      verifiedBy: adminId,
      verifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { status: 'approved', message: 'KYC approuvé' };
  }

  async rejectRequest(userId, adminId, reason) {
    const ref = db.collection(KYC_COLLECTION).doc(userId);
    const doc = await ref.get();
    if (!doc.exists) throw Object.assign(new Error('Demande KYC introuvable'), { status: 404 });

    await ref.update({
      status: 'rejected',
      reason: reason || 'Documents non conformes',
      reviewedBy: adminId,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { status: 'rejected', message: 'KYC rejeté' };
  }

  async getPendingRequests() {
    const snapshot = await db.collection(KYC_COLLECTION)
      .where('status', '==', 'pending')
      .orderBy('submittedAt', 'asc')
      .get();
    return snapshot.docs.map(d => d.data());
  }
}

export const kycService = new KYCService();
