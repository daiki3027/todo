require('dotenv').config();
const express = require('express');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient({ log: ['query', 'error', 'warn'] });

app.use(express.json());

// 静的ファイル配信（index.html など）
app.use(express.static(path.join(__dirname)));

// ヘルスチェック
app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

// 一覧取得
app.get('/api/todos', async (req, res) => {
  try {
    const todos = await prisma.todo.findMany({ orderBy: { id: 'asc' } });
    res.json(todos);
  } catch (err) {
    console.error('GET /api/todos error:', err);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

// 作成
app.post('/api/todos', async (req, res) => {
  try {
    const { title } = req.body || {};
    if (typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'title is required' });
    }
    const todo = await prisma.todo.create({ data: { title: title.trim() } });
    res.status(201).location(`/api/todos/${todo.id}`).json(todo);
  } catch (err) {
    console.error('POST /api/todos error:', err);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

// 更新（completed のみ）
app.put('/api/todos/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { completed } = req.body || {};
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
    if (typeof completed !== 'boolean') return res.status(400).json({ error: 'completed must be boolean' });

    const todo = await prisma.todo.update({ where: { id }, data: { completed } });
    res.json(todo);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'not found' });
    console.error('PUT /api/todos/:id error:', err);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

// 削除
app.delete('/api/todos/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
    await prisma.todo.delete({ where: { id } });
    res.status(200).json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'not found' });
    console.error('DELETE /api/todos/:id error:', err);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

// 未定義の /api/* は 404
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not found' });
});

// ルートは index.html を返す
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
let server;

async function start() {
  try {
    await prisma.$connect();
    console.log('Prisma connected');
    server = app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('Prisma connect error:', e);
    process.exit(1);
  }
}

start();

async function gracefulShutdown() {
  try {
    await prisma.$disconnect();
  } catch (e) {
    // noop
  } finally {
    server.close(() => process.exit(0));
    // タイムアウト対策
    setTimeout(() => process.exit(0), 5000).unref();
  }
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);


// エラーハンドラ（最後に）
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});
