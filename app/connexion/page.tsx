"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";

export default function ConnexionPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
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
          <h1 className="text-2xl font-bold text-center mb-6">Connexion</h1>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <label className="text-sm text-text-muted mb-1 block">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
          <p className="text-center text-sm text-text-muted mt-4">
            Pas encore de compte ?{" "}
            <a href="/inscription" className="text-primary hover:underline">
              S&apos;inscrire
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
