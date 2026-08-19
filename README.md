# Claude Chat on Cloudflare

Cloudflare Workers上で動く、シンプルなClaudeチャットWebアプリです。ブラウザは `/api/chat` を呼び、WorkerがAnthropic Messages APIへリクエストするため、Anthropic APIキーをクライアント側に公開しません。

## 使用技術

- TypeScript + Vite
- Cloudflare Workers static assets
- Anthropic Messages API streaming
- 依存ライブラリなしの小さなMarkdown renderer（HTML escape済み）

## ローカル起動

```bash
npm install
npm run dev
```

Worker込みの本番相当確認は以下です。

```bash
npm run build
npx wrangler dev
```

## Cloudflareデプロイ

```bash
npm install
npx wrangler secret put ANTHROPIC_API_KEY
npm run deploy
```

`wrangler.jsonc` は `dist/client` を静的アセットとして配信し、`worker/index.ts` が `/api/chat` を処理します。

## Secret設定

必要なSecret名は以下です。

```text
ANTHROPIC_API_KEY
```

Cloudflare Dashboardまたは `wrangler secret put ANTHROPIC_API_KEY` で設定してください。フロントエンドの環境変数には入れないでください。

## モデルの変更方法

モデル表示名と内部IDは `src/models.ts` で分離しています。現在は公式ドキュメント確認時点の以下を使います。

- Haiku 4.5: `claude-haiku-4-5-20251001`
- Sonnet 5: `claude-sonnet-5-20241022`
- Opus 5: `claude-opus-5-20250909`

Anthropic側のモデルIDが変わった場合は `src/models.ts` の `MODELS` を更新してください。

## Effort設定

全モデル（Haiku 4.5 / Sonnet 5 / Opus 5）は Anthropic API の `effort` パラメータに `low` / `medium` / `high` を渡します。

- Low: 高速な応答を優先
- Medium: バランスの取れた応答
- High: より詳細で思考深い応答

## 簡易ログイン

ログイン画面にはジョーク仕様として「アルファベット大文字・小文字・記号を含むパスコード」と表示しますが、実際のパスコードは以下です。

```text
1359
```

ログイン状態はブラウザの `localStorage` に有効期限付きで保存します。これはURLを知っている人全員が即使える状態を避けるための簡易アクセス制限です。

## セキュリティ上の注意

- パスコード `1359` はフロントエンドコードに含まれるため、ソースを確認できる利用者には秘匿できません。
- 本番用途ではCloudflare Access、OAuth、SSO、セッションCookie、サーバー側検証などを利用してください。
- Anthropic APIキーは必ずCloudflare Secretに保存してください。
- ブラウザのlocalStorageやsessionStorageにAPIキーを保存しないでください。
- 会話履歴は現在のブラウザセッションに保存され、データベースには保存しません。
