import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { del, get, list, put } from "@vercel/blob";

/**
 * Where data lives.
 * - On your computer: plain files in ./data
 * - On Vercel (read-only disk): a private Vercel Blob store
 * Force one with STORAGE=fs or STORAGE=blob.
 *
 * Keys look like "brand.json", "products/<id>.json", "uploads/<id>/<file>".
 */
export interface Storage {
  read(key: string): Promise<Buffer | null>;
  write(key: string, data: Buffer, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
  removePrefix(prefix: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

/* ---------- local files ---------- */

const DATA_DIR = path.join(process.cwd(), "data");

function localPath(key: string) {
  const p = path.join(DATA_DIR, key);
  if (!p.startsWith(DATA_DIR + path.sep)) throw new Error("Invalid storage key");
  return p;
}

const fsStorage: Storage = {
  async read(key) {
    try {
      return await fs.readFile(localPath(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  },
  async write(key, data) {
    const file = localPath(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, file);
  },
  async remove(key) {
    await fs.rm(localPath(key), { force: true });
  },
  async removePrefix(prefix) {
    await fs.rm(localPath(prefix.replace(/\/$/, "")), { recursive: true, force: true });
  },
  async list(prefix) {
    const dir = localPath(prefix.replace(/\/$/, ""));
    try {
      const names = await fs.readdir(dir);
      return names.map((n) => `${prefix.replace(/\/?$/, "/")}${n}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  },
};

/* ---------- Vercel Blob (private) ---------- */

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

async function listAll(prefix: string) {
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    out.push(...page.blobs.map((b) => b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

const blobStorage: Storage = {
  async read(key) {
    // JSON is overwritten in place, so always read the latest copy.
    const res = await get(key, { access: "private", useCache: !key.endsWith(".json") });
    if (!res || res.statusCode !== 200) return null;
    return streamToBuffer(res.stream);
  },
  async write(key, data, contentType) {
    await put(key, data, {
      access: "private",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  },
  async remove(key) {
    await del(key);
  },
  async removePrefix(prefix) {
    const keys = await listAll(prefix);
    for (let i = 0; i < keys.length; i += 500) await del(keys.slice(i, i + 500));
  },
  async list(prefix) {
    return listAll(prefix);
  },
};

const useBlob =
  process.env.STORAGE === "blob" || (process.env.STORAGE !== "fs" && !!process.env.VERCEL);

export const storage: Storage = useBlob ? blobStorage : fsStorage;
