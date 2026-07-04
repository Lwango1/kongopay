"use client";

import { useState } from "react";
import { Menu, X, LogOut, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { label: "Accueil", href: "/" },
  { label: "Récompenses", href: "/recompenses" },
  { label: "Abonnement", href: "/abonnement" },
  { label: "P2P", href: "/p2p" },
  { label: "Portefeuille", href: "/portefeuille" },
  { label: "Performance", href: "/performance" },
  { label: "Blog", href: "/blog" },
  { label: "Apprendre", href: "/apprendre" },
  { label: "À propos", href: "/a-propos" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        </div>
      )}

      {/* Mobile toggle */}
      <button onClick={() => setOpen(true)} className="fixed top-4 left-4 z-30 md:hidden text-text p-2 bg-surface/80 backdrop-blur rounded-lg border border-border">
        <Menu size={22} />
      </button>

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-[260px] bg-surface/95 backdrop-blur-xl border-r border-border transform transition-all duration-300 ease-in-out ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-border">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">K</div>
            <span className="font-bold text-lg">KongoPay</span>
          </a>
          <button onClick={() => setOpen(false)} className="md:hidden text-text p-1">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text hover:bg-surface-light transition-colors"
            >
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <hr className="border-border mx-3" />

        {/* User area */}
        <div className="px-3 py-4 space-y-1">
          {loading ? null : user ? (
            <>
              <a href="/portefeuille" onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text hover:bg-surface-light transition-colors"
              >
                <User size={16} />
                <span className="truncate max-w-[140px]">{user.displayName || user.email}</span>
              </a>
              <button onClick={() => { handleLogout(); setOpen(false); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-danger hover:text-danger/80 hover:bg-surface-light transition-colors"
              >
                <LogOut size={16} />
                <span>Quitter</span>
              </button>
            </>
          ) : (
            <>
              <a href="/connexion" onClick={() => setOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text hover:bg-surface-light transition-colors"
              >
                Connexion
              </a>
              <a href="/inscription" onClick={() => setOpen(false)}
                className="block text-sm bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg font-medium text-center transition-colors mt-2"
              >
                S&apos;inscrire
              </a>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
