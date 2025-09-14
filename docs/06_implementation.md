# ⚙️ 実装ステップ

このドキュメントは、実装の手順や作業順序を記録・管理するためのものです。

---

## 1. 環境構築

### 共通（DB：PostgreSQL）

* Docker を導入
* ルートに `docker-compose.yml` を用意して **PostgreSQL 16** を 5432 で起動
* 起動：`docker compose up -d`
* 接続情報（例）

  * `POSTGRES_USER=app` / `POSTGRES_PASSWORD=app` / `POSTGRES_DB=appdb`
  * 接続URL例：`postgresql://app:app@localhost:5432/appdb?schema=public`

### バックエンド（Express + TypeScript）

* Node.js 22 推奨
* 初期化：`npm init -y`
* ライブラリ（本体）：`express zod cors helmet morgan express-async-errors @prisma/client`
* ライブラリ（開発）：`typescript ts-node-dev prisma @types/node @types/express dotenv`
* TypeScript 初期化：`npx tsc --init`
* Prisma 初期化：`npx prisma init`
* `.env` に `DATABASE_URL` と `PORT` を設定（例：`PORT=3000`）

### フロントエンド（React + TypeScript）

* Vite で初期化：`npm create vite@latest frontend -- --template react-ts`
* 主要ライブラリ：`react-router-dom @tanstack/react-query axios`
* 開発起動：`npm run dev`（デフォルト `http://localhost:5173`）

---

## 2. バックエンド開発ステップ

1. **Prisma モデル作成（Todo）**

   * フィールド：`id`（PK, auto）、`title`（必須1..200）、`body`（任意0..2000）、`done`（bool, default false）、`completed_at?`、`created_at`、`updated_at`
   * インデックス：`updated_at` 降順用、`done` での絞り込み用（必要に応じて）
2. **マイグレーション実行**

   * `npx prisma migrate dev --name init`
   * Prisma Client 生成：`npx prisma generate`
3. **Express 初期設定**

   * `helmet` / `cors` / `morgan` / `express.json()` を設定
   * CORS は `http://localhost:5173` を許可
4. **バリデーション（Zod）**

   * 作成/更新/一覧クエリ用のスキーマを定義（title 必須、limit/offset 範囲など）
5. **ルーティング（/api）**

   * `GET /api/todos?limit&offset&status`（更新日降順・ページング任意）
   * `POST /api/todos`（title 必須、body 任意）
   * `PATCH /api/todos/:id`（部分更新：title/body/done）
   * `PATCH /api/todos/:id/toggle`（完了トグル）
   * `DELETE /api/todos/:id`（削除）
   * `GET /health`（死活）
6. **エラーハンドリング共通化**

   * ZodError → 400、対象なし → 404、その他 → 500
   * ログ出力の整形（開発は読みやすく）
7. **終了処理**

   * SIGTERM/SIGINT でサーバ停止 → Prisma 切断
8. **動作確認**

   * `curl` / `HTTPie` / `REST Client` などで CRUD を一通り確認

---

## 3. フロントエンド開発ステップ

1. **React Router 設定**

   * `/`（または `/todos`）に一覧＋作成フォームを集約
   * 404 ルート `*` を用意（任意）
2. **API クライアント**

   * `axios` で `baseURL=http://localhost:3000/api` を共通化
   * エラーハンドリング（4xx/5xx の表示）
3. **サーバ状態管理（React Query）**

   * クエリ：`useQuery(['todos', {status, limit, offset}], fetcher)`
   * ミューテーション：`create/update/toggle/delete`
   * 成功時 `invalidateQueries(['todos'])`
4. **UI コンポーネント**

   * `TodoForm`（新規作成、title 必須）
   * `TodoList` / `TodoItem`（完了トグル・編集・削除、ローディング/エラー表示を含む）
   * 編集はインライン or モーダル（どちらでもOK）
5. **UX 微調整**

   * 削除は確認ダイアログ
   * 完了トグルは楽観的更新（失敗時ロールバック）
   * 0件時の空表示、ローディングスケルトン
6. **表示順・フォーマット**

   * `updated_at` 降順
   * 日付フォーマットはまず ISO 表示（後で `dayjs` 等で整形してもOK）

---

## 4. 接続・統合チェック

* CORS：バックエンド側で `http://localhost:5173` を許可
* 端口：API `3000`／FE `5173` が競合していないこと
* API と UI のデータ型が一致しているか（title 必須など）
* ページ更新（F5）でも一覧が正しく再取得されるか

---

## 5. テスト設計（最小）

* **API テスト**（Jest + Supertest など）

  * `POST /api/todos`（title 未入力は 400）
  * `PATCH /api/todos/:id`（存在しないIDは 404）
  * `PATCH /api/todos/:id/toggle`（completed\_at の更新）
  * `DELETE /api/todos/:id`（200 + 再取得で消えている）
* **手動/E2E**（時間があれば Playwright）

  * 追加→表示→編集→完了→削除 の一連操作
  * エラー表示（バリデーション/通信失敗）確認

---

## 6. デプロイ手順（任意）

* **API**：Render / Railway / Fly.io など

  * 環境変数：`DATABASE_URL`、`PORT`
  * デプロイ前後に `prisma migrate deploy` を実行
* **フロント**：Vercel / Netlify

  * `VITE_API_BASE_URL` を環境変数で設定
* **CORS**：本番ドメインに合わせて許可

---

## 7. よくあるハマりどころ

* **DB 接続**：`localhost` と Docker ネットワークの違いに注意（ローカルからは `localhost:5432`）
* **マイグレーション忘れ**：スキーマ変更後に `migrate dev` を忘れがち
* **CORS**：オリジンのスペル・ポート違いで失敗
* **ポート競合**：3000/5173 の競合に注意（他のアプリが使用していないか）
* **時刻**：`completed_at` の更新/クリアの漏れ
