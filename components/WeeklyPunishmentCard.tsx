"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthProvider";
import { motion, AnimatePresence } from "framer-motion";

type Item = { id: string; text: string; active: boolean; created_by?: string | null };

export function WeeklyPunishmentCard({ lobbyId, seasonStart, isOwner }: { lobbyId: string; seasonStart?: string; isOwner?: boolean }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<Item | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [week, setWeek] = useState<number | null>(null);
  const [mePlayerId, setMePlayerId] = useState<string | null>(null);
  const [allReady, setAllReady] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locked, setLocked] = useState<boolean>(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [wheelSegs, setWheelSegs] = useState<string[]>([]);
  const wheelBg = useMemo(() => {
    const segs = wheelSegs.length || 1;
    const per = 360 / segs;
    const colors = ["#E1542A", "#4A2620", "#567568", "#EBD4A4"];
    const stops: string[] = [];
    for (let i = 0; i < segs; i++) {
      const start = per * i;
      const end = per * (i + 1);
      const col = colors[i % colors.length];
      stops.push(`${col} ${start}deg ${end}deg`);
    }
    return `conic-gradient(${stops.join(",")})`;
  }, [wheelSegs]);

  useEffect(() => {
    if (typeof window !== "undefined") setMePlayerId(localStorage.getItem("gymdm_playerId"));
  }, []);

  async function load() {
    try {
      const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/punishments`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrorMsg(j?.error || "Failed to load punishments");
        return;
      }
      const j = await res.json();
      setItems(j.items || []);
      setActive(j.active || null);
      setWeek(j.week || null);
      if (typeof j.locked === "boolean") setLocked(!!j.locked);
      setErrorMsg(null);
    } catch { /* ignore */ }
  }

  useEffect(() => { 
    load(); 
    const id = setInterval(load, 5 * 1000); // Poll every 5 seconds
    return () => clearInterval(id);
  }, [lobbyId]);
  // Poll readiness (lightweight via live route)
  useEffect(() => {
    let tm: any;
    async function poll() {
      try {
        const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/live`, { cache: "no-store" });
        if (res.ok) {
          const j = await res.json();
          const players = (j?.lobby?.players || []) as Array<{ ready?: boolean }>;
          const total = players.length;
          const readyCount = players.filter(p => p.ready).length;
          setAllReady(total > 0 && readyCount === total);
          (window as any).__gymdm_ready = `${readyCount}/${total}`;
        }
      } catch { /* ignore */ }
      tm = setTimeout(poll, 10000);
    }
    poll();
    return () => clearTimeout(tm);
  }, [lobbyId]);

  async function suggest() {
    if (!text.trim() || !mePlayerId) return;
    setBusy(true);
    try {
      await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/punishments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim().slice(0, 50), playerId: mePlayerId })
      }).then(async r => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error || "Submit failed");
        }
      });
      setText("");
      await load();
      setErrorMsg(null);
    } finally { setBusy(false); }
  }

  async function spin() {
    setBusy(true);
    try {
      // Prepare wheel
      const segs = (items || []).map(i => i.text);
      if (segs.length >= 2) {
        setWheelSegs(segs);
        setWheelOpen(true);
      }
      const r = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/spin`, { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErrorMsg(j?.error || "Spin failed — retry");
        setWheelOpen(false);
        return;
      }
      const j = await r.json().catch(() => ({}));
      await load();
      // confetti
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1800);
      // Force wheel to land on the chosen item if visible
      if (segs.length >= 2 && j?.chosen) {
        const idx = segs.findIndex(t => t === j.chosen.text);
        if (idx >= 0) {
          const per = 360 / segs.length;
          // target angle so chosen segment lands at 0 deg marker; add full spins for drama
          const target = 360 * 6 + (per * idx) + per / 2;
          setWheelAngle(target);
          setTimeout(() => setWheelOpen(false), 2600);
        } else {
          setWheelOpen(false);
        }
      }
    } finally { setBusy(false); }
  }

  async function setReady(ready: boolean) {
    if (!user?.id) return;
    const r = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/ready`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, ready })
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErrorMsg(j?.error || "Failed to set ready");
    }
  }

  const hasActive = !!active;
  const title = hasActive ? "CURRENT WEEK DETAILS" : "SUGGEST A PUNISHMENT";
  return (
    <div className="paper-card paper-grain ink-edge p-4 relative overflow-hidden">
      {showConfetti && (
        <div className="pointer-events-none absolute inset-0 animate-[fall_1.5s_ease-in-out]">
          <div className="absolute top-0 left-1/4">🎊</div>
          <div className="absolute top-0 left-1/2">🎉</div>
          <div className="absolute top-0 left-3/4">✨</div>
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="poster-headline text-sm uppercase tracking-wide">{title}</div>
        <div className="ml-auto text-xs text-deepBrown/70">{week ? `Week ${week}` : ""}</div>
      </div>
      {errorMsg && <div className="mt-2 text-[12px] text-[#a13535]">⚠ {errorMsg}</div>}
      {hasActive ? (
        <div className="mt-2">
          <div className="text-sm">“{active?.text}”</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-secondary px-3 py-2 rounded-md text-xs" onClick={() => setReady(true)}>Ready ✅</button>
            <button className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs" onClick={() => setReady(false)}>Not ready ⏳</button>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <div id="suggest-punishment" className="text-xs text-deepBrown/70 mb-2">Each player may submit one idea (50 chars). Owner can spin.</div>
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-md border border-deepBrown/30 bg-cream text-deepBrown"
              placeholder="e.g., Run a 5K in a costume 🎃"
              value={text}
              maxLength={50}
              onChange={e => setText(e.target.value)}
              disabled={locked}
            />
            <button className="btn-secondary px-3 py-2 rounded-md text-xs" disabled={busy || !text.trim() || locked} onClick={suggest}>Submit</button>
          </div>
          <div className="mt-3 text-xs text-deepBrown/70">Submissions:</div>
          <ul className="mt-1 text-sm list-disc pl-5">
            {items.map(i => (
              <li key={i.id} className="flex items-center gap-2">
                <span className="flex-1">{i.text}</span>
                {/* Resolve for self; approve for owner */}
                {(user?.id || isOwner) && (
                  <button
                    className="px-2 py-1 rounded-md border border-deepBrown/30 text-[11px]"
                    onClick={async () => {
                      try {
                        const r = await fetch(`/api/punishments/${encodeURIComponent(i.id)}/resolve`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userId: user?.id || null, approve: isOwner || false })
                        });
                        if (!r.ok) {
                          const j = await r.json().catch(() => ({}));
                          setErrorMsg(j?.error || "Resolve failed");
                        } else {
                          setErrorMsg(null);
                        }
                      } catch {
                        setErrorMsg("Resolve failed");
                      }
                    }}
                  >
                    Mark resolved
                  </button>
                )}
              </li>
            ))}
            {!items.length && <li className="text-deepBrown/60">No submissions yet.</li>}
          </ul>
          <div className="mt-3 flex gap-2 items-center">
            <button className="btn-vintage px-3 py-2 rounded-md text-xs" disabled={busy || items.length === 0 || locked} onClick={spin}>Spin roulette 🎡</button>
            {isOwner && (
              <button
                className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs"
                onClick={async () => {
                  try {
                    const r = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/punishments/lock`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ locked: !locked })
                    });
                    if (!r.ok) {
                      const j = await r.json().catch(() => ({}));
                      setErrorMsg(j?.error || "Lock toggle failed");
                    } else {
                      setErrorMsg(null);
                      setLocked(!locked);
                      await load();
                    }
                  } catch {
                    setErrorMsg("Lock toggle failed");
                  }
                }}
              >
                {locked ? "Unlock list" : "Lock list"}
              </button>
            )}
          </div>
        </div>
      )}
      {isOwner && (
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <button
            className={`btn-secondary px-3 py-2 rounded-md text-xs ${!allReady ? "opacity-60" : ""}`}
            disabled={!allReady}
            onClick={async () => {
              if (!confirm("Start the match now? All players are marked Ready.")) return;
              await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/stage`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startNow: true })
              });
            }}
          >
            Start match
          </button>
          <button
            className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs"
            onClick={async () => {
              if (!confirm("Owner override: start match now?")) return;
              await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/stage`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startNow: true })
              });
            }}
          >
            Override start (owner)
          </button>
          <div className="text-[11px] text-deepBrown/70">{allReady ? "All players ready" : `Waiting for players… ${(window as any).__gymdm_ready || ""}`}</div>
        </div>
      )}
      {/* Spinning wheel overlay */}
      <AnimatePresence>
        {wheelOpen && wheelSegs.length >= 2 && (
          <motion.div
            className="absolute inset-0 bg-black/60 flex items-center justify-center z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="relative h-64 w-64">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl">▼</div>
              <motion.div
                className="h-full w-full rounded-full overflow-hidden border-4 border-cream"
                animate={{ rotate: wheelAngle }}
                transition={{ duration: 2.2, ease: [0.17, 0.67, 0.22, 0.99] }}
                style={{ background: wheelBg }}
              >
                {/* Simple wedge labels */}
                <div className="relative h-full w-full">
                  {wheelSegs.map((t, i) => {
                    const angle = (360 / wheelSegs.length) * i;
                    return (
                      <div key={i} className="absolute left-1/2 top-1/2 origin-left text-[10px] text-cream drop-shadow"
                        style={{ transform: `rotate(${angle}deg) translateX(14px)` }}>
                        {t.slice(0, 24)}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


