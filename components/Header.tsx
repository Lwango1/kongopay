"use client";

import { useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";

const NAV_ITEMS = [
  { label: "Accueil", href: "/" },
  { label: "Marchés", href: "/marches" },
  { label: "P2P", href: "/p2p" },
  { label: "Portefeuille", href: "/portefeuille" },
  { label: "Apprendre", href: "/apprendre" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
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
            <a href="/connexion" className="text-sm text-text-secondary hover:text-text transition-colors px-4 py-2">Connexion</a>
            <a href="/inscription" className="text-sm bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg font-medium transition-colors">S&apos;inscrire</a>
          </div>
          <button onClick={() => setOpen(!open)} className="md:hidden text-text p-2">
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-surface/95 backdrop-blur-xl">
          <div className="px-4 py-4 space-y-3">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href} className="block text-sm text-text-secondary hover:text-text py-2">{item.label}</a>
            ))}
            <hr className="border-border" />
            <a href="/connexion" className="block text-sm text-text-secondary hover:text-text py-2">Connexion</a>
            <a href="/inscription" className="block text-sm bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg font-medium text-center">S&apos;inscrire</a>
          </div>
        </div>
      )}
    </header>
  );
}
