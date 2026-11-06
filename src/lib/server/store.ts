// Floor docs live as one JSON blob per floor in Vercel Blob (private store).
// Without BLOB_READ_WRITE_TOKEN (local dev) they live in .data/ on disk.
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FloorDoc } from "../floor";
import { codeVariants } from "./util";

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const prefix = process.env.VERCEL_ENV === "production" ? "floors" : `floors-${process.env.VERCEL_ENV ?? "dev"}`;
const blobPath = (code: string) => `${prefix}/${code}.json`;
const localPath = (code: string) => path.join(process.cwd(), ".data", `${code}.json`);

type Read = { doc: FloorDoc; etag?: string };

// ponytail: per-instance 10s read cache to keep blob ops low; a real DB replaces this.
const memo = new Map<string, { at: number; r: Read }>();

async function readRaw(code: string): Promise<Read | null> {
  if (!useBlob) {
    try {
      return { doc: JSON.parse(await readFile(localPath(code), "utf8")) };
    } catch {
      return null;
    }
  }
  const r = await get(blobPath(code), { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return { doc: JSON.parse(await new Response(r.stream).text()), etag: r.blob.etag };
}

export async function readFloor(code: string, fresh = false): Promise<FloorDoc | null> {
  const hit = memo.get(code);
  if (!fresh && hit && Date.now() - hit.at < 10_000) return hit.r.doc;
  const r = await readRaw(code);
  if (r) memo.set(code, { at: Date.now(), r });
  return r?.doc ?? null;
}

async function write(doc: FloorDoc, opts: { etag?: string; create?: boolean }) {
  if (!useBlob) {
    if (opts.create && (await readRaw(doc.code))) throw new BlobPreconditionFailedError();
    await mkdir(path.dirname(localPath(doc.code)), { recursive: true });
    await writeFile(localPath(doc.code), JSON.stringify(doc));
  } else {
    await put(blobPath(doc.code), JSON.stringify(doc), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: !opts.create,
      ifMatch: opts.etag,
      cacheControlMaxAge: 60,
    });
  }
  memo.set(doc.code, { at: Date.now(), r: { doc } });
}

export async function createFloor(doc: FloorDoc): Promise<boolean> {
  try {
    await write(doc, { create: true });
    return true;
  } catch {
    return false;
  }
}

/** Return from a mutateFloor callback to abort without writing (throttled, not found...). */
export const SKIP = Symbol("skip");

/** Read-modify-write with optimistic concurrency (etag), retried on conflict. */
export async function mutateFloor<T>(code: string, fn: (doc: FloorDoc) => T): Promise<{ doc: FloorDoc; result: T } | null> {
  for (let i = 0; i < 4; i++) {
    const r = await readRaw(code);
    if (!r) return null;
    const result = fn(r.doc);
    if ((result as unknown) === SKIP) return { doc: r.doc, result };
    try {
      await write(r.doc, { etag: r.etag });
      return { doc: r.doc, result };
    } catch (e) {
      if (!(e instanceof BlobPreconditionFailedError) || i === 3) throw e; // busy floor: a real 500, not "missing"
    }
  }
  throw new Error("unreachable");
}

/**
 * The real floor code for a typed one: exact first, else a look-alike variant that exists.
 * Storage errors propagate (a blip is a 500, never a wrong "not found").
 * `exactMissed` skips re-reading the exact code when the caller already checked it.
 */
export async function resolveCode(code: string, exactMissed = false): Promise<string | null> {
  const variants = codeVariants(code).slice(exactMissed ? 1 : 0);
  const hits = await Promise.all(variants.map((c) => readFloor(c, true)));
  const i = hits.findIndex(Boolean);
  return i >= 0 ? variants[i] : null;
}
