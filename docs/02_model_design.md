# 🧩 モデル設計

## 1. モデル一覧

* `Todo`（タスク本体：タイトル必須、本文任意、完了フラグ）

---

## 2. Todo モデル構成

| フィールド名        | 型         | オプション/制約                        | 説明                 |
| ------------- | --------- | ------------------------------- | ------------------ |
| id            | Int       | `@id @default(autoincrement())` | タスクID（自動採番）        |
| title         | String    | `@db.VarChar(200)`、必須           | タイトル（必須 1..200 文字） |
| body          | String?   | `@db.Text`、任意                   | 詳細/メモ（0..2000 目安）  |
| done          | Boolean   | `@default(false)`               | 完了フラグ（未完/完了）       |
| completed\_at | DateTime? | 省略可                             | 完了に切替時の日時          |
| created\_at   | DateTime  | `@default(now())`               | 作成日時               |
| updated\_at   | DateTime  | `@updatedAt`                    | 更新日時               |

---

## 3. リレーション図（簡易）

```plaintext
[Todo]  (単一テーブル。ユーザーは存在しない前提)
```

---

## 4. バリデーション・制約ルール

* `title`: **必須**、空文字不可、最大 200 文字（サーバ側で Zod バリデーション）
* `body`: 任意（最大 2000 文字目安）
* `done`: boolean（未指定時は `false`）
* `completed_at`: `done = true` へ遷移時に設定（`done = false` に戻す場合は `null` に戻す）
* 一覧の既定並び: `updated_at` 降順（新しい更新が上に来る）
