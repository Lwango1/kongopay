"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Coins, Trophy, RotateCcw, Sparkles, Star,
  Flame, Gem, Zap, Shield, TrendingUp,
} from "lucide-react";

interface Level {
  id: number;
  name: string;
  crypto: string;
  cryptoIcon: any;
  color: string;
  clue: string;
  emoji: string;
}

const LEVELS: Level[] = [
  { id: 1, name: "Prairie Bitcoin", crypto: "Bitcoin", cryptoIcon: Sparkles, color: "#f7931a", clue: "L'or numérique, la première des cryptos", emoji: "🌿" },
  { id: 2, name: "Donjon Ethereum", crypto: "Ethereum", cryptoIcon: Gem, color: "#8c8cff", clue: "La plateforme de contrats intelligents", emoji: "🏰" },
  { id: 3, name: "Jungle Solana", crypto: "Solana", cryptoIcon: Zap, color: "#00d18c", clue: "La blockchain la plus rapide", emoji: "🌴" },
  { id: 4, name: "Volcan Cardano", crypto: "Cardano", cryptoIcon: Shield, color: "#0033ad", clue: "La blockchain scientifique et peer-reviewée", emoji: "🌋" },
  { id: 5, name: "Forêt Binance", crypto: "BNB", cryptoIcon: Flame, color: "#f0b90b", clue: "Le token de l'écosystème Binance", emoji: "🌲" },
  { id: 6, name: "Océan Ripple", crypto: "Ripple", cryptoIcon: TrendingUp, color: "#23292f", clue: "Le pont entre les monnaies traditionnelles", emoji: "🌊" },
  { id: 7, name: "Cité Polkadot", crypto: "Polkadot", cryptoIcon: Star, color: "#e6007a", clue: "L'interopérabilité des blockchains", emoji: "🏙️" },
  { id: 8, name: "Montagne Cosmos", crypto: "Cosmos", cryptoIcon: Coins, color: "#2e3148", clue: "L'internet des blockchains", emoji: "⛰️" },
];

const POWER_UPS = [
  { icon: "🍄", name: "ChampiBoost", desc: "2x points pour le prochain niveau !" },
  { icon: "⭐", name: "SuperStar", desc: "Protection contre les obstacles !" },
  { icon: "🌸", name: "FleurFeu", desc: "Dévoile un indice supplémentaire !" },
];

type TileType = "empty" | "coin" | "goomba" | "powerup" | "pipe";

interface Tile {
  type: TileType;
  revealed: boolean;
}

interface GameLevel {
  level: Level;
  tiles: Tile[];
  coinsFound: number;
  completed: boolean;
}

