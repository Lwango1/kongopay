"use client";

import { useState } from "react";
import { Menu, X, LogOut, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { label: "Accueil", href: "/" },
  { label: "Récompenses", href: "/recompenses" },
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
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(!open)} className="md:hidden text-text p-2">
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
            <a href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">K</div>
              <span className="font-bold text-lg">KongoPay</span>
            </a>
            <nav className="hidden md:flex items-center gap-6">
              {NAV_ITEMS.map((item) => (
                <a key={item.href} href={item.href} className="text-sm text-text-secondary hover:text-text transition-colors">{item.label}</a>
              ))}
            </nav>
          </div>
          <div className="hidden md:flex items-center gap-3">
            {loading ? null : user ? (
              <>
                <a href="/portefeuille" className="flex items-center gap-2 text-sm text-text-secondary hover:text-text transition-colors px-4 py-2">
                  <User size={16} />
                  <span className="max-w-[120px] truncate">{user.displayName || user.email}</span>
                </a>
                <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors px-3 py-2">
                  <LogOut size={14} />
                  Quitter
                </button>
              </>
            ) : (
              <>
                <a href="/connexion" className="text-sm text-text-secondary hover:text-text transition-colors px-4 py-2">Connexion</a>
                <a href="/inscription" className="text-sm bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg font-medium transition-colors">S&apos;inscrire</a>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 left-0 z-50 h-full w-72 bg-surface/95 backdrop-blur-xl border-r border-border transform transition-transform duration-300 ease-in-out md:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 h-16 border-b border-border">
          <span className="font-bold">Menu</span>
          <button onClick={() => setOpen(false)} className="text-text p-2">
            <X size={24} />
          </button>
        </div>
        <div className="px-4 py-4 space-y-3">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="block text-sm text-text-secondary hover:text-text py-2">{item.label}</a>
          ))}
          <hr className="border-border" />
          {user ? (
            <button onClick={() => { handleLogout(); setOpen(false); }} className="block w-full text-left text-sm text-danger hover:text-danger/80 py-2">Déconnexion</button>
          ) : (
            <>
              <a href="/connexion" onClick={() => setOpen(false)} className="block text-sm text-text-secondary hover:text-text py-2">Connexion</a>
              <a href="/inscription" onClick={() => setOpen(false)} className="block text-sm bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg font-medium text-center">S&apos;inscrire</a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
