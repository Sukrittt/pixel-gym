"use client";
import { useEffect, useRef, useState } from "react";
import { PARAMS, type Params, type Snapshot } from "@/lib/body";
import type { EmoteKind, MemberView } from "@/lib/floor";
import { drawText, textWidth } from "@/lib/font";
import { shirtFit, spriteCanvas, SH, SW, type SpriteOpts } from "@/lib/sprite";

export function SpriteView({ opts, scale = 4, label }: { opts: SpriteOpts; scale?: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(opts);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(spriteCanvas(JSON.parse(key)), 0, 0, SW * scale, SH * scale);
  }, [key, scale]);
  return <canvas ref={ref} width={SW * scale} height={SH * scale} className="sprite" aria-label={label ?? "avatar"} />;
}

export function ParamBars({ p, compare }: { p: Params; compare?: Params }) {
  return (
    <div className="bars">
      {PARAMS.map((k) => (
        <div key={k} className="bar">
          <span>{k}</span>
          <div className="track">
            {compare && <div className="ghost" style={{ width: `${compare[k] * 10}%` }} />}
            <div className={`fill ${k}`} style={{ width: `${p[k] * 10}%` }} />
          </div>
          <b>{p[k].toFixed(1)}</b>
        </div>
      ))}
    </div>
  );
}

export function Timelapse({ series, look, who }: { series: Snapshot[]; look: MemberView["look"]; who?: string }) {
  const [i, setI] = useState(series.length - 1);
  const [playing, setPlaying] = useState(false);
  const idx = Math.min(i, series.length - 1);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setI((v) => {
        if (v >= series.length - 1) {
          setPlaying(false);
          return v;
        }
        return v + 1;
      });
    }, Math.max(16, 4000 / series.length));
    return () => clearInterval(id);
  }, [playing, series.length]);
  const s = series[idx];
  if (!s) return null;
  return (
    <div className="timelapse">
      <div className="tl-stage">
        <SpriteView opts={{ params: s.p, look, sat: s.sat }} scale={4} label={`body on ${s.date}`} />
        <div>
          <div className="tl-date">
            DAY {idx + 1} · {s.date}
          </div>
          <div className="muted">shirt: {shirtFit(s.p)}</div>
          <ParamBars p={s.p} compare={series[0].p} />
        </div>
      </div>
      {series.length > 1 ? (
        <div className="tl-controls">
          <button
            onClick={() => {
              if (idx >= series.length - 1) setI(0);
              setPlaying((v) => !v);
            }}
          >
            {playing ? "PAUSE" : "PLAY"}
          </button>
          <input type="range" min={0} max={series.length - 1} value={idx} onChange={(e) => (setPlaying(false), setI(+e.target.value))} aria-label="timelapse day" />
        </div>
      ) : (
        <p className="muted">{who ? `${who} is on day one. Their timelapse grows from tomorrow.` : "Day one. Come back tomorrow and this becomes a timelapse."}</p>
      )}
    </div>
  );
}