export default function MarioCryptoTreasure() {
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [gameLevels, setGameLevels] = useState<GameLevel[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [message, setMessage] = useState("");
  const [activePowerUp, setActivePowerUp] = useState<string | null>(null);
  const [showPowerUp, setShowPowerUp] = useState<string | null>(null);
  const [marioPos, setMarioPos] = useState(0);

  const initLevels = useCallback(() => {
    const shuffled = [...LEVELS].sort(() => Math.random() - 0.5);
    const levels: GameLevel[] = shuffled.slice(0, 5).map(level => {
      const tiles: Tile[] = [];
      const totalTiles = 8 + Math.floor(Math.random() * 4);
      const coinPos = Math.floor(Math.random() * totalTiles);
      const goombaPositions = new Set<number>();
      while (goombaPositions.size < Math.min(2, totalTiles - 1)) {
        const pos = Math.floor(Math.random() * totalTiles);
        if (pos !== coinPos) goombaPositions.add(pos);
      }
      const powerUpPos = (() => {
        const pos = Math.floor(Math.random() * totalTiles);
        if (pos !== coinPos && !goombaPositions.has(pos)) return pos;
        return -1;
      })();

      for (let i = 0; i < totalTiles; i++) {
        if (i === coinPos) tiles.push({ type: "coin", revealed: false });
        else if (goombaPositions.has(i)) tiles.push({ type: "goomba", revealed: false });
        else if (i === powerUpPos && powerUpPos >= 0) tiles.push({ type: "powerup", revealed: false });
        else tiles.push({ type: "empty", revealed: false });
      }
      // Always put pipe at the end
      tiles.push({ type: "pipe", revealed: false });

      return { level, tiles, coinsFound: 0, completed: false };
    });
    setGameLevels(levels);
    setCurrentLevelIdx(0);
    setScore(0);
    setLives(3);
    setGameOver(false);
    setWon(false);
    setMessage("");
    setActivePowerUp(null);
    setMarioPos(0);
  }, []);

  useEffect(() => { initLevels(); }, [initLevels]);

  const advanceMario = (tiles: Tile[], from: number) => {
    if (from < tiles.length - 1) setMarioPos(from + 1);
  };

  const jump = (tileIndex: number) => {
    const level = gameLevels[currentLevelIdx];
    if (!level || level.completed || gameOver || won) return;

    const tile = level.tiles[tileIndex];
    if (tile.revealed) return;
    if (tileIndex < marioPos) return;
    if (tileIndex > marioPos + 3) return;

    const newLevels = [...gameLevels];
    const currentLevel = { ...newLevels[currentLevelIdx] };
    const newTiles = [...currentLevel.tiles];
    newTiles[tileIndex] = { ...newTiles[tileIndex], revealed: true };
    currentLevel.tiles = newTiles;

    let newScore = score;
    let newLives = lives;
    let msg = "";

    switch (tile.type) {
      case "coin":
        newScore += 100;
        currentLevel.coinsFound++;
        msg = `🪙 +100 points ! ${currentLevel.level.crypto} est à toi !`;
        if (activePowerUp === "🍄") newScore += 100;
        setShowPowerUp(null);
        break;
      case "goomba":
        if (activePowerUp === "⭐") {
          newScore += 50;
          msg = "⭐ SuperStar te protège ! +50 points !";
        } else {
          newLives--;
          msg = "👾 Goomba attaque ! -1 vie";
          if (newLives <= 0) {
            setGameOver(true);
            msg = "💀 Game Over ! Mario a perdu toutes ses vies...";
          }
        }
        break;
      case "powerup":
        const pu = POWER_UPS[Math.floor(Math.random() * POWER_UPS.length)];
        setActivePowerUp(pu.icon);
        setShowPowerUp(pu.icon);
        newScore += 50;
        msg = `${pu.icon} ${pu.name} ! ${pu.desc}`;
        break;
      case "pipe":
        if (currentLevel.coinsFound > 0) {
          currentLevel.completed = true;
          newScore += 200;
          msg = `🏁 ${currentLevel.level.emoji} ${currentLevel.level.name} terminé ! +200 points ! ${currentLevel.level.clue}`;
          if (currentLevelIdx < gameLevels.length - 1) {
            setTimeout(() => {
              setCurrentLevelIdx(i => i + 1);
              setMarioPos(0);
              setActivePowerUp(null);
            }, 2000);
          } else {
            setWon(true);
            msg = `🏆 Félicitations ! Tous les niveaux terminés ! Score final: ${newScore}`;
          }
        } else {
          msg = "🚫 Trouve d'abord la crypto cachée dans ce niveau !";
          newTiles[tileIndex] = { ...newTiles[tileIndex], revealed: false };
        }
        break;
    }

    advanceMario(newTiles, tileIndex);
    newLevels[currentLevelIdx] = currentLevel;
    setGameLevels(newLevels);
    setScore(newScore);
    setLives(newLives);
    setMessage(msg);
  };

  const currentLevel = gameLevels[currentLevelIdx];

  return (
    <section className="py-16 px-4 border-t border-border">
      <div className="max-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold flex items-center justify-center gap-3 mb-2">
            🏃 Mario Crypto Treasure
          </h2>
          <p className="text-text-secondary text-sm max-w-xl mx-auto">
            Incarne Mario et traverse les niveaux pour trouver les cryptos cachées !
            Évite les Goombas, attrape les power-ups et collecte tous les trésors.
          </p>
        </div>

        {/* HUD */}
        <div className="flex items-center justify-center flex-wrap gap-4 mb-8">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border">
            <span className="text-xl">🏃</span>
            <span className="font-bold font-mono">MARIO</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border">
            <span className="text-lg">🪙</span>
            <span className="font-bold font-mono text-warning">{score}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border">
            <span className="text-lg">❤️</span>
            <span className="font-bold font-mono text-danger">{lives}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border">
            <span className="text-sm">Niveau</span>
            <span className="font-bold font-mono">{currentLevelIdx + 1}/{gameLevels.length}</span>
          </div>
          {activePowerUp && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/40 text-yellow-500">
              <span className="text-lg">{activePowerUp}</span>
              <span className="text-xs font-medium">ACTIF</span>
            </div>
          )}
        </div>

        {/* Current level banner */}
        {currentLevel && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-surface to-surface-light border border-border">
            <div className="flex items-center gap-4">
              <span className="text-4xl">{currentLevel.level.emoji}</span>
              <div>
                <h3 className="font-bold text-lg">{currentLevel.level.name}</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Trouve la crypto cachée, atteins le tuyau 🏁 pour valider le niveau
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <currentLevel.level.cryptoIcon size={14} style={{ color: currentLevel.level.color }} />
                  <span className="text-xs font-medium" style={{ color: currentLevel.level.color }}>
                    Cherche: {currentLevel.level.crypto}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Game board - Mario platformer style */}
        {currentLevel && (
          <div className="mb-6">
            {/* Sky background */}
            <div className="rounded-t-xl bg-gradient-to-b from-sky-900/30 to-surface pt-8 px-4 border border-border border-b-0">
              {/* Clouds */}
              <div className="flex justify-between text-2xl mb-4 opacity-30">
                <span>☁️</span>
                <span>☁️</span>
                <span>☁️</span>
              </div>
            </div>

            {/* Ground tiles */}
            <div className="bg-amber-900/20 border-x border-border px-2 py-4">
              <div className="flex gap-2 justify-center flex-wrap">
                {currentLevel.tiles.map((tile, i) => {
                  const isCurrent = i === marioPos;
                  const isRevealed = tile.revealed;
                  const canJump = i > marioPos - 1 && i <= marioPos + 3 && !tile.revealed;

                  return (
                    <button
                      key={i}
                      onClick={() => jump(i)}
                      disabled={!canJump || gameOver || won || currentLevel.completed}
                      className={`w-16 h-16 rounded-lg border-2 transition-all duration-200 flex items-center justify-center text-lg
                        ${isCurrent && !isRevealed ? "border-primary bg-primary/10 scale-110 shadow-lg" : ""}
                        ${canJump && !isRevealed ? "border-amber-600/40 bg-amber-900/10 hover:bg-amber-900/20 hover:border-amber-500 cursor-pointer" : ""}
                        ${isRevealed && tile.type === "coin" ? "border-yellow-500/60 bg-yellow-500/20" : ""}
                        ${isRevealed && tile.type === "goomba" ? "border-red-500/60 bg-red-500/20" : ""}
                        ${isRevealed && tile.type === "powerup" ? "border-purple-500/60 bg-purple-500/20" : ""}
                        ${isRevealed && tile.type === "pipe" ? "border-green-600/60 bg-green-900/20" : ""}
                        ${isRevealed && tile.type === "empty" ? "border-border/30 bg-surface/30 opacity-50" : ""}
                        ${!canJump && !isRevealed ? "border-border/20 bg-surface/20 opacity-30" : ""}
                        ${(gameOver || won || currentLevel.completed) ? "opacity-50 cursor-not-allowed" : ""}
                      `}
                    >
                      {isCurrent && !isRevealed && <span className="text-2xl">🏃</span>}
                      {isRevealed && tile.type === "coin" && <span className="text-2xl">🪙</span>}
                      {isRevealed && tile.type === "goomba" && <span className="text-2xl">👾</span>}
                      {isRevealed && tile.type === "powerup" && <span className="text-2xl">{showPowerUp || "🍄"}</span>}
                      {isRevealed && tile.type === "pipe" && <span className="text-2xl">🏁</span>}
                      {isRevealed && tile.type === "empty" && <span className="opacity-20">🌱</span>}
                      {!isRevealed && !isCurrent && (
                        <span className="text-xs text-text-muted opacity-40">?</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ground style */}
            <div className="h-4 bg-amber-800/30 rounded-b-xl border border-t-0 border-border flex items-center justify-center gap-4">
              {currentLevel.tiles.map((_, i) => (
                <div key={i} className="w-4 h-2 bg-amber-700/20 rounded" />
              ))}
            </div>

            {/* Coins found indicator */}
            <div className="mt-3 flex items-center justify-center gap-1 text-xs text-text-muted">
              {Array.from({ length: currentLevel.tiles.filter(t => t.type === "coin").length }).map((_, i) => (
                <span key={i} className={i < currentLevel.coinsFound ? "text-yellow-500" : "opacity-20"}>
                  🪙
                </span>
              ))}
              <span className="ml-2">
                {currentLevel.coinsFound}/{currentLevel.tiles.filter(t => t.type === "coin").length} crypto trouvée
              </span>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`text-center text-sm mb-6 p-4 rounded-xl ${
            gameOver ? "bg-danger/10 border border-danger/30 text-danger" :
            won ? "bg-success/10 border border-success/30 text-success" :
            "bg-surface border border-border text-text-secondary"
          }`}>
            {message}
          </div>
        )}

        {/* Completed levels */}
        {gameLevels.filter(l => l.completed).length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-text-muted uppercase mb-3">Niveaux complétés</h3>
            <div className="flex flex-wrap gap-2">
              {gameLevels.filter(l => l.completed).map(l => (
                <div key={l.level.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20 text-xs font-medium">
                  <span>{l.level.emoji}</span>
                  {l.level.crypto}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={initLevels}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <RotateCcw size={16} />
            Nouvelle partie
          </button>
        </div>

        {/* Legend */}
        <div className="mt-8 p-4 rounded-xl bg-surface border border-border">
          <h4 className="text-sm font-semibold mb-3">🎮 Comment jouer</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏃</span>
              <span>Mario (toi)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🪙</span>
              <span>Pièce crypto</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">👾</span>
              <span>Goomba (danger)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🍄⭐🌸</span>
              <span>Power-ups</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🏁</span>
              <span>Tuyau de sortie</span>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-3">
            Saute sur les cases pour les révéler. Trouve la crypto cachée puis atteins le tuyau 🏁 pour valider le niveau.
            Évite les 👾 Goombas ou utilise un ⭐ power-up pour te protéger !
          </p>
        </div>
      </div>
    </section>
  );
}
