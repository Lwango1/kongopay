"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Cell = { x: number; y: number };

const GRID = 20;
const TICK = 140;
const COINS = ["🪙", "₿", "ETH", "SOL", "BNB", "ADA"];

function randomCoin() {
  return COINS[Math.floor(Math.random() * COINS.length)];
}

function randomPos() {
  return {
    x: Math.floor(Math.random() * GRID),
    y: Math.floor(Math.random() * GRID),
  };
}

export default function CryptoSnake() {
  const [snake, setSnake] = useState<Cell[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Cell & { emoji: string }>({
    ...randomPos(),
    emoji: randomCoin(),
  });
  const [dir, setDir] = useState<Direction>("RIGHT");
  const [nextDir, setNextDir] = useState<Direction>("RIGHT");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [speed, setSpeed] = useState(TICK);
  const gameRef = useRef({ dir: "RIGHT" as Direction, snake: [{ x: 10, y: 10 }] });

  const reset = () => {
    setSnake([{ x: 10, y: 10 }]);
    setDir("RIGHT");
    setNextDir("RIGHT");
    setScore(0);
    setSpeed(TICK);
    setGameOver(false);
    setStarted(true);
    setFood({ ...randomPos(), emoji: randomCoin() });
    gameRef.current = { dir: "RIGHT", snake: [{ x: 10, y: 10 }] };
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!started && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        reset();
        return;
      }
      if (gameOver) return;
      const opp: Record<string, string> = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" };
      const k = e.key.replace("Arrow", "").toUpperCase();
      if (!["UP", "DOWN", "LEFT", "RIGHT"].includes(k)) return;
      if (k === opp[gameRef.current.dir]) return;
      setNextDir(k as Direction);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [started, gameOver]);

  useEffect(() => {
    if (!started || gameOver) return;
    const interval = setInterval(() => {
      setDir(nextDir);
      gameRef.current.dir = nextDir;
      setSnake(prev => {
        const head = prev[0];
        const newHead = { ...head };
        switch (nextDir) {
          case "UP": newHead.y -= 1; break;
          case "DOWN": newHead.y += 1; break;
          case "LEFT": newHead.x -= 1; break;
          case "RIGHT": newHead.x += 1; break;
        }

        if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
          setGameOver(true);
          setHighScore(h => Math.max(h, score));
          return prev;
        }

        if (prev.some(c => c.x === newHead.x && c.y === newHead.y)) {
          setGameOver(true);
          setHighScore(h => Math.max(h, score));
          return prev;
        }

        const ate = newHead.x === food.x && newHead.y === food.y;
        const newSnake = [newHead, ...prev];
        if (!ate) newSnake.pop();

        if (ate) {
          setScore(s => {
            const ns = s + 1;
            if (ns % 5 === 0) setSpeed(sp => Math.max(sp - 15, 60));
            return ns;
          });
          setFood({ ...randomPos(), emoji: randomCoin() });
        }

        gameRef.current.snake = newSnake;
        return newSnake;
      });
    }, speed);
    return () => clearInterval(interval);
  }, [started, gameOver, food, nextDir, speed, score]);

  return (
    <section className="py-16 px-4 border-t border-border">
      <div className="max-w-lg mx-auto text-center">
        <h2 className="text-2xl font-bold mb-1">🐍 Crypto Snake</h2>
        <p className="text-text-secondary text-sm mb-4">
          Utilise les flèches ←↑↓→ pour manger des cryptos et grandir !
        </p>

        {/* Score */}
        <div className="flex items-center justify-center gap-6 mb-4 text-sm">
          <div className="px-4 py-2 rounded-lg bg-surface border border-border">
            <span className="text-text-muted">Score </span>
            <span className="font-bold font-mono text-warning">{score}</span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-surface border border-border">
            <span className="text-text-muted">Record </span>
            <span className="font-bold font-mono text-primary">{highScore}</span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-surface border border-border">
            <span className="text-text-muted">Vitesse </span>
            <span className="font-bold font-mono" style={{ color: speed < 100 ? "#ef4444" : speed < 120 ? "#f59e0b" : "#22c55e" }}>
              {speed <= 60 ? "MAX" : speed <= 100 ? "Rapide" : "Normal"}
            </span>
          </div>
        </div>

        {/* Canvas */}
        <div className="relative mx-auto border-2 border-border rounded-xl overflow-hidden bg-background" style={{ width: GRID * 20 + 4, height: GRID * 20 + 4 }}>
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          {!started && !gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="text-center">
                <p className="text-4xl mb-3">🐍</p>
                <p className="text-sm font-semibold mb-2">Crypto Snake</p>
                <p className="text-xs text-text-muted mb-4">Appuie sur une flèche pour commencer</p>
                <div className="flex justify-center gap-2 text-lg opacity-60">
                  <span>←</span><span>↑</span><span>↓</span><span>→</span>
                </div>
              </div>
            </div>
          )}
          {gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/85 z-10">
              <div className="text-center">
                <p className="text-4xl mb-2">💀</p>
                <p className="text-lg font-bold text-danger mb-1">Game Over</p>
                <p className="text-sm text-text-secondary mb-4">Score: {score}</p>
                <button
                  onClick={reset}
                  className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  🔄 Rejouer
                </button>
              </div>
            </div>
          )}
          <div className="relative" style={{ width: GRID * 20, height: GRID * 20 }}>
            {/* Food */}
            <div
              className="absolute flex items-center justify-center text-sm font-bold z-10 animate-pulse"
              style={{ left: food.x * 20, top: food.y * 20, width: 20, height: 20 }}
            >
              <span className="text-xs">{food.emoji}</span>
            </div>
            {/* Snake */}
            {snake.map((c, i) => (
              <div
                key={`${c.x}-${c.y}-${i}`}
                className="absolute rounded-sm transition-none"
                style={{
                  left: c.x * 20,
                  top: c.y * 20,
                  width: 18,
                  height: 18,
                  margin: 1,
                  background: i === 0
                    ? "linear-gradient(135deg, #22c55e, #16a34a)"
                    : `linear-gradient(135deg, #22c55e, ${i < 3 ? "#16a34a" : "#15803d"})`,
                  opacity: i === 0 ? 1 : Math.max(0.4, 1 - i * 0.03),
                  borderRadius: i === 0 ? "4px" : "2px",
                  zIndex: snake.length - i,
                }}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={() => { const e = new KeyboardEvent("keydown", { key: "ArrowUp" }); window.dispatchEvent(e); }} className="w-12 h-12 rounded-xl bg-surface border border-border text-lg hover:bg-surface-light transition-colors">↑</button>
          <div className="flex gap-2">
            <button onClick={() => { const e = new KeyboardEvent("keydown", { key: "ArrowLeft" }); window.dispatchEvent(e); }} className="w-12 h-12 rounded-xl bg-surface border border-border text-lg hover:bg-surface-light transition-colors">←</button>
            <button onClick={() => { const e = new KeyboardEvent("keydown", { key: "ArrowDown" }); window.dispatchEvent(e); }} className="w-12 h-12 rounded-xl bg-surface border border-border text-lg hover:bg-surface-light transition-colors">↓</button>
            <button onClick={() => { const e = new KeyboardEvent("keydown", { key: "ArrowRight" }); window.dispatchEvent(e); }} className="w-12 h-12 rounded-xl bg-surface border border-border text-lg hover:bg-surface-light transition-colors">→</button>
          </div>
        </div>

        <p className="text-xs text-text-muted mt-3">
          Mange les cryptos 🪙₿ETH... pour grandir. Ne touche pas les murs ni ton propre corps !
        </p>
      </div>
    </section>
  );
}