export function InspectCard({
  m, onClose, onEmote, loadSeries, isMe, floorName,
}: {
  m: MemberView;
  onClose: () => void;
  onEmote?: (k: EmoteKind) => Promise<number> | void;
  loadSeries: () => Promise<Snapshot[]>;
  isMe?: boolean;
  floorName: string;
}) {
  const [series, setSeries] = useState<Snapshot[] | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    loadSeries()
      .then((s) => live && setSeries(s))
      .catch(() => live && setSeries([]));
    return () => {
      live = false;
    };
  }, [loadSeries]);
  // proper dialog: focus inside, Escape closes, focus returns to the trigger
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !cardRef.current) return;
      // keep Tab inside the dialog
      const f = [...cardRef.current.querySelectorAll<HTMLElement>("button, input, a[href]")].filter((x) => !x.hasAttribute("disabled"));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      back?.focus?.();
    };
  }, [onClose]);
  const emote = async (k: EmoteKind) => {
    setSent("sending…");
    const status = await onEmote?.(k);
    setSent(status === undefined || status === 200 ? "sent!" : status === 429 ? "slow down a sec" : "couldn't send, check your connection");
  };
  const columns: [string, { p: Params; sat: number }][] = [
    ["START", m.snaps.day1],
    ...(m.days > 30 ? ([["30 DAYS AGO", m.snaps.ago30]] as [string, { p: Params; sat: number }][]) : []),
    [m.today && m.today.sets > 0 ? "TODAY (PUMPED)" : "TODAY", { p: m.params, sat: m.sat }],
  ];
  return (
    <div className="modal" onClick={onClose}>
      <div className="card" ref={cardRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${m.name} inspection card`} onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h2>{m.name}</h2>
          <span className="muted">
            streak {m.streak}d · week {Math.round(m.weekly).toLocaleString()} kg · {m.today ? m.today.focus : "off today"}
          </span>
          <button className="x" onClick={onClose} aria-label="close">
            ×
          </button>
        </div>
        <div className="compare">
          {columns.map(([label, s]) => (
            <figure key={label}>
              <SpriteView opts={{ params: s.p, look: m.look, sat: s.sat }} scale={4} label={`${m.name} ${label}`} />
              <figcaption>{label}</figcaption>
            </figure>
          ))}
        </div>
        <ParamBars p={m.params} compare={m.snaps.day1.p} />
        <div className="actions">
          {onEmote && !isMe &&
            (["bump", "flex", "clap"] as const).map((k) => (
              <button key={k} onClick={() => emote(k)} disabled={sent === "sending…"}>
                {k === "bump" ? "👊 FIST BUMP" : k === "flex" ? "💪 FLEX" : "👏 CLAP"}
              </button>
            ))}
          {sent && <span className="muted" role="status">{sent}</span>}
          <button onClick={() => downloadCard(m, floorName)}>⬇ SHARE CARD</button>
        </div>
        <h3>TIMELAPSE</h3>
        {!series ? (
          <p className="muted">loading…</p>
        ) : !series.length ? (
          <p className="muted">Couldn&apos;t load the timelapse. Check your connection and reopen the card.</p>
        ) : m.weekly === 0 && m.days <= 1 && !m.today ? (
          <p className="muted">{isMe ? "You haven't" : `${m.name} hasn't`} logged a workout yet.</p>
        ) : (
          <Timelapse series={series} look={m.look} who={isMe ? undefined : m.name} />
        )}
      </div>
    </div>
  );
}

/** Shareable PNG: avatar + stats, drawn in pixel style, downloaded. */
export function drawShareCard(m: MemberView, floorName: string): HTMLCanvasElement {
  const W = 320, H = 180, S = 3;
  const c = document.createElement("canvas");
  c.width = W * S;
  c.height = H * S;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(S, S);
  const R = (x: number, y: number, w: number, h: number, col: string) => ((ctx.fillStyle = col), ctx.fillRect(x, y, w, h));
  R(0, 0, W, H, "#2a1c16");
  R(4, 4, W - 8, H - 8, "#efe1c4");
  for (let y = 120; y < H - 4; y += 4) R(4, y, W - 8, 4, y % 8 ? "#c99a5e" : "#c39158");
  R(4, 4, W - 8, 14, "#6b4a35");
  drawText(ctx, "PIXEL GYM", 10, 9, "#ffd23f");
  const fl = floorName.toUpperCase();
  drawText(ctx, fl, W - 10 - textWidth(fl), 9, "#f3e6c8");
  ctx.drawImage(spriteCanvas({ params: m.params, look: m.look, sat: m.sat, glow: m.streak >= 10 }), 14, 24, SW * 3, SH * 3);
  drawText(ctx, m.name, 120, 28, "#2a1c16", 3);
  drawText(ctx, `STREAK ${m.streak}D · WEEK ${(m.weekly / 1000).toFixed(1)}K KG`, 120, 50, "#6b4a35");
  PARAMS.forEach((k, i) => {
    const y = 64 + i * 10;
    drawText(ctx, k, 120, y, "#2a1c16");
    R(162, y, 110, 5, "#00000030");
    R(162, y, Math.round(m.params[k] * 11), 5, k === "bodyfat" ? "#e0a32a" : "#3fa36b");
    drawText(ctx, m.params[k].toFixed(1), 278, y, "#2a1c16");
  });
  return c;
}

export function downloadCard(m: MemberView, floorName: string) {
  const a = document.createElement("a");
  a.download = `pixel-gym-${m.name.toLowerCase()}.png`;
  a.href = drawShareCard(m, floorName).toDataURL("image/png");
  a.click();
}
