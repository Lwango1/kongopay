"use client";

import { useState, useCallback } from "react";

interface Entity {
  nom: string;
  pointsVie: number;
  pointsVieMax: number;
  attaqueBase: number;
}

type LogEntry = { text: string; type: "attack" | "special" | "ko" | "info" };

function random(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function attaquer(attaquant: Entity, cible: Entity): { cible: Entity; degats: number } {
  const degats = random(attaquant.attaqueBase - 3, attaquant.attaqueBase + 5);
  const nouvelleCible = { ...cible };
  nouvelleCible.pointsVie = Math.max(0, cible.pointsVie - degats);
  return { cible: nouvelleCible, degats };
}

function attaqueSpeciale(attaquant: Entity, cible: Entity): { cible: Entity; degats: number } {
  const degats = attaquant.attaqueBase * 2;
  const nouvelleCible = { ...cible };
  nouvelleCible.pointsVie = Math.max(0, cible.pointsVie - degats);
  return { cible: nouvelleCible, degats };
}

export default function CombatGame() {
  const [joueur, setJoueur] = useState<Entity>({ nom: "Héros PS5", pointsVie: 100, pointsVieMax: 100, attaqueBase: 15 });
  const [monstre, setMonstre] = useState<Entity>({ nom: "Titan de Feu", pointsVie: 120, pointsVieMax: 120, attaqueBase: 12 });
  const [tour, setTour] = useState<"joueur" | "boss">("joueur");
  const [logs, setLogs] = useState<LogEntry[]>([{ text: "--- Début du combat : Héros PS5 VS Titan de Feu ---", type: "info" }]);
  const [termine, setTermine] = useState(false);

  const ajouterLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [...prev, entry]);
  }, []);

  const resetCombat = () => {
    setJoueur({ nom: "Héros PS5", pointsVie: 100, pointsVieMax: 100, attaqueBase: 15 });
    setMonstre({ nom: "Titan de Feu", pointsVie: 120, pointsVieMax: 120, attaqueBase: 12 });
    setTour("joueur");
    setLogs([{ text: "--- Début du combat : Héros PS5 VS Titan de Feu ---", type: "info" }]);
    setTermine(false);
  };

  const tourJoueur = () => {
    if (termine || tour !== "joueur") return;

    const { cible: newMonstre, degats } = attaquer(joueur, monstre);
    setMonstre(newMonstre);
    ajouterLog({ text: `⚔️ ${joueur.nom} attaque ${newMonstre.nom} et inflige ${degats} dégâts !`, type: "attack" });

    if (newMonstre.pointsVie <= 0) {
      ajouterLog({ text: `💀 ${newMonstre.nom} est KO !`, type: "ko" });
      ajouterLog({ text: `🏆 ${joueur.nom} remporte le combat !`, type: "info" });
      setTermine(true);
      setTour("boss");
      return;
    }

    setTour("boss");
    ajouterLog({ text: `Vie du ${newMonstre.nom} : ${newMonstre.pointsVie} PV`, type: "info" });
  };

  const tourBoss = () => {
    if (termine || tour !== "boss") return;

    const { cible: newJoueur, degats } = attaqueSpeciale(monstre, joueur);
    setJoueur(newJoueur);
    ajouterLog({ text: `🔥 ATTACKE SPÉCIALE ! ${monstre.nom} foudroie ${newJoueur.nom} avec ${degats} dégâts !`, type: "special" });

    if (newJoueur.pointsVie <= 0) {
      ajouterLog({ text: `💀 ${newJoueur.nom} est KO !`, type: "ko" });
      ajouterLog({ text: `💀 ${monstre.nom} remporte le combat !`, type: "info" });
      setTermine(true);
      return;
    }

    setTour("joueur");
    ajouterLog({ text: `Vie du ${newJoueur.nom} : ${newJoueur.pointsVie} PV`, type: "info" });
  };

  const degJoueur = Math.round((joueur.pointsVie / joueur.pointsVieMax) * 100);
  const degMonstre = Math.round((monstre.pointsVie / monstre.pointsVieMax) * 100);

  return (
    <section className="py-16 px-4 border-t border-border">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-2">🐍 Combat RPG — Héros PS5 VS Titan de Feu</h2>
        <p className="text-text-secondary text-center mb-8 text-sm">
          Reprend le code Python en version interactive. Clique sur Attaquer pour jouer !
        </p>

        {/* Stats */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🦸</span>
                <span className="font-bold">{joueur.nom}</span>
              </div>
              <span className="text-sm font-mono">{joueur.pointsVie}/{joueur.pointsVieMax} PV</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-background overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-success to-warning" style={{ width: `${degJoueur}%` }} />
            </div>
            <div className="mt-2 text-xs text-text-muted">ATK: {joueur.attaqueBase} | PV: {joueur.pointsVie}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">👹</span>
                <span className="font-bold">{monstre.nom}</span>
              </div>
              <span className="text-sm font-mono">{monstre.pointsVie}/{monstre.pointsVieMax} PV</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-background overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-danger to-warning" style={{ width: `${degMonstre}%` }} />
            </div>
            <div className="mt-2 text-xs text-text-muted">ATK: {monstre.attaqueBase} (Spéciale ×2)</div>
          </div>
        </div>

        {/* Contrôles */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {!termine ? (
            <>
              <button
                onClick={tourJoueur}
                disabled={tour !== "joueur"}
                className={`px-6 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2
                  ${tour === "joueur"
                    ? "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20"
                    : "bg-surface border border-border text-text-muted cursor-not-allowed opacity-50"}`}
              >
                ⚔️ Attaquer (Tour Joueur)
              </button>
              <button
                onClick={tourBoss}
                disabled={tour !== "boss"}
                className={`px-6 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2
                  ${tour === "boss"
                    ? "bg-danger text-white hover:bg-danger/90 shadow-lg shadow-danger/20 animate-pulse"
                    : "bg-surface border border-border text-text-muted cursor-not-allowed opacity-50"}`}
              >
                🔥 Attaque Spéciale (Tour Boss)
              </button>
            </>
          ) : (
            <button
              onClick={resetCombat}
              className="px-6 py-3 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary/90 transition-all"
            >
              🔄 Recommencer le combat
            </button>
          )}
        </div>

        {/* Indicateur de tour */}
        {!termine && (
          <div className="text-center mb-4 text-sm">
            {tour === "joueur" ? (
              <span className="text-primary font-semibold">🦸 Tour du Héros PS5 — Clique sur Attaquer !</span>
            ) : (
              <span className="text-danger font-semibold">👹 Tour du Titan de Feu — Clique sur Attaque Spéciale !</span>
            )}
          </div>
        )}

        {/* Logs du combat */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background/50">
            <span className="text-xs font-semibold text-text-muted uppercase">Journal du combat</span>
            <span className="text-[10px] text-text-muted">{logs.length} actions</span>
          </div>
          <div className="p-4 max-h-60 overflow-y-auto space-y-1.5 font-mono text-sm">
            {logs.map((log, i) => (
              <div key={i} className={`px-3 py-1.5 rounded-lg ${
                log.type === "attack" ? "bg-primary/5 text-primary/90" :
                log.type === "special" ? "bg-danger/10 text-danger" :
                log.type === "ko" ? "bg-red-500/15 text-red-500 font-bold" :
                "text-text-secondary"
              }`}>
                {log.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
