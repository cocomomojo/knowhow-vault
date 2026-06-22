# Know-how Vault

Know-how Vault は、ノウハウの収集から分析・整理・ベストプラクティス化までを支援するアプリです。  
今回の構成では **ブラウザ保存ではなくバックエンドの SQLite DB 登録** を前提にしつつ、**自動収集** と **Copilot / GitHub Models を使った分析・草案作成** に対応しています。

## ✨ できること

- 手動でノウハウを DB 登録
- テーマ管理
- RSS / Atom からの自動収集
- Copilot を使った分析
- Copilot を使ったベストプラクティス草案生成

## 🧭 ワークフロー

```mermaid
flowchart LR
  A[手動入力 / 自動収集] --> B[SQLite DB登録]
  B --> C[Copilot分析]
  C --> D[整理]
  D --> E[ベストプラクティス草案化]
```

## 📦 主要構成

| 項目 | 内容 |
| --- | --- |
| フロントエンド | Vite + React + TypeScript |
| バックエンド | Hono + TypeScript |
| データ保存 | SQLite via sql.js |
| 自動収集 | RSS / Atom |
| AI 連携 | GitHub Models API |
| テスト | Node.js test runner |

## 🔐 環境変数

プロジェクトルートに `.env` を作成し、必要に応じて次を設定します。

```bash
COPILOT_GITHUB_TOKEN=your_github_token_with_models_read
GITHUB_MODELS_MODEL=openai/gpt-4.1-mini
PORT=8787
AUTO_COLLECT_LIMIT=5
FRONTEND_ORIGIN=http://localhost:5173
```

- `COPILOT_GITHUB_TOKEN` を設定すると、分析とベストプラクティス草案を Copilot / GitHub Models で生成します
- 未設定の場合はローカル補完ロジックにフォールバックします

## 🛠️ ローカル起動

### Dev Container を使う場合

1. VS Code でこのフォルダを開く
2. **Reopen in Container** を実行する
3. ターミナルで次を実行する

```bash
npm install
npm run dev
```

### 直接実行する場合

```bash
npm install
npm run dev
```

- フロントエンド: `http://localhost:5173`
- バックエンド API: `http://localhost:8787/api`

## 🚀 デプロイ

### 採用するバックエンド本番配置先

このリポジトリでは、**Render** を本番バックエンド配置先として採用します。

理由:

- Dockerfile をそのまま使える
- `render.yaml` でサービス定義をコード管理できる
- SQLite 用の **永続ディスク** を付けられる
- GitHub Pages と分離して、フロントと API を素直に運用できる

### DB 登録を伴う本番構成

GitHub Pages **だけ** ではバックエンドと SQLite DB を動かせないため、DB 登録を使う場合は **Node.js が動くホスティング** が必要です。

このリポジトリには `Dockerfile` を含めているため、コンテナ対応のホスティングへそのまま載せられます。

```bash
docker build -t knowhow-vault .
docker run -p 8787:8787 --env-file .env knowhow-vault
```

バックエンドは `frontend/dist` を配信するため、単一サービスとして動かせます。

#### Render でのセットアップ

リポジトリ直下の `render.yaml` を使うと、バックエンドを Render へそのままデプロイできます。

主要設定:

- サービス名: `knowhow-vault-backend`
- ランタイム: Docker
- プラン: `starter`
- 永続ディスク: `/var/data`
- ヘルスチェック: `/api/health`

Render 側で設定される / 設定すべき環境変数:

- `PORT=8787`
- `DATA_DIR=/var/data`
- `FRONTEND_ORIGIN=https://cocomomojo.github.io`
- `GITHUB_MODELS_MODEL=openai/gpt-4.1-mini`
- `COPILOT_GITHUB_TOKEN`（手動設定）
- `COLLECTION_WEBHOOK_TOKEN`（自動生成または手動設定）

SQLite を使うため、**永続ディスクを使えるプラン** を前提にしてください。

### GitHub Pages を使う場合

GitHub Pages は **フロントエンドのみ** の配信です。DB 登録を使うには、別途バックエンドを公開し、GitHub の Repository Variables に `VITE_API_BASE_URL` を設定してください。

#### GitHub Pages から Render バックエンドへつなぐ手順

1. Render にバックエンドをデプロイする
2. Render の公開 URL を確認する  
   例: `https://knowhow-vault-backend.onrender.com`
3. GitHub リポジトリの **Settings > Secrets and variables > Actions > Variables** を開く
4. `VITE_API_BASE_URL` を追加し、Render の公開 URL を設定する
5. `main` に push すると、Pages ワークフローがその URL を使ってフロントをビルドする

`pages.yml` では、`VITE_API_BASE_URL` が未設定ならビルドを失敗させるようにしています。

### 自動収集の定期実行

定期収集は GitHub Actions の `.github/workflows/scheduled-collection.yml` で実行します。

- 実行タイミング: 毎時 0 分
- 実行内容: バックエンドの `/api/internal/collection-sources/collect` を呼び出し
- 認証: `Authorization: Bearer <COLLECTION_WEBHOOK_TOKEN>`

設定が必要な GitHub Secrets:

- `BACKEND_BASE_URL`  
  例: `https://knowhow-vault-backend.onrender.com`
- `COLLECTION_WEBHOOK_TOKEN`  
  Render 側と同じ値を設定

この内部エンドポイントは、`COLLECTION_WEBHOOK_TOKEN` が一致した場合のみ実行されます。

## 🧪 テスト

```bash
npm --prefix backend run test
```

## 📌 補足

- 自動収集は RSS / Atom ソースを登録して実行します
- 収集時は `external_ref` を使って重複登録を避けます
- 重要な情報やトークンは Git にコミットしないでください
