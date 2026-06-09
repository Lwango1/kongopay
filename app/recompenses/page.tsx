"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Gift, Flame, Zap, Trophy, Target, CheckCircle, Clock,
  TrendingUp, Users, Star, ChevronRight, LogIn
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

interface EngagementProfile {
  userId: string;
  xp: number;
  level: number;
  title: string;
  streak: number;
  bestStreak: number;
  totalLogins: number;
  totalTrades: number;
  missions: { login: boolean; trade: boolean; visitP2P: boolean };
  loggedInToday: boolean;
  xpProgress: number;
  nextLevel: string | null;
  streakReward: { cdf: number; label: string };
}

interface LeaderboardEntry {
  userId: string;
  xp: number;
  level: number;
  title: string;
  streak: number;
  totalTrades: number;
}

const STREAK_MILESTONES = [1, 2, 3, 4, 5, 7, 14, 21, 30];

const LEVEL_TITLES: Record<number, { icon: string; color: string }> = {
  1: { icon: "🌱", color: "#a0aec0" },
  2: { icon: "🌿", color: "#68d391" },
  3: { icon: "🔥", color: "#f6ad55" },
  4: { icon: "⭐", color: "#fbbf24" },
  5: { icon: "💪", color: "#f59e0b" },
  6: { icon: "👑", color: "#f97316" },
  7: { icon: "💎", color: "#06b6d4" },
  8: { icon: "🌟", color: "#a855f7" },
  9: { icon: "⚡", color: "#ef4444" },
  10: { icon: "👑", color: "#ffd700" },
};

