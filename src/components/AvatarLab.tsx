"use client";
import { useState } from "react";
import { DEFAULT_START, PARAMS, type Params } from "@/lib/body";
import { shirtFit, strength, STAND, type Look, type Pose } from "@/lib/sprite";
import { SpriteView } from "./Avatar";

const POSES: Record<string, Pose> = {
  stand: STAND,
  walk: { legs: "stepA", arms: ["swingF", "swingB"] },
  press: { legs: "stand", arms: ["up", "up"], prop: "dumbbell" },
  curl: { legs: "stand", arms: ["curl", "curl"], prop: "dumbbell" },
  squat: { legs: "squat", arms: ["bar", "bar"], prop: "barbell" },
  sit: { legs: "sit", arms: ["down", "hold"], prop: "phone", propHand: 1, lookDown: true },
};
const PRESETS: Record<string, Params> = {
  "day 1": DEFAULT_START,
  "3 months": { shoulders: 4.5, arms: 4, chest: 4.8, back: 4.4, legs: 4.2, bodyfat: 4.2 },
  "1 year": { shoulders: 7.2, arms: 6.8, chest: 7.4, back: 7.5, legs: 7, bodyfat: 3 },
  veteran: { shoulders: 9.5, arms: 9.2, chest: 9.4, back: 9.6, legs: 9.3, bodyfat: 1.5 },
  "leg day skipper": { shoulders: 8, arms: 8.5, chest: 8.5, back: 6, legs: 1, bodyfat: 4 },
  "bulk szn": { shoulders: 6, arms: 6, chest: 6.5, back: 6, legs: 7, bodyfat: 8.5 },
};

export default function AvatarLab() {
  const [p, setP] = useState<Params>({ ...DEFAULT_START });
  const [look, setLook] = useState<Look>({ skin: 1, hair: 0, hairColor: 1, shirt: 1, shorts: 0 });
  const [pose, setPose] = useState("stand");
  const [sat, setSat] = useState(1);
  const [fx, setFx] = useState({ sweat: false, glow: false, grey: false });
  const opts = { params: p, look, sat, pose: POSES[pose], sweat: fx.sweat ? 1 : undefined, glow: fx.glow, grey: fx.grey };
  return (
    <div className="panel lab">
      <div>
        <SpriteView opts={opts} scale={8} label="lab avatar" />
        <p className="muted">
          shirt: {shirtFit(p)} · posture: {strength(p) < 3 ? "slouch" : strength(p) > 6.5 ? "tall" : "neutral"}
        </p>
      </div>
      <div className="sliders">
        {PARAMS.map((k) => (
          <label key={k}>
            {k.toUpperCase()}
            <input type="range" min={0} max={10} step={0.1} value={p[k]} onChange={(e) => setP({ ...p, [k]: +e.target.value })} />
            <b>{p[k].toFixed(1)}</b>
          </label>
        ))}
        <label>
          SATURATION
          <input type="range" min={0.3} max={1.05} step={0.01} value={sat} onChange={(e) => setSat(+e.target.value)} />
          <b>{sat.toFixed(2)}</b>
        </label>
        <div className="lab-row">
          {Object.keys(PRESETS).map((k) => (
            <button key={k} onClick={() => setP({ ...PRESETS[k] })}>{k}</button>
          ))}
        </div>
        <div className="lab-row">
          {Object.keys(POSES).map((k) => (
            <button key={k} className={pose === k ? "primary" : ""} aria-pressed={pose === k} onClick={() => setPose(k)}>{k}</button>
          ))}
        </div>
        <div className="lab-row">
          {(["sweat", "glow", "grey"] as const).map((k) => (
            <button key={k} className={fx[k] ? "primary" : ""} aria-pressed={fx[k]} onClick={() => setFx({ ...fx, [k]: !fx[k] })}>{k}</button>
          ))}
          {(["skin", "hair", "hairColor", "shirt", "shorts"] as const).map((k) => (
            <button key={k} onClick={() => setLook({ ...look, [k]: look[k] + 1 })}>{k === "hairColor" ? "hair color" : k} ↻</button>
          ))}
        </div>
        <h3>ALL PARAMS AT 0 / 5 / 10</h3>
        <div className="lab-row">
          {PARAMS.map((k) =>
            [0, 5, 10].map((v) => (
              <figure key={k + v} style={{ margin: 0, textAlign: "center" }}>
                <SpriteView opts={{ params: { ...DEFAULT_START, [k]: v }, look }} scale={2} label={`${k} ${v}`} />
                <figcaption>
                  {k} {v}
                </figcaption>
              </figure>
            )),
          )}
        </div>
      </div>
    </div>
  );
}
