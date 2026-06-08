"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

export default function InscriptionPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, name);
      // Sync user in backend
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName: name }),
      }).catch(() => {});
      router.push("/portefeuille");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8">
          <h1 className="text-2xl font-bold text-center mb-6">Créer un compte</h1>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-text-muted mb-1 block">Nom complet</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
                placeholder="Jean Dupont"
                required
              />
            </div>
            <div>
              <label className="text-sm text-text-muted mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
                placeholder="exemple@email.com"
                required
              />
            </div>
            <div>
              <label className="text-sm text-text-muted mb-1 block">Téléphone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
                placeholder="+243 XXX XXX XXX"
              />
            </div>
            <div>
              <label className="text-sm text-text-muted mb-1 block">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? "Création..." : "Créer mon compte"}
            </button>
          </form>
          <p className="text-center text-sm text-text-muted mt-4">
            Déjà un compte ?{" "}
            <a href="/connexion" className="text-primary hover:underline">
              Se connecter
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
