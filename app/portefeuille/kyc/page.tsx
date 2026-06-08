"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, CheckCircle, XCircle, Clock, Upload } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

interface KYCStatus {
  status: "not_submitted" | "pending" | "approved" | "rejected";
  fullName?: string;
  idType?: string;
  idNumber?: string;
  reason?: string;
}

const ID_TYPES = [
  { value: "passport", label: "Passeport" },
  { value: "national_id", label: "Carte d'identité nationale" },
  { value: "drivers_license", label: "Permis de conduire" },
];

export default function KYCPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [kyc, setKyc] = useState<KYCStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [idType, setIdType] = useState("passport");
  const [idNumber, setIdNumber] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/connexion"); return; }

    const load = async () => {
      try {
        const data = await apiFetch<KYCStatus>("/kyc/status");
        setKyc(data);
        if (data.fullName) setFullName(data.fullName);
        if (data.idType) setIdType(data.idType);
        if (data.idNumber) setIdNumber(data.idNumber);
      } catch { /* no kyc yet */ }
      finally { setLoading(false); }
    };
    load();
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await apiFetch<KYCStatus>("/kyc/submit", {
        method: "POST",
        body: JSON.stringify({ fullName, dateOfBirth, idType, idNumber, address }),
      });
      setKyc({ status: "pending" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <>
        <Header />
        <main className="pt-24 min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-text-muted">Chargement...</div>
        </main>
        <Footer />
      </>
    );
  }

  const statusConfig = {
    not_submitted: { icon: Shield, color: "text-text-muted", bg: "bg-surface", label: "Non soumis" },
    pending: { icon: Clock, color: "text-warning", bg: "bg-warning/10 border-warning/30", label: "En attente de vérification" },
    approved: { icon: CheckCircle, color: "text-success", bg: "bg-success/10 border-success/30", label: "Vérifié" },
    rejected: { icon: XCircle, color: "text-danger", bg: "bg-danger/10 border-danger/30", label: "Rejeté" },
  };

  const cfg = kyc ? statusConfig[kyc.status] : statusConfig.not_submitted;
  const Icon = cfg.icon;

  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen">
        <section className="max-w-2xl mx-auto px-4 py-16">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="text-primary" size={28} />
            <h1 className="text-3xl font-bold">Vérification KYC</h1>
          </div>
          <p className="text-text-secondary mb-8">
            Conformité réglementaire — veuillez vérifier votre identité pour débloquer toutes les fonctionnalités.
          </p>

          {kyc && (
            <div className={`rounded-xl border p-5 mb-8 ${cfg.bg}`}>
              <div className="flex items-center gap-3">
                <Icon size={24} className={cfg.color} />
                <div>
                  <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
                  {kyc.status === "rejected" && kyc.reason && (
                    <p className="text-sm text-text-secondary mt-1">Raison : {kyc.reason}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {(!kyc || kyc.status === "not_submitted" || kyc.status === "rejected") && (
            <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">{error}</div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs text-text-muted mb-1 block">Nom complet (tel que sur la pièce)</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
                    placeholder="Jean Dupont" required />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Date de naissance</label>
                  <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary" required />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Nationalité</label>
                  <input type="text" value="République Démocratique du Congo" disabled
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-muted outline-none cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Type de pièce</label>
                  <select value={idType} onChange={(e) => setIdType(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary">
                    {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Numéro de pièce</label>
                  <input type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
                    placeholder="Numéro d'identification" required />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-text-muted mb-1 block">Adresse (optionnel)</label>
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary resize-none"
                    placeholder="Votre adresse complète" />
                </div>
              </div>

              <button type="submit" disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                <Upload size={16} />
                {submitting ? "Soumission..." : "Soumettre ma demande KYC"}
              </button>
            </form>
          )}

          {kyc?.status === "approved" && (
            <div className="rounded-xl border border-success/30 bg-success/10 p-6 text-center">
              <CheckCircle size={48} className="mx-auto mb-3 text-success" />
              <h2 className="text-xl font-bold text-success mb-2">Identité vérifiée</h2>
              <p className="text-text-secondary">Vous avez accès à toutes les fonctionnalités de KongoPay.</p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
