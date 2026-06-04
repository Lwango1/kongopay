import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function InscriptionPage() {
  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8">
          <h1 className="text-2xl font-bold text-center mb-6">Créer un compte</h1>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-text-muted mb-1 block">Nom complet</label>
              <input type="text" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary" placeholder="Jean Dupont" />
            </div>
            <div>
              <label className="text-sm text-text-muted mb-1 block">Email</label>
              <input type="email" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary" placeholder="exemple@email.com" />
            </div>
            <div>
              <label className="text-sm text-text-muted mb-1 block">Téléphone</label>
              <input type="tel" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary" placeholder="+243 XXX XXX XXX" />
            </div>
            <div>
              <label className="text-sm text-text-muted mb-1 block">Mot de passe</label>
              <input type="password" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary" placeholder="••••••••" />
            </div>
            <button className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors">Créer mon compte</button>
          </div>
          <p className="text-center text-sm text-text-muted mt-4">
            Déjà un compte ? <a href="/connexion" className="text-primary hover:underline">Se connecter</a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