export default function RecompensesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<EngagementProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimError, setClaimError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [p, lb] = await Promise.all([
        apiFetch<EngagementProfile>("/engagement/profile"),
        apiFetch<LeaderboardEntry[]>("/engagement/leaderboard?limit=20"),
      ]);
      setProfile(p);
      setLeaderboard(lb);
      setClaimed(p.loggedInToday);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/connexion"); return; }
    load();
  }, [user, authLoading, router, load]);

  const claimDaily = async () => {
    setClaiming(true);
    setClaimError("");
    try {
      const result = await apiFetch<any>("/engagement/daily-login", { method: "POST" });
      if (result.alreadyClaimed) {
        setClaimed(true);
      } else {
        setClaimed(true);
        await load();
      }
    } catch (err: any) {
      setClaimError(err.message);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="pt-24 min-h-screen">
          <div className="max-w-4xl mx-auto px-4 py-16 space-y-4">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 rounded-xl bg-surface-light animate-pulse" />)}
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const reward = profile?.streakReward;
  const levelIcon = LEVEL_TITLES[profile?.level || 1]?.icon || "🌱";
  const levelColor = LEVEL_TITLES[profile?.level || 1]?.color || "#a0aec0";

  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen">
        <section className="max-w-5xl mx-auto px-4 py-16">
          <div className="flex items-center gap-3 mb-2">
            <Gift className="text-primary" size={28} />
            <h1 className="text-3xl font-bold">Récompenses</h1>
          </div>
          <p className="text-text-secondary mb-8">
            Connecte-toi chaque jour, trade et gagne des récompenses !
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="rounded-xl border border-border bg-surface p-5 text-center">
              <div className="text-4xl mb-2">{levelIcon}</div>
              <p className="text-xs text-text-muted uppercase font-semibold">Niveau</p>
              <p className="text-2xl font-bold mt-1" style={{ color: levelColor }}>{profile?.level || 1}</p>
              <p className="text-sm text-text-secondary">{profile?.title || "Débutant"}</p>
              <div className="mt-3 w-full h-2 rounded-full bg-surface-light overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${profile?.xpProgress || 0}%` }} />
              </div>
              <p className="text-xs text-text-muted mt-1">{profile?.xp || 0} XP</p>
              {profile?.nextLevel && (
                <p className="text-[10px] text-text-muted">Prochain : {profile.nextLevel}</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 text-center">
              <Flame size={24} className="mx-auto mb-2 text-orange-400" />
              <p className="text-xs text-text-muted uppercase font-semibold">Connexions consécutives</p>
              <p className="text-3xl font-bold mt-1 text-orange-400">{profile?.streak || 0}</p>
              <p className="text-xs text-text-muted mt-1">Meilleure série : {profile?.bestStreak || 0}</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 text-center">
              <Target size={24} className="mx-auto mb-2 text-primary" />
              <p className="text-xs text-text-muted uppercase font-semibold">Trades effectués</p>
              <p className="text-3xl font-bold mt-1">{profile?.totalTrades || 0}</p>
              <p className="text-xs text-text-muted mt-1">Connexions : {profile?.totalLogins || 0}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 mb-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Flame size={18} className="text-orange-400" />
              Récompense journalière
            </h2>

            <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-2">
              {STREAK_MILESTONES.map((day) => {
                const isUnlocked = (profile?.streak || 0) >= day;
                const isCurrent = (profile?.streak || 0) === day;
                const r = day <= 7
                  ? { cdf: day * 500, label: `Jour ${day}` }
                  : day === 14 ? { cdf: 5000, label: "14 jours 🔥" }
                  : day === 21 ? { cdf: 7500, label: "21 jours ⚡" }
                  : { cdf: 10000, label: "30 jours 💎" };
                return (
                  <div key={day} className={`flex-shrink-0 w-20 h-24 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all ${isCurrent ? "border-primary bg-primary/10 scale-110" : isUnlocked ? "border-success/30 bg-success/10" : "border-border bg-background opacity-50"}`}>
                    <span className={`text-lg ${isUnlocked ? "" : "grayscale"}`}>
                      {isUnlocked ? "🎁" : "🔒"}
                    </span>
                    <span className="text-[10px] font-semibold">{isUnlocked ? `${r.cdf.toLocaleString()} CDF` : `Jour ${day}`}</span>
                    <span className="text-[8px] text-text-muted">{r.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <div>
                {claimed ? (
                  <p className="text-sm text-success flex items-center gap-2">
                    <CheckCircle size={16} />
                    Récompense d&apos;aujourd&apos;hui réclamée
                  </p>
                ) : (
                  <p className="text-sm text-text-secondary">
                    {reward
                      ? `Réclame ${reward.cdf.toLocaleString()} CDF (${reward.label})`
                      : "Connecte-toi pour réclamer ta récompense"}
                  </p>
                )}
                {claimError && <p className="text-xs text-danger mt-1">{claimError}</p>}
              </div>
              <button
                onClick={claimDaily}
                disabled={claimed || claiming}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${claimed ? "bg-success/20 text-success cursor-default" : "bg-primary hover:bg-primary/90 text-white disabled:opacity-60"}`}
              >
                {claiming ? (
                  "Chargement..."
                ) : claimed ? (
                  <><CheckCircle size={16} /> Réclamé</>
                ) : (
                  <><Gift size={16} /> Réclamer</>
                )}
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="rounded-xl border border-border bg-surface p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Target size={18} className="text-primary" />
                Missions quotidiennes
              </h2>
              <div className="space-y-3">
                <div className={`flex items-center justify-between p-3 rounded-lg border ${profile?.missions?.login ? "border-success/30 bg-success/10" : "border-border bg-background"}`}>
                  <div className="flex items-center gap-3">
                    <LogIn size={16} className={profile?.missions?.login ? "text-success" : "text-text-muted"} />
                    <span className="text-sm">Connexion quotidienne</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">+100 XP</span>
                    {profile?.missions?.login && <CheckCircle size={14} className="text-success" />}
                  </div>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg border ${profile?.missions?.trade ? "border-success/30 bg-success/10" : "border-border bg-background"}`}>
                  <div className="flex items-center gap-3">
                    <TrendingUp size={16} className={profile?.missions?.trade ? "text-success" : "text-text-muted"} />
                    <span className="text-sm">Effectuer un trade</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">+100 XP</span>
                    {profile?.missions?.trade && <CheckCircle size={14} className="text-success" />}
                  </div>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg border ${profile?.missions?.visitP2P ? "border-success/30 bg-success/10" : "border-border bg-background"}`}>
                  <div className="flex items-center gap-3">
                    <Users size={16} className={profile?.missions?.visitP2P ? "text-success" : "text-text-muted"} />
                    <span className="text-sm">Visiter le P2P</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">+100 XP</span>
                    {profile?.missions?.visitP2P && <CheckCircle size={14} className="text-success" />}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-center text-xs text-text-muted">
                {profile?.missions
                  ? `${[profile.missions.login, profile.missions.trade, profile.missions.visitP2P].filter(Boolean).length}/3 missions — Bonus 2 000 CDF si tout est complété`
                  : "Connecte-toi pour voir les missions"}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Trophy size={18} className="text-warning" />
                Classement des traders
              </h2>
              {leaderboard.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-8">Aucun trader pour le moment</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.slice(0, 10).map((entry, i) => {
                    const isMe = entry.userId === user?.uid;
                    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
                    return (
                      <div key={entry.userId} className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-sm ${isMe ? "bg-primary/10 border border-primary/30" : ""}`}>
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-center text-xs font-bold text-text-muted">{medal}</span>
                          <span className="text-xs">{LEVEL_TITLES[entry.level]?.icon || "🌱"}</span>
                          <span className="text-xs font-medium">{entry.title}</span>
                          {isMe && <span className="text-[9px] text-primary font-bold">(MOI)</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-muted">
                          <span>🔥 {entry.streak}</span>
                          <span className="font-mono">{entry.xp} XP</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface/50 p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Star size={14} className="text-warning" />
              Comment gagner des XP ?
            </h3>
            <div className="grid sm:grid-cols-2 gap-2 text-xs text-text-secondary">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
                <LogIn size={12} className="text-primary" /> Connexion quotidienne : <strong>10 XP</strong>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
                <TrendingUp size={12} className="text-success" /> Trade effectué : <strong>50 XP</strong>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
                <Target size={12} className="text-warning" /> Mission complétée : <strong>100 XP</strong>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
                <Users size={12} className="text-primary" /> Parrainage : <strong>200 XP</strong>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
