"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { makeDemoFloor } from "@/lib/demo";
import { buildFloorView, localDate, seriesFor, type FloorDoc, type FloorView } from "@/lib/floor";
import FloorScreen from "./FloorScreen";
import { localEmote } from "./FloorCanvas";

/** The seeded demo floor, computed entirely in the browser. */
export default function DemoFloor() {
  const doc = useRef<FloorDoc | null>(null);
  const [view, setView] = useState<FloorView | null>(null);
  useEffect(() => {
    const tick = () => {
      const today = localDate();
      doc.current ??= makeDemoFloor(today, Date.now());
      setView((v) => ({ ...buildFloorView(doc.current!, today, Date.now()), demo: true, emotes: v?.emotes ?? [] }));
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30000);
    return () => (clearTimeout(first), clearInterval(id));
  }, []);
  const loadSeries = useCallback(async (id: string) => {
    const m = doc.current?.members.find((x) => x.id === id);
    return m ? seriesFor(m, localDate()) : [];
  }, []);
  if (!view) return <div className="floor-wrap" style={{ aspectRatio: "640 / 384" }} />;
  return <FloorScreen view={view} loadSeries={loadSeries} onEmote={(to, k) => setView((v) => v && localEmote(v, "you", to, k))} />;
}
