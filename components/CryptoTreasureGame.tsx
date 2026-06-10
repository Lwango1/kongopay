"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bitcoin, Coins, Trophy, RotateCcw, Sparkles,
  TrendingUp, Zap, Shield, Flame, Gem, Lock,
} from "lucide-react";

interface Treasure {
  id: string;
  name: string;
  icon: any;
  color: string;
  found: boolean;
  clue: string;
}

const TREASURES: Treasure[] = [
  { id: "btc", name: "Bitcoin", icon: Bitcoin, color: "#f7931a", found: false, clue: "La première crypto, l'or numérique" },
  { id: "eth", name: "Ethereum", icon: Sparkles, color: "#8c8cff", found: false, clue: "La plateforme de contrats intelligents" },
  { id: "sol", name: "Solana", icon: Zap, color: "#00d18c", found: false, clue: "La blockchain ultra-rapide" },
  { id: "ada", name: "Cardano", icon: Shield, color: "#0033ad", found: false, clue: "La blockchain scientifique" },
  { id: "bnb", name: "BNB", icon: Flame, color: "#f0b90b", found: false, clue: "Le token de l'écosystème Binance" },
  { id: "xrp", name: "Ripple", icon: TrendingUp, color: "#23292f", found: false, clue: "Le pont entre les monnaies" },
  { id: "dot", name: "Polkadot", icon: Gem, color: "#e6007a", found: false, clue: "L'interopérabilité des blockchains" },
  { id: "atom", name: "Cosmos", icon: Coins, color: "#2e3148", found: false, clue: "L'internet des blockchains" },
];

const GRID_SIZE = 12;
const MAX_ATTEMPTS = 20;

type CellState = "hidden" | "empty" | Treasure;

