"use strict";

const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// ポート番号（環境変数PORTがあればそれを使用）
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
// データベースファイルのパス
const DB_FILE = path.join(__dirname, "todo.db");

// sqlite3 CLI を -json で呼び出して、SQLの結果を文字列として返す
function runSql(sql) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const errChunks = [];
    const child = spawn("sqlite3", ["-json", DB_FILE, sql], { stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => errChunks.push(d));
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(errChunks).toString("utf8");
        reject(new Error(stderr.trim() || `sqlite3 exited with code ${code}`));
        return;
      }
      const stdout = Buffer.concat(chunks).toString("utf8").trim();
      resolve(stdout);
    });
  });
}

// 初回起動時にテーブルを作成（存在しない場合のみ）
async function initDb() {
  const createSql = "CREATE TABLE IF NOT EXISTS todos (\n" +
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,\n" +
    "  title TEXT NOT NULL,\n" +
    "  completed INTEGER NOT NULL DEFAULT 0,\n" +
    "  created_at TEXT NOT NULL DEFAULT (datetime('now'))\n" +
    ");";
  try {
    await runSql(createSql);
  } catch (err) {
    console.error("Failed to initialize database. Ensure sqlite3 CLI is installed.");
    console.error(err.message);
    process.exit(1);
  }
}

// JSONを返すためのヘルパー
function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

// ルートが見つからない場合
function notFound(res) {
  res.statusCode = 404;
  res.end("Not Found");
}

// タイトルを最低限クレンジング（改行除去・長さ上限・' のエスケープ）
function sanitizeTitle(input) {
  let title = String(input ?? "").trim();
  // Disallow newlines and limit length
  title = title.replace(/[\r\n]+/g, " ").slice(0, 200);
  // Escape single quotes for SQL literal
  title = title.replace(/'/g, "''");
  return title;
}

// /api/ 以下のエンドポイントをまとめて処理
async function handleApi(req, res) {
  const parsed = url.parse(req.url, true);
  const method = req.method || "GET";
  const segments = (parsed.pathname || "").split("/").filter(Boolean);

  // GET /api/todos
  if (method === "GET" && segments.length === 2 && segments[0] === "api" && segments[1] === "todos") {
    try {
      const sql = "SELECT id, title, completed, created_at FROM todos ORDER BY id DESC;";
      const out = await runSql(sql);
      const items = out ? JSON.parse(out) : [];
      return sendJson(res, 200, items);
    } catch (err) {
      return sendJson(res, 500, { error: "Failed to load todos", detail: String(err.message || err) });
    }
  }

  // POST /api/todos
  if (method === "POST" && segments.length === 2 && segments[0] === "api" && segments[1] === "todos") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on("end", async () => {
      try {
        const data = body ? JSON.parse(body) : {};
        if (!data.title || !String(data.title).trim()) {
          return sendJson(res, 400, { error: "title is required" });
        }
        const title = sanitizeTitle(data.title);
        const sql = "INSERT INTO todos (title) VALUES ('" + title + "'); " +
                    "SELECT id, title, completed, created_at FROM todos WHERE id = last_insert_rowid();";
        const out = await runSql(sql);
        const arr = out ? JSON.parse(out) : [];
        const item = Array.isArray(arr) && arr[0] ? arr[0] : null;
        return sendJson(res, 201, item || {});
      } catch (err) {
        return sendJson(res, 500, { error: "Failed to create todo", detail: String(err.message || err) });
      }
    });
    return;
  }

  // PUT /api/todos/:id
  if (method === "PUT" && segments.length === 3 && segments[0] === "api" && segments[1] === "todos") {
    const id = Number(segments[2]);
    if (!Number.isInteger(id) || id <= 0) return sendJson(res, 400, { error: "invalid id" });
    let body = "";
    req.on("data", (chunk) => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on("end", async () => {
      try {
        const data = body ? JSON.parse(body) : {};
        const setClauses = [];
        if (Object.prototype.hasOwnProperty.call(data, "title")) {
          setClauses.push("title='" + sanitizeTitle(data.title) + "'");
        }
        if (Object.prototype.hasOwnProperty.call(data, "completed")) {
          const completedVal = data.completed ? 1 : 0;
          setClauses.push("completed=" + completedVal);
        }
        if (setClauses.length === 0) return sendJson(res, 400, { error: "no fields to update" });
        const sql = "UPDATE todos SET " + setClauses.join(", ") + " WHERE id=" + id + "; " +
                    "SELECT id, title, completed, created_at FROM todos WHERE id=" + id + ";";
        const out = await runSql(sql);
        const arr = out ? JSON.parse(out) : [];
        if (!arr[0]) return sendJson(res, 404, { error: "not found" });
        return sendJson(res, 200, arr[0]);
      } catch (err) {
        return sendJson(res, 500, { error: "Failed to update todo", detail: String(err.message || err) });
      }
    });
    return;
  }

  // DELETE /api/todos/:id
  if (method === "DELETE" && segments.length === 3 && segments[0] === "api" && segments[1] === "todos") {
    const id = Number(segments[2]);
    if (!Number.isInteger(id) || id <= 0) return sendJson(res, 400, { error: "invalid id" });
    try {
      const out = await runSql("DELETE FROM todos WHERE id=" + id + "; SELECT changes() AS changes;");
      const arr = out ? JSON.parse(out) : [];
      const changed = Array.isArray(arr) && arr[0] ? Number(arr[0].changes || 0) : 0;
      if (changed === 0) return sendJson(res, 404, { error: "not found" });
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 500, { error: "Failed to delete todo", detail: String(err.message || err) });
    }
  }

  return notFound(res);
}

// index.html を配信
function serveIndex(req, res) {
  const filePath = path.join(__dirname, "index.html");
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.end("index.html not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(data);
  });
}

// サーバ起動
async function start() {
  await initDb();

  const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url || "/");
    const pathname = parsed.pathname || "/";

    if (pathname === "/" && req.method === "GET") {
      return serveIndex(req, res);
    }

    if (pathname.startsWith("/api/")) {
      return handleApi(req, res);
    }

    notFound(res);
  });

  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

// End of file
