"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Users, Wallet, CheckCircle, XCircle, Crown, RefreshCw, Loader2, Search } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

interface PendingDeposit {
  id: string;
  userId: string;
  phoneNumber: string;
  operator: string;
  amountCdf: number;
  status: string;
  confirmedAt?: string;
}

interface WalletUser {
  id: string;
  balanceCdf: number;
  balanceUsd: number;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"deposits" | "users" | "subscriptions">("deposits");
  const [deposits, setDeposits] = useState<PendingDeposit[]>([]);
  const [users, setUsers] = useState<WalletUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/connexion"); return; }
    apiFetch<{ isAdmin: boolean }>("/auth/me")
      .then((data) => {
        if (!data.isAdmin) { router.push("/"); return; }
        setIsAdmin(true);
      })
      .catch(() => router.push("/"));
  }, [user, authLoading, router]);

  const fetchDeposits = async () => {
    try {
      const data = await apiFetch<PendingDeposit[]>("/admin/pending-deposits");
      setDeposits(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await apiFetch<WalletUser[]>("/admin/users");
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    if (activeTab === "deposits") fetchDeposits().finally(() => setLoading(false));
    if (activeTab === "users") fetchUsers().finally(() => setLoading(false));
    if (activeTab === "subscriptions") setLoading(false);
  }, [activeTab, isAdmin]);

  const handleApproveDeposit = async (ref: string) => {
    setActionLoading(ref);
    setError("");
    try {
      await apiFetch(`/admin/approve-deposit/${ref}`, { method: "POST" });
      await fetchDeposits();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAdmin) return null;

  const TABS = [
    { key: "deposits", label: "Dépôts en attente", icon: Wallet },
    { key: "users", label: "Utilisateurs", icon: Users },
    { key: "subscriptions", label: "Abonnements", icon: Crown },
  ] as const;

  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen">
        <section className="max-w-5xl mx-auto px-4 py-16">
          <div className="flex items-center gap-3 mb-2">
            <Shield size={28} className="text-primary" />
            <h1 className="text-3xl font-bold">Administration</h1>
          </div>
          <p className="text-text-secondary mb-8">Gérez les dépôts, utilisateurs et abonnements.</p>

          {error && (
            <div className="mb-6 p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger text-sm">{error}</div>
          )}

          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === t.key ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text border border-border"
                }`}>
                <t.icon size={16} />
                {t.label}
              </button>
            ))}
            <button onClick={() => { setError(""); activeTab === "deposits" ? fetchDeposits() : fetchUsers(); }}
              className="p-2 rounded-lg border border-border hover:bg-surface transition-colors ml-auto">
              <RefreshCw size={16} className="text-text-muted" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : activeTab === "deposits" ? (
            deposits.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-12 text-center">
                <CheckCircle size={40} className="mx-auto text-success mb-3" />
                <p className="text-text-muted">Aucun dépôt en attente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deposits.map((d) => (
                  <div key={d.id} className="rounded-xl border border-border bg-surface p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-mono text-sm font-bold">{d.id}</span>
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning">
                          {d.operator}
                        </span>
                      </div>
                      <span className="font-bold font-mono">{d.amountCdf.toLocaleString()} CDF</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-text-secondary">
                      <span>{d.phoneNumber}</span>
                      <span className="text-xs">Utilisateur: {d.userId.slice(0, 12)}...</span>
                    </div>
                    {d.confirmedAt && (
                      <p className="text-[10px] text-text-muted mt-1">
                        Confirmé le {new Date(d.confirmedAt).toLocaleString("fr-FR")}
                      </p>
                    )}
                    <button onClick={() => handleApproveDeposit(d.id)} disabled={actionLoading === d.id}
                      className="mt-3 w-full py-2 rounded-lg bg-success/20 text-success hover:bg-success/30 transition-colors text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50">
                      {actionLoading === d.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      Approuver le dépôt
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "users" ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface">
                  <tr className="text-text-muted text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Utilisateur</th>
                    <th className="text-right px-4 py-3">Solde CDF</th>
                    <th className="text-right px-4 py-3">Solde USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{u.id}</td>
                      <td className="px-4 py-3 text-right font-mono">{u.balanceCdf.toLocaleString()} CDF</td>
                      <td className="px-4 py-3 text-right font-mono">{u.balanceUsd.toFixed(2)} USD</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface p-12 text-center">
              <Crown size={40} className="mx-auto text-warning mb-3" />
              <p className="text-text-muted mb-3">Gestion des abonnements Premium</p>
              <p className="text-xs text-text-secondary">Page en cours de développement</p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
