# 🎨 フロントエンド設計

## 1. ルーティング構成（React Router）

| パス                | 画面（コンポーネント名）       | 概要                            |
| ----------------- | ------------------ | ----------------------------- |
| `/`               | `TodosPage`        | TODO 一覧・作成（メイン画面）             |
| `/todos`          | `TodosPage`        | 同上（`/` は `/todos` にリダイレクトでも可） |
| `*`               | `NotFoundPage`     | 404                           |

> 認証なしのため、`/login` や `/signup` は**存在しません**。
> 教材では **「一覧＋作成＋インライン編集」= `/todos` 1画面完結** を推奨。

---

## 2. 状態管理（推奨）

**目的に応じて 2 段階で学習**

* **最小**：各コンポーネント内で `useState`／`useEffect`（まずはこれで CRUD 体験）
* **実用寄り**：**TanStack Query**（React Query）でサーバ状態管理（キャッシュ・再取得・エラーハンドリングが簡単）

### サーバ状態（推奨：React Query）

* クエリキー：`['todos', { status, limit, offset }]`（拡張時に活きる）
* ミューテーション：`createTodo`／`updateTodo`／`toggleTodo`／`deleteTodo`
* 成功時：`invalidateQueries(['todos'])` で一覧を再取得
* （任意）**楽にする代替**：ミューテーションで **楽観的更新** → 失敗時 rollback

### フォーム状態

* まずは **`useState` + 最小バリデーション**
* 教材の発展で **React Hook Form + Zod** に置き換え（同じスキーマを BE と共有しやすい）

---

## 3. コンポーネント構成（予定）

```
components/
├─ Header.tsx            // タイトルや簡易ナビ（認証なし）
├─ TodoForm.tsx          // 入力フォーム（作成/編集で共通化）
├─ TodoList.tsx          // 一覧（空表示やローディング/エラー含む）
├─ TodoItem.tsx          // 単一行（タイトル・完了トグル・編集・削除）
├─ ConfirmDialog.tsx     // 削除確認（任意）
├─ EmptyState.tsx        // 0件時の表示（任意）
└─ Pagination.tsx        // ページングUI（拡張時）
```

**ページ**

* `TodosPage.tsx`：

  * 上部に `TodoForm`（新規作成）
  * 下に `TodoList`（`TodoItem` の集合／編集はモーダル or インライン）
* `TodoEditPage.tsx`（任意）：URL直アクセスで編集・学習素材として用意可
* `NotFoundPage.tsx`：適当な 404 画面

**UX ポイント**

* 削除は確認ダイアログを出す（誤操作防止）
* 完了トグルは即時反映（楽観的更新でサクサク）
* エラー・ローディングは一覧部分で視覚的に表示
* キーボード操作（Enterで作成、Escで編集キャンセル）を簡単に入れると学びが深い

---

## 4. API 通信

* クライアント：**Axios** もしくは `fetch`（どちらでもOK／教材ならどちらか一方に統一）
* **共通設定**：`apiClient.ts` に `baseURL`（例：`http://localhost:3000/api`）と JSON の設定
* **エラー処理**：

  * 4xx → バリデーションメッセージ表示
  * 5xx → 汎用エラー表示（「時間を置いて再度お試しください」）
* **CORS**：バックエンド側で `http://localhost:5173` を許可（開発時）
* **認証ヘッダ**：不要（ユーザー管理なし）

**主要エンドポイント（参照）**

* `GET /api/todos?limit&offset&status`
* `POST /api/todos`（title 必須、body 任意）
* `PATCH /api/todos/:id`（部分更新）
* `PATCH /api/todos/:id/toggle`（完了トグル）
* `DELETE /api/todos/:id`

---

## 5. 画面制御・遷移ガード

* 認証ガード：**不要**
* 404：未定義ルートは `NotFoundPage` に集約
* 離脱ガード（任意）：編集中にページ遷移・リロード時に確認ダイアログ
* スクロール位置復元：ルーターの `scrollRestoration`（任意）
