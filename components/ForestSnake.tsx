"use client";

import { useState, useEffect, useRef } from "react";

const COLS = 30;
const ROWS = 30;
const CELL = 18;
const TICK = 160;
const COINS = ["₿", "ETH", "SOL", "ADA", "DOT"];

type Dir = "U" | "D" | "L" | "R";
const OPP: Record<Dir, Dir> = { U: "D", D: "U", L: "R", R: "L" };
const DX: Record<Dir, number> = { U: 0, D: 0, L: -1, R: 1 };
const DY: Record<Dir, number> = { U: -1, D: 1, L: 0, R: 0 };

function rng(n: number) { return Math.floor(Math.random() * n); }

function makeTerrain() {
  const g: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill("."));
  // River
  let ry = 3 + rng(ROWS - 6);
  for (let x = 0; x < COLS; x++) {
    for (let d = -1; d <= 1; d++) { const yy = ry + d; if (yy >= 0 && yy < ROWS) g[yy][x] = "~"; }
    if (Math.random() < 0.3) ry += Math.random() < 0.5 ? 1 : -1;
    ry = Math.max(2, Math.min(ROWS - 3, ry));
  }
  // Trees
  for (let c = 0; c < 12; c++) {
    const cx = 2 + rng(COLS - 4), cy = 2 + rng(ROWS - 4);
    for (let i = 0; i < 6 + rng(5); i++) {
      const tx = cx + rng(5) - 2, ty = cy + rng(5) - 2;
      if (tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS && g[ty][tx] === ".") g[ty][tx] = "T";
    }
  }
  return g;
}

function grassCell(g: string[][]) {
  for (let i = 0; i < 200; i++) { const x = rng(COLS), y = rng(ROWS); if (g[y][x] === ".") return { x, y }; }
  return null;
}

function specialCell(g: string[][]) {
  for (let i = 0; i < 200; i++) { const x = rng(COLS), y = rng(ROWS); if (g[y][x] === "T" || g[y][x] === "~") return { x, y }; }
  return null;
}

interface Seg { x: number; y: number }
interface Bot { id: number; body: Seg[]; dir: Dir; alive: boolean; color: string; name: string }

const BOT_COLORS = ["#ef4444", "#a855f7", "#f97316", "#06b6d4", "#ec4899"];
const BOT_NAMES = ["Boa", "Cobra", "Naga", "Viper", "Mamba"];

