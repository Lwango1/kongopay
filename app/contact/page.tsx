"use client";

import { useState } from "react";
import { Mail, Phone, MapPin, Clock, Send, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdBanner from "@/components/AdBanner";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    // Simuler envoi (à connecter à un vrai backend)
    await new Promise((r) => setTimeout(r, 1000));
    setSending(false);
    setSent(true);
  };

  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen">
        <section className="max-w-4xl mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold mb-2">Contactez-nous</h1>
          <p className="text-text-secondary mb-10">
            Une question, une suggestion ou un problème ? Notre équipe est là pour vous aider.
          </p>

          <div className="grid md:grid-cols-2 gap-8 mb-10">
            <div>
              <h2 className="font-semibold mb-6">Envoyez-nous un message</h2>
              {sent ? (
                <div className="p-6 rounded-xl border border-success/30 bg-success/5 text-center">
                  <p className="font-medium text-success">Message envoyé !</p>
                  <p className="text-sm text-text-muted mt-1">Nous vous répondrons dans les plus brefs délais.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input type="text" placeholder="Votre nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary" required />
                    <input type="email" placeholder="Votre email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary" required />
                  </div>
                  <input type="text" placeholder="Sujet" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary" required />
                  <textarea placeholder="Votre message" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary resize-none" required />
                  <button type="submit" disabled={sending}
                    className="px-6 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm">
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {sending ? "Envoi..." : "Envoyer"}
                  </button>
                </form>
              )}
            </div>
            <div className="space-y-6">
              <h2 className="font-semibold mb-6">Nos coordonnées</h2>
              <div className="flex items-start gap-3">
                <MapPin size={18} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Adresse</p>
                  <p className="text-sm text-text-secondary">Kinshasa, République Démocratique du Congo</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail size={18} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Email</p>
                  <p className="text-sm text-text-secondary">support@kongopay.com</p>
                  <p className="text-sm text-text-secondary">privacy@kongopay.com</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone size={18} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Téléphone</p>
                  <p className="text-sm text-text-secondary">+243 899 000 000</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={18} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Horaires</p>
                  <p className="text-sm text-text-secondary">Lun - Ven : 08h00 - 18h00</p>
                  <p className="text-sm text-text-secondary">Sam : 09h00 - 13h00</p>
                </div>
              </div>
            </div>
          </div>

          <AdBanner slot="contact-banner" format="horizontal" className="mt-8" />
        </section>
      </main>
      <Footer />
    </>
  );
}
