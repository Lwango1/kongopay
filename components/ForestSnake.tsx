"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const S = 20;
const COLS = 28;
const ROWS = 28;
const TICK = 150;
const COINS = ["₿", "ETH", "SOL", "ADA", "DOT", "LINK"];
const AI_COLORS = ["#ef4444", "#a855f7", "#f97316", "#06b6d4", "#ec4899", "#84cc16"];
const AI_NAMES = ["Boa", "Cobra", "Anaconda", "Viper", "Python", "Mamba"];

type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Terrain = "grass" | "tree" | "river";

const OPP: Record<Dir, Dir> = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" };
const DX: Record<Dir, number> = { UP: 0, DOWN: 0, LEFT: -1, RIGHT: 1 };
const DY: Record<Dir, number> = { UP: -1, DOWN: 1, LEFT: 0, RIGHT: 0 };

function rand(n: number) { return Math.floor(Math.random() * n); }

function genTerrain(): Terrain[][] {
  const g: Terrain[][] = Array.from({ length: ROWS }, () => Array(COLS).fill("grass"));

  // River
  let ry = 4 + rand(ROWS - 8);
  for (let x = 0; x < COLS; x++) {
    for (let dy = -1; dy <= 1; dy++) {
      const yy = ry + dy;
      if (yy >= 0 && yy < ROWS) g[yy][x] = "river";
    }
    if (Math.random() < 0.35) ry += Math.random() < 0.5 ? 1 : -1;
    ry = Math.max(2, Math.min(ROWS - 3, ry));
  }

  // Tree clusters
  for (let c = 0; c < 10; c++) {
    const cx = 2 + rand(COLS - 4);
    const cy = 2 + rand(ROWS - 4);
    for (let i = 0; i < 8 + rand(6); i++) {
      const tx = cx + (rand(5) - 2);
      const ty = cy + (rand(5) - 2);
      if (tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS && g[ty][tx] === "grass") {
        g[ty][tx] = "tree";
      }
    }
  }
  return g;
}

function randomGrass(terrain: Terrain[][]): { x: number; y: number } | null {
  for (let i = 0; i < 100; i++) {
    const x = rand(COLS), y = rand(ROWS);
    if (terrain[y][x] === "grass") return { x, y };
  }
  return null;
}

function randomRiverOrTree(terrain: Terrain[][]): { x: number; y: number } | null {
  for (let i = 0; i < 100; i++) {
    const x = rand(COLS), y = rand(ROWS);
    if (terrain[y][x] === "river" || terrain[y][x] === "tree") return { x, y };
  }
  return null;
}

function spawnSnake(len: number, terrain: Terrain[][], dir: Dir, existing: { x: number; y: number }[]): { body: { x: number; y: number }[]; dir: Dir } | null {
  for (let attempt = 0; attempt < 50; attempt++) {
    const h = randomGrass(terrain);
    if (!h) return null;
    const body = [{ x: h.x, y: h.y }];
    let ok = true;
    for (let i = 1; i < len; i++) {
      const px = body[i - 1].x - DX[dir];
      const py = body[i - 1].y - DY[dir];
      if (px < 0 || px >= COLS || py < 0 || py >= ROWS || terrain[py][px] !== "grass") { ok = false; break; }
      if (existing.some(e => e.x === px && e.y === py)) { ok = false; break; }
      body.push({ x: px, y: py });
    }
    if (ok) { existing.push(...body); return { body, dir }; }
  }
  return null;
}

