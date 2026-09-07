import { DurableObject } from "cloudflare:workers";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface MessageRow {
  id: string;
  task_key: string;
  role: string;
  text: string;
  photo_id: string | null;
  created_at: number;
}

interface PhotoRow {
  mime: string;
  data: Uint8Array;
}

const MAX_PHOTO_BYTES = 1_500_000;

/**
 * Single-instance store for task conversations and task photos.
 * Dispatched with X-Rork-DO-Id "main" — one SQLite database for the project.
 */
export class TaskChat extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        task_key TEXT NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL DEFAULT '',
        photo_id TEXT,
        created_at INTEGER NOT NULL
      )`,
    );
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        mime TEXT NOT NULL,
        data BLOB NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    );
    this.ctx.storage.sql.exec(
      `CREATE INDEX IF NOT EXISTS idx_messages_task ON messages (task_key, created_at)`,
    );
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Messages for a task, oldest first.
    if (request.method === "GET" && path.startsWith("/chat/")) {
      const taskKey = decodeURIComponent(path.slice("/chat/".length));
      const rows = this.ctx.storage.sql
        .exec<MessageRow>(
          `SELECT id, task_key, role, text, photo_id, created_at
           FROM messages WHERE task_key = ? ORDER BY created_at ASC`,
          taskKey,
        )
        .toArray();
      const messages = rows.map((row) => ({
        id: row.id,
        taskKey: row.task_key,
        role: row.role,
        text: row.text,
        photoId: row.photo_id ?? undefined,
        createdAt: new Date(row.created_at).toISOString(),
      }));
      return Response.json({ messages }, { headers: CORS });
    }

    // Append a message to a task conversation.
    if (request.method === "POST" && path.startsWith("/chat/")) {
      const taskKey = decodeURIComponent(path.slice("/chat/".length));
      const body = (await request.json()) as {
        role?: string;
        text?: string;
        photoId?: string;
      };
      const role = body.role === "admin" ? "admin" : "viewer";
      const text = (body.text ?? "").slice(0, 2000);
      const photoId = body.photoId ?? null;
      if (!text && !photoId) {
        return Response.json({ error: "empty message" }, { status: 400, headers: CORS });
      }

      const id = crypto.randomUUID();
      const createdAt = Date.now();
      this.ctx.storage.sql.exec(
        `INSERT INTO messages (id, task_key, role, text, photo_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        id,
        taskKey,
        role,
        text,
        photoId,
        createdAt,
      );
      return Response.json(
        {
          message: {
            id,
            taskKey,
            role,
            text,
            photoId: photoId ?? undefined,
            createdAt: new Date(createdAt).toISOString(),
          },
        },
        { headers: CORS },
      );
    }

    // Upload a photo (JSON base64 payload).
    if (request.method === "POST" && path === "/photos") {
      const body = (await request.json()) as { data?: string; mime?: string };
      const base64 = (body.data ?? "").replace(/^data:[^;]+;base64,/, "");
      if (!base64) {
        return Response.json({ error: "missing data" }, { status: 400, headers: CORS });
      }

      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      if (bytes.byteLength > MAX_PHOTO_BYTES) {
        return Response.json({ error: "photo too large" }, { status: 413, headers: CORS });
      }

      const id = crypto.randomUUID();
      const mime = body.mime === "image/png" ? "image/png" : "image/jpeg";
      this.ctx.storage.sql.exec(
        `INSERT INTO photos (id, mime, data, created_at) VALUES (?, ?, ?, ?)`,
        id,
        mime,
        bytes,
        Date.now(),
      );
      return Response.json({ photoId: id }, { headers: CORS });
    }

    if (request.method === "GET" && path.startsWith("/photos/")) {
      const photoId = path.slice("/photos/".length);
      const row = this.ctx.storage.sql
        .exec<{ mime: string; data: Uint8Array }>(
          `SELECT mime, data FROM photos WHERE id = ?`,
          photoId,
        )
        .toArray()[0] as PhotoRow | undefined;
      if (!row) {
        return new Response("not found", { status: 404, headers: CORS });
      }
      return new Response(row.data as unknown as BodyInit, {
        headers: {
          ...CORS,
          "Content-Type": row.mime,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return Response.json({ error: "not found" }, { status: 404, headers: CORS });
  }
}

type Env = { DO: Fetcher };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ping") {
      return Response.json({ ok: true, now: new Date().toISOString() }, { headers: CORS });
    }

    // Everything routes to the single TaskChat instance.
    const wrapped = new Request(request.url, request);
    wrapped.headers.set("X-Rork-DO-Class", "TaskChat");
    wrapped.headers.set("X-Rork-DO-Id", "main");
    return env.DO.fetch(wrapped);
  },
} satisfies ExportedHandler<Env>;