export default function ForestSnake() {
  const terrain = useRef(makeTerrain());

  // Game state refs (no re-render)
  const pBody = useRef<Seg[]>([{ x: 12, y: 15 }, { x: 11, y: 15 }, { x: 10, y: 15 }]);
  const pDir = useRef<Dir>("R");
  const pNextDir = useRef<Dir>("R");
  const bots = useRef<Bot[]>([]);
  const cryptos = useRef<{ x: number; y: number; emoji: string }[]>([]);
  const alive = useRef(true);
  const msg = useRef("");
  const msgTimer = useRef(0);
  const tickC = useRef(0);
  const cryptoEatenCount = useRef(0);
  const nextBotId = useRef(10);

  const spawnBotIfNeeded = () => {
    if (cryptos.current.length === 0) return;
    const t = terrain.current;
    const used: Seg[] = [...pBody.current];
    bots.current.filter(b => b.alive).forEach(b => used.push(...b.body));
    for (let a = 0; a < 30; a++) {
      const h = grassCell(t); if (!h) break;
      const dir = (["U", "D", "L", "R"] as Dir[])[rng(4)];
      const len = 3 + rng(4);
      const body: Seg[] = [{ x: h.x, y: h.y }];
      let ok = true;
      for (let j = 1; j < len; j++) {
        const px = body[j - 1].x - DX[dir], py = body[j - 1].y - DY[dir];
        if (px < 0 || px >= COLS || py < 0 || py >= ROWS) { ok = false; break; }
        if (used.some(u => u.x === px && u.y === py)) { ok = false; break; }
        body.push({ x: px, y: py });
      }
      if (ok) {
        const id = nextBotId.current++;
        const color = BOT_COLORS[rng(BOT_COLORS.length)];
        const name = BOT_NAMES[rng(BOT_NAMES.length)];
        bots.current.push({ id, body, dir, alive: true, color, name });
        msg.current = `🐍 Nouveau serpent apparait : ${name} !`;
        msgTimer.current = tickC.current;
        break;
      }
    }
  };

  // Force render counter
  const [tick, setTick] = useState(0);
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState(0);
  const [hi, setHi] = useState(0);

  const rerender = () => setTick(t => t + 1);

  const startGame = () => {
    const t = terrain.current;
    pBody.current = [{ x: 12, y: 15 }, { x: 11, y: 15 }, { x: 10, y: 15 }];
    pDir.current = "R";
    pNextDir.current = "R";
    alive.current = true;
    msg.current = "";
    msgTimer.current = 0;
    tickC.current = 0;
    cryptoEatenCount.current = 0;
    const used = [...pBody.current];

    const newBots: Bot[] = [];
    for (let i = 0; i < 4; i++) {
      const len = 3 + rng(4);
      for (let a = 0; a < 50; a++) {
        const h = grassCell(t); if (!h) break;
        const dir = (["U", "D", "L", "R"] as Dir[])[rng(4)];
        const body: Seg[] = [{ x: h.x, y: h.y }];
        let ok = true;
        for (let j = 1; j < len; j++) {
          const px = body[j - 1].x - DX[dir], py = body[j - 1].y - DY[dir];
          if (px < 0 || px >= COLS || py < 0 || py >= ROWS || t[py][px] !== ".") { ok = false; break; }
          if (used.some(u => u.x === px && u.y === py)) { ok = false; break; }
          body.push({ x: px, y: py });
        }
        if (ok) {
          used.push(...body);
          newBots.push({ id: i, body, dir, alive: true, color: BOT_COLORS[i], name: BOT_NAMES[i] });
          break;
        }
      }
    }
    bots.current = newBots;

    const newCryptos: { x: number; y: number; emoji: string }[] = [];
    for (let i = 0; i < 10; i++) {
      const p = specialCell(t); if (p) newCryptos.push({ x: p.x, y: p.y, emoji: COINS[rng(COINS.length)] });
    }
    cryptos.current = newCryptos;

    setScore(0);
    setOver(false);
    setWon(false);
    setStarted(true);
    rerender();
  };

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!e.key.startsWith("Arrow")) return;
      e.preventDefault();
      if (!started) { startGame(); return; }
      if (!alive.current) return;
      const k = ({ ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R" } as Record<string, Dir>)[e.key];
      if (!k) return;
      if (k === OPP[pDir.current]) return;
      pNextDir.current = k;
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [started]);

  // Game loop
  useEffect(() => {
    if (!started || over || won) return;
    const interval = setInterval(() => {
      if (!alive.current || won) return;
      tickC.current++;

      const t = terrain.current;
      const p = pBody.current;
      const dir = pNextDir.current;
      pDir.current = dir;

      const h = p[0];
      const nx = h.x + DX[dir], ny = h.y + DY[dir];

      // Wall
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
        alive.current = false; msg.current = "💀 Mur !"; msgTimer.current = tickC.current;
        setOver(true); setHi(h => Math.max(h, score)); rerender(); return;
      }

      // Self collision
      if (p.some(c => c.x === nx && c.y === ny)) {
        alive.current = false; msg.current = "💀 Tu t'es mordu la queue !"; msgTimer.current = tickC.current;
        setOver(true); setHi(h => Math.max(h, score)); rerender(); return;
      }

      // Check AI collisions
      let aiEatenThisTick = false;
      for (const b of bots.current) {
        if (!b.alive) continue;
        if (b.body.some(c => c.x === nx && c.y === ny)) {
          if (p.length > b.body.length + 1) {
            b.alive = false;
            const bonus = b.body.length;
            p.push(...b.body);
            setScore(s => s + 15 + bonus);
            msg.current = `🐍 ${b.name} mangé ! +${15 + bonus} pts`;
            msgTimer.current = tickC.current;
            aiEatenThisTick = true;
            if (cryptos.current.length > 0) spawnBotIfNeeded();
          } else {
            alive.current = false; msg.current = `💀 ${b.name} t'a mangé !`; msgTimer.current = tickC.current;
            setOver(true); setHi(h => Math.max(h, score)); rerender(); return;
          }
          break;
        }
      }

      // Crypto
      let cryptoEaten = false;
      for (let i = cryptos.current.length - 1; i >= 0; i--) {
        const cr = cryptos.current[i];
        if (cr.x === nx && cr.y === ny) {
          cryptos.current.splice(i, 1);
          cryptoEaten = true;
          cryptoEatenCount.current++;
          p.push({ ...p[p.length - 1] });
          setScore(s => s + 5);
          const loc = t[ny][nx] === "T" ? "un arbre 🌲" : "la rivière 🌊";
          msg.current = `🪙 ${cr.emoji} trouvé dans ${loc} ! +5 pts`;
          msgTimer.current = tickC.current;

          // Level complete if all cryptos collected
          if (cryptos.current.length === 0) {
            setWon(true);
            setHi(h => Math.max(h, score));
            msg.current = "🎉 Niveau terminé ! Toutes les cryptos collectées !";
            msgTimer.current = tickC.current;
          }
          break;
        }
      }

      // Move player
      p.unshift({ x: nx, y: ny });
      if (!cryptoEaten && !aiEatenThisTick) p.pop();

      // Move AI
      for (const b of bots.current) {
        if (!b.alive) continue;

        // AI behavior: chase player if bigger, flee if smaller
        const bh = b.body[0];
        const pHead = p[0];
        const distToPlayer = Math.abs(pHead.x - bh.x) + Math.abs(pHead.y - bh.y);
        let targetDir: Dir | null = null;
        if (distToPlayer <= 8) {
          if (b.body.length > p.length + 1) {
            if (pHead.x < bh.x && b.dir !== "L") targetDir = "L";
            else if (pHead.x > bh.x && b.dir !== "R") targetDir = "R";
            else if (pHead.y < bh.y && b.dir !== "U") targetDir = "U";
            else if (pHead.y > bh.y && b.dir !== "D") targetDir = "D";
          } else {
            if (pHead.x < bh.x && b.dir !== "R") targetDir = "R";
            else if (pHead.x > bh.x && b.dir !== "L") targetDir = "L";
            else if (pHead.y < bh.y && b.dir !== "D") targetDir = "D";
            else if (pHead.y > bh.y && b.dir !== "U") targetDir = "U";
          }
        }
        if (targetDir && Math.random() < 0.85) b.dir = targetDir;
        else if (Math.random() < 0.12) {
          const dirs: Dir[] = ["U", "D", "L", "R"];
          const nd = dirs[rng(4)];
          if (nd !== OPP[b.dir]) b.dir = nd;
        }

        const bnx = bh.x + DX[b.dir], bny = bh.y + DY[b.dir];

        // Wall block for AI
        if (bnx < 0 || bnx >= COLS || bny < 0 || bny >= ROWS) {
          const dirs: Dir[] = ["U", "D", "L", "R"];
          for (const d of dirs) {
            if (d === OPP[b.dir]) continue;
            const nnx = bh.x + DX[d], nny = bh.y + DY[d];
            if (nnx >= 0 && nnx < COLS && nny >= 0 && nny < ROWS) {
              b.dir = d; break;
            }
          }
          continue;
        }

        const bnx2 = bh.x + DX[b.dir], bny2 = bh.y + DY[b.dir];
        if (bnx2 < 0 || bnx2 >= COLS || bny2 < 0 || bny2 >= ROWS) continue;

        // AI vs AI - just block, no eating
        let blocked = false;
        for (const ob of bots.current) {
          if (ob.id === b.id || !ob.alive) continue;
          if (ob.body.some(c => c.x === bnx2 && c.y === bny2)) {
            blocked = true; break;
          }
        }
        if (blocked) continue;

        // AI vs player
        if (p.some(c => c.x === bnx2 && c.y === bny2)) {
          if (b.body.length > p.length + 1) {
            alive.current = false; msg.current = `💀 ${b.name} t'a attrapé !`; msgTimer.current = tickC.current;
            setOver(true); setHi(h => Math.max(h, score)); rerender(); return;
          }
          continue;
        }

        b.body.unshift({ x: bnx2, y: bny2 });
        b.body.pop();
      }

      // Survival score
      if (tickC.current % 5 === 0) setScore(s => s + 1);
      rerender();
    }, TICK);
    return () => clearInterval(interval);
  }, [started, over, won]);

  const msgText = msg.current && tickC.current - msgTimer.current < 30 ? msg.current : "";

  const cs = 18;
  const mw = COLS * cs, mh = ROWS * cs;

  return (
    <section className="py-12 px-2 border-t border-border">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl font-bold mb-1">🐍 Forêt des Cryptos</h2>
        <p className="text-text-secondary text-xs mb-3 max-w-md mx-auto">
          Flèches ←↑↓→. Collecte toutes les 🪙 cryptos pour gagner. Mange les petits serpents, fuis les gros !
        </p>

        <div className="flex items-center justify-center gap-2 mb-3 flex-wrap text-xs">
          <div className="px-3 py-1 rounded-lg bg-surface border border-border">
            <span className="text-text-muted">Score </span>
            <span className="font-bold text-warning">{score}</span>
          </div>
          <div className="px-3 py-1 rounded-lg bg-surface border border-border">
            <span className="text-text-muted">Record </span>
            <span className="font-bold text-primary">{hi}</span>
          </div>
          <div className="px-3 py-1 rounded-lg bg-surface border border-border">
            <span className="text-text-muted">🐍 Taille </span>
            <span className="font-bold" style={{ color: "#22c55e" }}>{pBody.current.length}</span>
          </div>
          <div className="px-3 py-1 rounded-lg bg-surface border border-border">
            <span className="text-text-muted">🪙 </span>
            <span className="font-bold text-warning">{cryptoEatenCount.current}</span>
            <span className="text-text-muted text-[10px] ml-0.5">trouvées</span>
          </div>
          {bots.current.filter(b => b.alive).map(b => (
            <div key={b.id} className="px-2 py-1 rounded bg-surface border border-border text-[10px] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
              <span className="text-text-muted">{b.name}</span>
              <span className="font-bold" style={{ color: b.color }}>{b.body.length}</span>
            </div>
          ))}
        </div>

        {msgText && (
          <div className="mb-2 text-xs py-1.5 px-3 rounded-xl bg-surface border border-border inline-block">{msgText}</div>
        )}

        <div className="relative mx-auto border-2 border-border rounded-xl overflow-hidden bg-gradient-to-b from-emerald-950/30 to-emerald-900/10 shadow-2xl" style={{ width: mw, height: mh }}>
          {!started && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/85 z-20">
              <div className="text-center p-6">
                <p className="text-5xl mb-2">🐍</p>
                <p className="text-base font-bold mb-1">Forêt des Cryptos</p>
                <p className="text-xs text-text-secondary mb-3">Serpents, cryptos et dangers t&apos;attendent !</p>
                <button onClick={startGame} className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">🎮 Jouer</button>
                <div className="mt-2 text-sm opacity-40">← ↑ ↓ →</div>
              </div>
            </div>
          )}
          {over && !won && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/85 z-20">
              <div className="text-center p-6">
                <p className="text-4xl mb-1">💀</p>
                <p className="text-base font-bold text-danger mb-1">Game Over</p>
                <p className="text-xs text-text-secondary mb-1">Score: {score}</p>
                {msgText && <p className="text-[10px] text-text-muted mb-3">{msgText}</p>}
                <button onClick={startGame} className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">🔄 Rejouer</button>
              </div>
            </div>
          )}
          {won && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/85 z-20">
              <div className="text-center p-6">
                <p className="text-4xl mb-1">🏆</p>
                <p className="text-base font-bold text-success mb-1">Niveau terminé !</p>
                <p className="text-xs text-text-secondary mb-1">Score: {score} | 🪙 {cryptoEatenCount.current} cryptos trouvées</p>
                <p className="text-[10px] text-text-muted mb-3">Toutes les cryptos de la forêt ont été collectées !</p>
                <button onClick={startGame} className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">🔄 Nouvelle partie</button>
              </div>
            </div>
          )}

          {/* Terrain */}
          {Array.from({ length: ROWS }).map((_, y) =>
            Array.from({ length: COLS }).map((_, x) => {
              const ch = terrain.current[y][x];
              let bg = "rgba(0,0,0,0.02)";
              if (ch === "T") bg = "rgba(34,197,94,0.10)";
              if (ch === "~") bg = "rgba(14,165,233,0.10)";
              return (
                <div key={`${x}-${y}`} style={{
                  position: "absolute", left: x * cs, top: y * cs, width: cs, height: cs,
                  background: bg, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: cs * 0.55, pointerEvents: "none",
                }}>
                  {ch === "T" && "🌲"}{ch === "~" && "🌊"}
                </div>
              );
            })
          )}

          {/* Cryptos */}
          {cryptos.current.map((cr, i) => (
            <div key={i} className="absolute z-10 flex items-center justify-center" style={{
              width: cs, height: cs, fontSize: cs * 0.5, pointerEvents: "none",
              transform: `translate3d(${cr.x * cs}px, ${cr.y * cs}px, 0)`,
              willChange: "transform",
            }}>
              {cr.emoji}
            </div>
          ))}

          {/* AI Snakes */}
          {bots.current.filter(b => b.alive).map(b =>
            b.body.map((c, i, arr) => {
              const isHead = i === 0;
              const isTail = i === arr.length - 1;
              const segLen = arr.length;
              const size = isTail ? cs * 0.7 : cs * 0.85;
              const offset = (cs - size) / 2;
              const alpha = 1 - (i / segLen) * 0.35;

              // Determine segment direction for rotation
              let prevSeg = i < arr.length - 1 ? arr[i + 1] : arr[i];
              let nextSeg = i > 0 ? arr[i - 1] : arr[i];
              let angle = 0;
              if (isHead) {
                const nd = pDir.current;
                if (nd === "R") angle = 0;
                else if (nd === "L") angle = 180;
                else if (nd === "D") angle = 90;
                else if (nd === "U") angle = -90;
              } else {
                if (c.x < prevSeg.x) angle = 180;
                else if (c.x > prevSeg.x) angle = 0;
                else if (c.y < prevSeg.y) angle = -90;
                else if (c.y > prevSeg.y) angle = 90;
              }

              return (
                <div key={`${b.id}-${i}`} className="absolute" style={{
                  width: size, height: size,
                  transform: `translate3d(${c.x * cs + offset}px, ${c.y * cs + offset}px, 0)`,
                  borderRadius: isHead ? "40%" : "45%",
                  background: isHead
                    ? `radial-gradient(circle at 35% 35%, ${b.color}cc, ${b.color})`
                    : b.color,
                  opacity: alpha,
                  boxShadow: isHead ? `0 0 6px ${b.color}55` : "none",
                  zIndex: 50 - i,
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  willChange: "transform",
                }}>
                  {isHead && (
                    <>
                      <div style={{
                        position: "absolute", width: "100%", height: "100%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transform: `rotate(${angle}deg)`,
                      }}>
                        <span style={{ fontSize: cs * 0.3, lineHeight: 1, marginTop: -1 }}>👀</span>
                      </div>
                    </>
                  )}
                  {isTail && (
                    <div style={{
                      width: size * 0.5, height: size * 0.5,
                      borderRadius: "50%",
                      background: b.color,
                      opacity: 0.5,
                    }} />
                  )}
                </div>
              );
            })
          )}

          {/* Player Snake */}
          {pBody.current.map((c, i, arr) => {
            const isHead = i === 0;
            const isTail = i === arr.length - 1;
            const segLen = arr.length;
            const size = isTail ? cs * 0.7 : cs * 0.88;
            const offset = (cs - size) / 2;
            const alpha = 1 - (i / segLen) * 0.3;

            let angle = 0;
            if (isHead) {
              const nd = pDir.current;
              if (nd === "R") angle = 0;
              else if (nd === "L") angle = 180;
              else if (nd === "D") angle = 90;
              else if (nd === "U") angle = -90;
            } else {
              const prevSeg = i < arr.length - 1 ? arr[i + 1] : arr[i];
              if (c.x < prevSeg.x) angle = 180;
              else if (c.x > prevSeg.x) angle = 0;
              else if (c.y < prevSeg.y) angle = -90;
              else if (c.y > prevSeg.y) angle = 90;
            }

            return (
              <div key={i} className="absolute" style={{
                width: size, height: size,
                transform: `translate3d(${c.x * cs + offset}px, ${c.y * cs + offset}px, 0)`,
                borderRadius: isHead ? "40%" : "45%",
                background: isHead
                  ? `radial-gradient(circle at 35% 35%, #4ade80, #22c55e)`
                  : `linear-gradient(135deg, #22c55e, ${i < 3 ? "#16a34a" : "#15803d"})`,
                opacity: alpha,
                boxShadow: isHead ? "0 0 8px #22c55e66" : "none",
                zIndex: 100 - i,
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                willChange: "transform",
              }}>
                {isHead && (
                  <div style={{
                    position: "absolute", width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transform: `rotate(${angle}deg)`,
                  }}>
                    <span style={{ fontSize: cs * 0.35, lineHeight: 1, marginTop: -1.5, filter: "drop-shadow(0 0 1px #000)" }}>👀</span>
                  </div>
                )}
                {isTail && (
                  <div style={{
                    width: size * 0.5, height: size * 0.5, borderRadius: "50%",
                    background: "#15803d", opacity: 0.4,
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile controls - D-pad */}
        <div className="mt-3 flex flex-col items-center">
          <button onPointerDown={() => { const e = new KeyboardEvent("keydown", { key: "ArrowUp" }); window.dispatchEvent(e); }}
            className="w-11 h-11 rounded-xl bg-surface border border-border text-base hover:bg-surface-light active:bg-surface-light">↑</button>
          <div className="flex gap-1.5 -mt-0.5">
            <button onPointerDown={() => { const e = new KeyboardEvent("keydown", { key: "ArrowLeft" }); window.dispatchEvent(e); }}
              className="w-11 h-11 rounded-xl bg-surface border border-border text-base hover:bg-surface-light active:bg-surface-light">←</button>
            <div className="w-11 h-11 flex items-center justify-center text-text-muted text-xs">⬤</div>
            <button onPointerDown={() => { const e = new KeyboardEvent("keydown", { key: "ArrowRight" }); window.dispatchEvent(e); }}
              className="w-11 h-11 rounded-xl bg-surface border border-border text-base hover:bg-surface-light active:bg-surface-light">→</button>
          </div>
          <button onPointerDown={() => { const e = new KeyboardEvent("keydown", { key: "ArrowDown" }); window.dispatchEvent(e); }}
            className="w-11 h-11 rounded-xl bg-surface border border-border text-base hover:bg-surface-light active:bg-surface-light -mt-0.5">↓</button>
        </div>

        {/* Legend */}
        <div className="mt-2 flex justify-center gap-3 text-[10px] text-text-muted flex-wrap">
          <span>🌲 Arbre (crypto)</span>
          <span>🌊 Rivière (crypto)</span>
          <span style={{ color: "#22c55e" }}>● Toi ({pBody.current.length})</span>
          {bots.current.filter(b => b.alive).map(b => (
            <span key={b.id} style={{ color: b.color }}>● {b.name} ({b.body.length})</span>
          ))}
        </div>
      </div>
    </section>
  );
}
