# 🔌 API 設計

## 1. 認証関連

* **なし**（単一ユーザー／ローカル利用を前提）

---

## 2. Todo API

| メソッド   | エンドポイント                | 説明                     |
| ------ | ---------------------- | ---------------------- |
| GET    | /api/todos             | TODO 一覧を取得（更新日降順）      |
| POST   | /api/todos             | TODO を新規作成             |
| PATCH  | /api/todos/\:id        | TODO を部分更新（タイトル/本文/完了） |
| PATCH  | /api/todos/\:id/toggle | 完了/未完をトグル切替            |
| DELETE | /api/todos/\:id        | TODO を削除               |

> 省略：詳細取得 `GET /api/todos/:id` は今回なし（一覧で完結）

---

## 3. リクエスト/レスポンス仕様（例）

### POST /api/todos

* **リクエスト**

```json
{
  "title": "買い物メモ",
  "body": "牛乳、パン、卵"
}
```

* **レスポンス（201 Created）**

```json
{
  "id": 2,
  "title": "買い物メモ",
  "body": "牛乳、パン、卵",
  "done": false,
  "completed_at": null,
  "created_at": "2025-09-14T12:34:56Z",
  "updated_at": "2025-09-14T12:34:56Z"
}
```

---

## 4. 入力バリデーション（Zod方針）

* `title`: 必須、1..200 文字
* `body`: 任意、0..2000 文字
* `status`（一覧クエリ）: `open|done|all`（未指定は `all`）
* `limit`: 1..100（未指定は 20）
* `offset`: 0..10000（未指定は 0）

**エラー形式（共通）**

```json
{ "error": "validation|not_found|internal", "message": "..." }
```

---

## 5. ステータスコード方針

* 200 OK：取得・更新・削除成功
* 201 Created：新規作成成功
* 400 Bad Request：入力不正（Zodエラー）
* 404 Not Found：対象IDなし
* 500 Internal Server Error：予期せぬエラー