export default function CryptoTreasureGame() {
  const [grid, setGrid] = useState<CellState[]>([]);
  const [foundIds, setFoundIds] = useState<Set<string>>(new Set());
  const [attempts, setAttempts] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [message, setMessage] = useState("");
  const [streak, setStreak] = useState(0);
  const [totalFound, setTotalFound] = useState(0);
  const [showClue, setShowClue] = useState<Treasure | null>(null);

  const initGame = useCallback(() => {
    const shuffled = [...TREASURES].sort(() => Math.random() - 0.5);
    const treasuresToPlace = shuffled.slice(0, 5);
    const cells: CellState[] = new Array(GRID_SIZE).fill("hidden");
    const positions = new Set<number>();
    while (positions.size < treasuresToPlace.length) {
      positions.add(Math.floor(Math.random() * GRID_SIZE));
    }
    let idx = 0;
    for (const pos of positions) {
      cells[pos] = treasuresToPlace[idx++];
    }
    setGrid(cells);
    setFoundIds(new Set());
    setAttempts(0);
    setGameOver(false);
    setWon(false);
    setMessage("");
    setStreak(0);
    setTotalFound(0);
  }, []);

  useEffect(() => { initGame(); }, [initGame]);

  const reveal = (index: number) => {
    if (gameOver || grid[index] !== "hidden") return;
    if (attempts >= MAX_ATTEMPTS) return;

    const newGrid = [...grid];
    const cell = newGrid[index];
    setAttempts(a => a + 1);

    if (cell === "hidden") {
      newGrid[index] = "empty";
      setGrid(newGrid);
      setStreak(0);
      setMessage("Rien ici... continue à chercher !");
    } else if (typeof cell === "object" && "id" in cell) {
      const treasure = cell as Treasure;
      if (!foundIds.has(treasure.id)) {
        newGrid[index] = treasure;
        setGrid(newGrid);
        const newFound = new Set(foundIds);
        newFound.add(treasure.id);
        setFoundIds(newFound);
        setStreak(s => s + 1);
        setTotalFound(t => t + 1);
        setShowClue(treasure);
        setMessage(`🎉 Tu as trouvé ${treasure.name} ! ${treasure.clue}`);

        if (newFound.size >= TREASURES.length) {
          setWon(true);
          setGameOver(true);
          setMessage("🏆 Félicitations ! Tu as trouvé tous les trésors crypto !");
        }
      }
    }

    if (attempts + 1 >= MAX_ATTEMPTS && !won) {
      setGameOver(true);
      setMessage("😅 Plus de tentatives ! Relance une partie pour réessayer.");
    }
  };

  const remaining = TREASURES.length - foundIds.size;
  const attemptsLeft = MAX_ATTEMPTS - attempts;

  return (
    <section className="py-16 px-4 border-t border-border">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold flex items-center justify-center gap-3 mb-3">
            <Trophy className="text-primary" size={28} />
            Chasse au Trésor Crypto
          </h2>
          <p className="text-text-secondary text-sm max-w-xl mx-auto">
            Explore les blocs pour trouver les cryptomonnaies cachées. 
            Chaque trésor découvert débloque une connaissance. Trouve-les tous !
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-6 mb-8 text-sm">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border">
            <Trophy size={16} className="text-primary" />
            <span className="font-medium">{foundIds.size}/{TREASURES.length} trésors</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border">
            <Zap size={16} className="text-warning" />
            <span className="font-medium">{attemptsLeft}/{MAX_ATTEMPTS} essais</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border">
            <Flame size={16} className="text-danger" />
            <span className="font-medium">Série: {streak}</span>
          </div>
        </div>

        {/* Clue popup */}
        {showClue && (
          <div className="mb-6 p-4 rounded-xl border border-primary/30 bg-primary/5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <showClue.icon size={20} style={{ color: showClue.color }} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{showClue.name} découvert !</p>
                <p className="text-xs text-text-secondary mt-1">{showClue.clue}</p>
              </div>
              <button onClick={() => setShowClue(null)} className="text-text-muted hover:text-text text-xs">✕</button>
            </div>
          </div>
        )}

        {/* Game Board */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {grid.map((cell, i) => {
            const isHidden = cell === "hidden";
            const isEmpty = cell === "empty";
            const isTreasure = typeof cell === "object" && "id" in cell;
            const treasure = isTreasure ? (cell as Treasure) : null;

            return (
              <button
                key={i}
                onClick={() => reveal(i)}
                disabled={!isHidden || gameOver}
                className={`aspect-square rounded-xl border transition-all duration-300 flex items-center justify-center
                  ${isHidden && !gameOver ? "bg-surface border-border hover:border-primary/40 hover:bg-surface-light cursor-pointer" : ""}
                  ${isEmpty ? "bg-surface-light/30 border-border/30 opacity-50" : ""}
                  ${isTreasure ? "bg-success/10 border-success/40 shadow-lg shadow-success/10 scale-105" : ""}
                  ${gameOver && isHidden ? "bg-surface-light/20 border-border/20 cursor-not-allowed opacity-40" : ""}
                `}
              >
                {isHidden && !gameOver && <Lock size={20} className="text-text-muted" />}
                {isEmpty && <span className="text-lg opacity-30">·</span>}
                {isTreasure && treasure && (
                  <div className="flex flex-col items-center gap-1 scale-105 transition-transform">
                    <treasure.icon size={24} style={{ color: treasure.color }} />
                    <span className="text-[8px] font-bold" style={{ color: treasure.color }}>{treasure.name}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Message */}
        {message && (
          <div className={`text-center text-sm mb-6 p-3 rounded-xl ${won ? "bg-success/10 border border-success/30 text-success" : gameOver ? "bg-danger/10 border border-danger/30 text-danger" : "bg-surface border border-border text-text-secondary"}`}>
            {message}
          </div>
        )}

        {/* Found treasures */}
        {foundIds.size > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-text-muted uppercase mb-3">Trésors trouvés</h3>
            <div className="flex flex-wrap gap-2">
              {TREASURES.filter(t => foundIds.has(t.id)).map(t => (
                <div key={t.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20 text-xs font-medium">
                  <t.icon size={14} style={{ color: t.color }} />
                  {t.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing treasures */}
        {remaining > 0 && foundIds.size > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-text-muted uppercase mb-3">Encore cachés ({remaining})</h3>
            <div className="flex flex-wrap gap-2">
              {TREASURES.filter(t => !foundIds.has(t.id)).map(t => (
                <div key={t.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-text-muted">
                  <Lock size={12} />
                  ???
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={initGame}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <RotateCcw size={16} />
            Nouvelle partie
          </button>
        </div>

        {/* Educational footer */}
        <div className="mt-10 p-4 rounded-xl bg-surface border border-border">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Coins size={16} className="text-primary" />
            Pourquoi ce jeu ?
          </h4>
          <p className="text-xs text-text-secondary leading-relaxed">
            Chaque crypto trouvée dévoile une information éducative. 
            Ce jeu t&apos;aide à mémoriser les cryptomonnaies et leurs usages 
            tout en t&apos;amusant. Plus tu joues, plus tu apprends !
          </p>
        </div>
      </div>
    </section>
  );
}