export default function ForestSnake() {
  const terrainRef = useRef(genTerrain());
  const [terrain] = useState(terrainRef.current);

  type SnakeState = { id: string; body: { x: number; y: number }[]; dir: Dir; alive: boolean; isPlayer: boolean; color: string; name: string };
  type CryptoState = { x: number; y: number; emoji: string };

  const initGame = useCallback(() => {
    const t = terrainRef.current;
    const existing: { x: number; y: number }[] = [];
    const pSpawn = spawnSnake(3, t, "RIGHT", existing);
    if (!pSpawn) return null;
    const player: SnakeState = { id: "player", body: pSpawn.body, dir: "RIGHT", alive: true, isPlayer: true, color: "#22c55e", name: "Toi" };
    const ai: SnakeState[] = [];
    const usedColors = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const len = 3 + rand(5);
      const aSpawn = spawnSnake(len, t, (["UP", "DOWN", "LEFT", "RIGHT"] as Dir[])[rand(4)], existing);
      if (!aSpawn) continue;
      const c = AI_COLORS[i % AI_COLORS.length];
      usedColors.add(c);
      ai.push({ id: `ai${i}`, body: aSpawn.body, dir: aSpawn.dir, alive: true, isPlayer: false, color: c, name: AI_NAMES[i % AI_NAMES.length] });
    }
    const cryptos: CryptoState[] = [];
    for (let i = 0; i < 10; i++) {
      const p = randomRiverOrTree(t);
      if (p) cryptos.push({ x: p.x, y: p.y, emoji: COINS[i % COINS.length] });
    }
    return { player, ai, cryptos };
  }, []);

  const [gameState, setGameState] = useState<{ player: SnakeState; ai: SnakeState[]; cryptos: CryptoState[] } | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [message, setMessage] = useState("");
  const dirRef = useRef<Dir>("RIGHT");
  const gameRef = useRef<typeof gameState>(null);
  const tickRef = useRef(0);

  const start = () => {
    const g = initGame();
    if (!g) return;
    setGameState(g);
    gameRef.current = g;
    setGameOver(false);
    setScore(0);
    setStarted(true);
    setMessage("");
    dirRef.current = "RIGHT";
    tickRef.current = 0;
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!started) { if (e.key.startsWith("Arrow")) { start(); } return; }
      if (gameOver) return;
      const k = e.key.replace("Arrow", "").toUpperCase() as Dir;
      if (!["UP", "DOWN", "LEFT", "RIGHT"].includes(k)) return;
      if (k === OPP[dirRef.current]) return;
      dirRef.current = k;
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [started, gameOver]);

  useEffect(() => {
    if (!started || gameOver || !gameState) return;
    const interval = setInterval(() => {
      setGameState(prev => {
        if (!prev) return prev;
        const g = JSON.parse(JSON.stringify(prev)) as typeof prev;
        tickRef.current++;

        // Move player
        const pDir = dirRef.current;
        const ph = g.player.body[0];
        const pn = { x: ph.x + DX[pDir], y: ph.y + DY[pDir] };

        // Wall collision
        if (pn.x < 0 || pn.x >= COLS || pn.y < 0 || pn.y >= ROWS) {
          setGameOver(true);
          setHighScore(h => Math.max(h, score));
          setMessage("💀 Le serpent s'est cogné contre un arbre !");
          return prev;
        }

        // Self collision
        if (g.player.body.some(c => c.x === pn.x && c.y === pn.y)) {
          setGameOver(true);
          setHighScore(h => Math.max(h, score));
          setMessage("💀 Le serpent s'est mordu la queue !");
          return prev;
        }

        // AI collision
        let eaten = false;
        for (const ai of g.ai) {
          if (!ai.alive) continue;
          if (ai.body.some(c => c.x === pn.x && c.y === pn.y)) {
            const myLen = g.player.body.length;
            const aiLen = ai.body.length;
            if (myLen > aiLen + 2) {
              // Eat AI
              ai.alive = false;
              const bonus = aiLen;
              for (let i = ai.body.length - 1; i >= 0; i--) {
                g.player.body.push(ai.body[i]);
              }
              setScore(s => s + 10 + bonus);
              setMessage(`🐍 Tu as mangé ${ai.name} ! +${10 + bonus} pts`);
            } else {
              setGameOver(true);
              setHighScore(h => Math.max(h, score));
              setMessage(`💀 ${ai.name} t'a mangé !`);
              return prev;
            }
            eaten = true;
            break;
          }
        }
        if (eaten) { /* already handled */ }

        // Crypto collection
        let cryptoEaten = false;
        g.cryptos = g.cryptos.filter(cr => {
          if (cr.x === pn.x && cr.y === pn.y) {
            cryptoEaten = true;
            // Grow
            g.player.body.push({ ...g.player.body[g.player.body.length - 1] });
            setScore(s => s + 5);
            setMessage(`🪙 ${cr.emoji} trouvé dans ${terrain[cr.y][cr.x] === "tree" ? "un arbre" : "la rivière"} ! +5 pts`);
            // Respawn crypto
            const np = randomRiverOrTree(terrain);
            if (np) return false; // remove old, new one added below
            return false;
          }
          return true;
        });
        if (cryptoEaten) {
          const np = randomRiverOrTree(terrain);
          if (np) g.cryptos.push({ x: np.x, y: np.y, emoji: COINS[rand(COINS.length)] });
        }

        // Move player body
        g.player.body.unshift(pn);
        if (!cryptoEaten && g.player.body.length > 3) {
          // Only trim if we didn't grow (but we might have grown from AI)
          let targetLen = 3;
          let aiEatenCount = 0;
          for (const ai of prev.ai) {
            if (!ai.alive && !g.ai.find(a => a.id === ai.id)?.alive) aiEatenCount++;
          }
          // Only trim if no crypto or AI eaten this tick
          if (!cryptoEaten && !eaten) {
            while (g.player.body.length > targetLen + aiEatenCount * 2) {
              g.player.body.pop();
            }
          }
        }
        // Keep proper length - actually just trim to current length
        while (g.player.body.length > g.player.body.length) { /* noop */ }

        // Move AI
        for (const ai of g.ai) {
          if (!ai.alive) continue;
          // Change direction randomly
          if (Math.random() < 0.15) {
            const dirs: Dir[] = ["UP", "DOWN", "LEFT", "RIGHT"];
            const nd = dirs[rand(4)];
            if (nd !== OPP[ai.dir]) ai.dir = nd;
          }

          const ah = ai.body[0];
          const an = { x: ah.x + DX[ai.dir], y: ah.y + DY[ai.dir] };

          // AI wall check
          if (an.x < 0 || an.x >= COLS || an.y < 0 || an.y >= ROWS || terrain[an.y][an.x] !== "grass") {
            // Try other directions
            const dirs: Dir[] = ["UP", "DOWN", "LEFT", "RIGHT"];
            for (const d of dirs) {
              if (d === OPP[ai.dir]) continue;
              const nn = { x: ah.x + DX[d], y: ah.y + DY[d] };
              if (nn.x >= 0 && nn.x < COLS && nn.y >= 0 && nn.y < ROWS && terrain[nn.y][nn.x] === "grass") {
                ai.dir = d;
                break;
              }
            }
            // Still blocked - skip
            continue;
          }

          // Check AI vs AI collision
          let blocked = false;
          for (const other of g.ai) {
            if (other.id === ai.id || !other.alive) continue;
            if (other.body.some(c => c.x === an.x && c.y === an.y)) {
              if (other.body.length > ai.body.length + 2) {
                ai.alive = false;
                // Other AI eats this AI (we don't update score for AI vs AI)
              }
              blocked = true;
              break;
            }
          }
          if (blocked) continue;

          // Check AI vs player collision
          if (g.player.body.some(c => c.x === an.x && c.y === an.y)) {
            const myLen = ai.body.length;
            const pLen = g.player.body.length;
            if (myLen > pLen + 2) {
              setGameOver(true);
              setHighScore(h => Math.max(h, score));
              setMessage(`💀 ${ai.name} t'a attrapé !`);
              return prev;
            }
            continue;
          }

          // Move AI body
          ai.body.unshift(an);
          ai.body.pop();
        }

        // Increment score for survival
        if (tickRef.current % 5 === 0) setScore(s => s + 1);

        gameRef.current = g;
        return g;
      });
    }, TICK);
    return () => clearInterval(interval);
  }, [started, gameOver, gameState, terrain]);

  // Cleanup unused gameState check
  // We handle AI deaths and game over inside the setState callback

  // Recalculate gameOver from state changes
  // (handled inside setState)

  const renderTerrain = (x: number, y: number) => {
    const t = terrain[y][x];
    if (t === "tree") return <span key={`t${x}-${y}`} className="text-md select-none">🌲</span>;
    if (t === "river") return <span key={`r${x}-${y}`} className="text-md select-none">🌊</span>;
    return <span key={`g${x}-${y}`} className="text-md select-none" style={{ opacity: 0.3 }}>🌿</span>;
  };

  const allSnakes = gameState
    ? [gameState.player, ...gameState.ai.filter(a => a.alive)]
    : [];

  const snakePositions = new Map<string, { x: number; y: number; isHead: boolean; color: string; name: string }>();
  if (gameState) {
    for (const s of [gameState.player, ...gameState.ai]) {
      if (!s.alive) continue;
      s.body.forEach((c, i) => {
        snakePositions.set(`${c.x}-${c.y}`, { x: c.x, y: c.y, isHead: i === 0, color: s.color, name: s.name });
      });
    }
  }

  const cellSize = Math.min(Math.floor((typeof window !== "undefined" ? Math.min(window.innerWidth - 40, 600) : 600) / COLS), 22);

  return (
    <section className="py-16 px-2 border-t border-border">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl font-bold mb-1">🐍 Forêt des Cryptos</h2>
        <p className="text-text-secondary text-sm mb-4 max-w-lg mx-auto">
          Cherche les cryptos dans les arbres 🌲 et la rivière 🌊. Mange des petits serpents pour grandir,
          évite les plus gros que toi !
        </p>

        {/* HUD */}
        <div className="flex items-center justify-center gap-3 mb-4 flex-wrap text-sm">
          <div className="px-4 py-1.5 rounded-lg bg-surface border border-border">
            <span className="text-text-muted">Score </span>
            <span className="font-bold text-warning">{score}</span>
          </div>
          <div className="px-4 py-1.5 rounded-lg bg-surface border border-border">
            <span className="text-text-muted">Record </span>
            <span className="font-bold text-primary">{highScore}</span>
          </div>
          <div className="px-4 py-1.5 rounded-lg bg-surface border border-border">
            <span className="text-text-muted">Taille </span>
            <span className="font-bold" style={{ color: "#22c55e" }}>{gameState?.player.body.length ?? 0}</span>
          </div>
          <div className="flex gap-2">
            {gameState?.ai.filter(a => a.alive).map(a => (
              <div key={a.id} className="flex items-center gap-1 px-2 py-1 rounded bg-surface border border-border text-xs">
                <span className="w-2 h-2 rounded-full" style={{ background: a.color }} />
                <span className="text-text-muted">{a.name}</span>
                <span className="font-mono font-bold" style={{ color: a.color }}>{a.body.length}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className="mb-3 text-sm py-2 px-4 rounded-xl bg-surface border border-border animate-pulse inline-block">
            {message}
          </div>
        )}

        {/* Map */}
        <div className="relative mx-auto border-2 border-border rounded-xl overflow-hidden bg-gradient-to-b from-emerald-950/40 to-emerald-900/20 shadow-2xl">
          {!started && !gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/85 z-20">
              <div className="text-center p-6">
                <p className="text-5xl mb-3">🐍</p>
                <p className="text-lg font-bold mb-1">Forêt des Cryptos</p>
                <p className="text-xs text-text-secondary mb-4 max-w-xs">
                  Explore la forêt, trouve les cryptos, mange des petits serpents et deviens le plus gros !
                </p>
                <button onClick={start} className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors">
                  🎮 Jouer
                </button>
                <div className="mt-3 flex justify-center gap-2 text-sm opacity-50">
                  <span>←</span><span>↑</span><span>↓</span><span>→</span>
                </div>
              </div>
            </div>
          )}
          {gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/85 z-20">
              <div className="text-center p-6">
                <p className="text-5xl mb-2">💀</p>
                <p className="text-lg font-bold text-danger mb-1">Game Over</p>
                <p className="text-sm text-text-secondary mb-1">Score: {score}</p>
                <p className="text-xs text-text-muted mb-4">{message}</p>
                <button onClick={start} className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors">
                  🔄 Rejouer
                </button>
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`, gridTemplateRows: `repeat(${ROWS}, ${cellSize}px)` }}>
            {Array.from({ length: ROWS }).map((_, y) =>
              Array.from({ length: COLS }).map((_, x) => {
                const t = terrain[y][x];
                let bg = t === "tree" ? "rgba(34,197,94,0.12)" : t === "river" ? "rgba(14,165,233,0.12)" : "rgba(0,0,0,0.02)";
                return (
                  <div key={`c${x}-${y}`} style={{ width: cellSize, height: cellSize, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: cellSize * 0.6 }}>
                    {t === "tree" && "🌲"}
                    {t === "river" && "🌊"}
                  </div>
                );
              })
            )}
            {/* Cryptos */}
            {gameState?.cryptos.map(cr => (
              <div key={`cr${cr.x}-${cr.y}`} className="absolute z-10 flex items-center justify-center animate-bounce" style={{ left: cr.x * cellSize, top: cr.y * cellSize, width: cellSize, height: cellSize, fontSize: cellSize * 0.55 }}>
                {cr.emoji}
              </div>
            ))}
            {/* Snakes */}
            {allSnakes.map(s =>
              s.body.map((c, i) => (
                <div key={`${s.id}-${i}`} className="absolute z-10 flex items-center justify-center" style={{
                  left: c.x * cellSize + 1,
                  top: c.y * cellSize + 1,
                  width: cellSize - 2,
                  height: cellSize - 2,
                  borderRadius: i === 0 ? cellSize * 0.3 : cellSize * 0.15,
                  background: i === 0
                    ? `linear-gradient(135deg, ${s.color}, ${s.color}dd)`
                    : s.color,
                  opacity: 1 - i * 0.02,
                  boxShadow: i === 0 ? `0 0 8px ${s.color}66` : "none",
                  zIndex: 100 - i,
                  transition: "all 0.05s",
                  fontSize: cellSize * 0.35,
                  fontWeight: "bold",
                  color: "white",
                }}>
                  {i === 0 && (s.isPlayer ? "🐍" : "")}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Légende */}
        <div className="mt-4 flex justify-center gap-4 text-xs text-text-muted flex-wrap">
          <span>🌲 Arbres (cryptos)</span>
          <span>🌊 Rivière (cryptos)</span>
          <span>🟢 Toi</span>
          {gameState?.ai.filter(a => a.alive).map(a => (
            <span key={a.id} style={{ color: a.color }}>● {a.name} ({a.body.length})</span>
          ))}
        </div>

        {/* Contrôles tactiles */}
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={() => { const e = new KeyboardEvent("keydown", { key: "ArrowUp" }); window.dispatchEvent(e); }} className="w-11 h-11 rounded-xl bg-surface border border-border text-base hover:bg-surface-light">↑</button>
          <div className="flex gap-2">
            <button onClick={() => { const e = new KeyboardEvent("keydown", { key: "ArrowLeft" }); window.dispatchEvent(e); }} className="w-11 h-11 rounded-xl bg-surface border border-border text-base hover:bg-surface-light">←</button>
            <button onClick={() => { const e = new KeyboardEvent("keydown", { key: "ArrowDown" }); window.dispatchEvent(e); }} className="w-11 h-11 rounded-xl bg-surface border border-border text-base hover:bg-surface-light">↓</button>
            <button onClick={() => { const e = new KeyboardEvent("keydown", { key: "ArrowRight" }); window.dispatchEvent(e); }} className="w-11 h-11 rounded-xl bg-surface border border-border text-base hover:bg-surface-light">→</button>
          </div>
        </div>
      </div>
    </section>
  );
}
