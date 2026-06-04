import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ConnexionPage() {
  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8">
          <h1 className="text-2xl font-bold text-center mb-6">Connexion</h1>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-text-muted mb-1 block">Email</label>
              <input type="email" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary" placeholder="exemple@email.com" />
            </div>
            <div>
              <label className="text-sm text-text-muted mb-1 block">Mot de passe</label>
              <input type="password" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary" placeholder="••••••••" />
            </div>
            <button className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors">Se connecter</button>
          </div>
          <p className="text-center text-sm text-text-muted mt-4">
            Pas encore de compte ? <a href="/inscription" className="text-primary hover:underline">S&apos;inscrire</a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
