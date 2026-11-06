import { cookies } from "next/headers";
import type { FloorDoc, Member } from "../floor";
import { readFloor } from "./store";

const COOKIE = "pg_session";

export async function setSession(code: string, id: string, key: string) {
  (await cookies()).set(COOKIE, `${code}.${id}.${key}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
}

export async function readSession(): Promise<{ code: string; id: string; key: string } | null> {
  const v = (await cookies()).get(COOKIE)?.value;
  const [code, id, key] = v?.split(".") ?? [];
  return code && id && key ? { code, id, key } : null;
}

/** The signed-in member and their floor, or null. The key is the secret. */
export async function currentMember(fresh = false): Promise<{ doc: FloorDoc; me: Member } | null> {
  const s = await readSession();
  if (!s || !/^[A-Z0-9]{4,8}$/.test(s.code)) return null;
  const doc = await readFloor(s.code, fresh);
  const me = doc?.members.find((m) => m.id === s.id && m.key === s.key);
  return doc && me ? { doc, me } : null;
}
