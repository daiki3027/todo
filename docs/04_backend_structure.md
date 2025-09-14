# 🛠 バックエンド構成設計

## 1. ディレクトリ構成（予定）

```plaintext
backend/
├─ src/
│  ├─ app.ts                # Express 初期化・共通ミドルウェア・ルート登録
│  ├─ server.ts             # 起動エントリ（PORT読み込み・終了処理）
│  ├─ routes/
│  │  └─ todos.route.ts     # /api/todos のルーティング定義
│  ├─ controllers/
│  │  └─ todos.controller.ts# ルート ⇄ サービス の橋渡し（入出力整形）
│  ├─ services/
│  │  └─ todos.service.ts   # ビジネスロジック（完了トグル等）
│  ├─ repositories/
│  │  └─ todos.repo.ts      # Prisma 経由の DB アクセス
│  ├─ schemas/
│  │  └─ todos.schema.ts    # Zod スキーマ（作成/更新/一覧クエリ）
│  ├─ middlewares/
│  │  ├─ error.handler.ts   # 例外→HTTPレスポンスの標準化
│  │  └─ requestId.ts       # リクエストID付与（任意）
│  ├─ utils/
│  │  └─ logger.ts          # ロガー設定（morgan/pino のどちらか）
│  ├─ config/
│  │  └─ env.ts             # 環境変数の読み込み・検証（Zodで型付け）
│  └─ health/
│     └─ health.route.ts    # /health エンドポイント
├─ prisma/
│  ├─ schema.prisma         # Todo モデル定義
│  └─ migrations/           # マイグレーション
├─ .env                     # DATABASE_URL, PORT 等（開発用）
└─ package.json
```

> レイヤ分割の意図
>
> * **routes**: パスと HTTP メソッドの定義のみ
> * **controllers**: 入力のパース/検証→サービス呼び出し→出力整形
> * **services**: アプリの振る舞い（完了時の completed\_at 更新など）
> * **repositories**: DB CRUD（Prisma のみを知る）
> * **schemas**: リクエスト/クエリの Zod 定義（型生成と共通利用）

---

## 2. 使用ライブラリ（主要）

| ライブラリ名                        | 用途                     |
| ----------------------------- | ---------------------- |
| **express**                   | Web サーバ本体              |
| **@types/express**            | 型定義                    |
| **zod**                       | 入力バリデーション & 型安全        |
| **prisma / @prisma/client**   | ORM（PostgreSQL とのやり取り） |
| **cors**                      | CORS 設定                |
| **helmet**                    | セキュリティヘッダ              |
| **morgan**（開発）             | HTTP ロギング              |
| **express-async-errors**      | 非同期例外の補足               |
| **dotenv**                    | 環境変数の読み込み              |

---

## 3. 認証・認可

* **なし**（単一ユーザー前提）。
* 認証追加を見据える場合は、`auth/` レイヤを後付け可能な構成とする（ミドルウェア差し込みで拡張）。

---

## 4. バリデーション設計方針

* **Zod** を単一の真実源（schemas/）として定義。
* **Controller** で `req.body` / `req.query` をスキーマ検証 → **Service** に安全な型で渡す。
* スキーマはフロントでも共有可能な形に（将来モノレポで再利用）。

**検証対象（例）**

* 作成: `title` 必須（1..200）、`body` 任意（0..2000）
* 更新: 部分更新（いずれも任意）＋ `done` のブール
* 一覧クエリ: `limit`/`offset` 範囲、`status`（open/done/all）

---

## 5. エラーハンドリング方針

* **共通エラー形式**（JSON）

  * `{"error": "validation|not_found|internal", "message": "...", "details"?: ...}`
* **ZodError → 400**、対象なし → **404**、予期せぬ → **500**
* `express-async-errors` と **error.handler** で一元化
* ログは（開発）読みやすい形式

---

## 6. 設定・環境変数

* `.env` に最低限：

  * `DATABASE_URL`（PostgreSQL 接続文字列）
  * `PORT`（例：3000）
  * （将来）`NODE_ENV`、`CORS_ORIGIN` など
* `config/env.ts` で Zod による検証（起動時に不備を検知）。
* ルートの **/api** プレフィックスで API をまとめる（将来のバージョン分け `/api/v1` も容易）。

---

## 7. ミドルウェア構成（標準）

1. `helmet`：基本セキュリティヘッダ
2. `cors`：フロントのオリジンのみ許可（学習では `http://localhost:5173`）
3. `morgan`（開発）
4. `express.json()`：JSON パース
5. ルーティング（`/health` → `/api/todos`）
6. 404 ハンドラ（未定義ルート）
7. エラーハンドラ（共通形式へ整形）

---

## 8. DB・Prisma 運用

* **PrismaClient** はプロセスで単一インスタンス（接続の再利用）。
* マイグレーション：

  * 開発：変更時に適用（`migrate dev` 相当の運用方針）
  * 本番想定：起動直前または CI で `migrate deploy` を実施する運用に寄せる
* インデックス：`updated_at` / `done` を中心に、一覧・フィルタの実行計画を意識。
* シャットダウン：SIGTERM/SIGINT 受領時に Prisma をクリーンに切断。

---

## 9. ログ/監視・ヘルスチェック

* **/health**：200 を返す簡易エンドポイント（起動/死活確認用）。
* ログ：アクセスログ＋アプリログ。エラー時はスタックトレース付与（開発のみ）。
* （任意）**/metrics**：教材外。将来 Prometheus 等。

---

## 10. セキュリティ最低限

* XSS/クリックジャッキング対策：`helmet`
* CORS：許可ドメインを限定、`credentials` は不要（認証なし）
* 入力チェック：**必ず Zod** を通す
* レート制限：公開環境に出す場合のみ導入を検討

---

## 11. 起動・停止フロー（設計）

* **起動**：`env 読み込み` → `Prisma 接続` → `ミドルウェア` → `ルート` → `listen`
* **停止**：シグナル受領 → `サーバ停止` → `Prisma 切断` → `終了`
