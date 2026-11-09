# Amazon Ads Auto Review — 読み取り専用MCPクライアント

2026-11-10更新。接続ブリッジv0.4.0の公開配布です。AIからAmazon Ads Auto Reviewの保存済み設定・履歴を参照できます。

**このリポジトリは公開されていますが、実データの参照には管理者が許可したアカウントでのCloudflare認証と閲覧権限が必要です。** 公開コードをダウンロードしても利用権限は付与されません。

## エージェントに設定を依頼する

このURLを普段使っているCodexやGrok Botに渡し、次のように依頼してください。

```text
https://github.com/common-ops/amazon-ads-readonly-mcp-public

このリポジトリのREADME.mdとAI_README.mdを読み、読み取り専用MCPの接続設定を進めてください。
Codexではrequired=falseを維持し、最初は専用の検証プロジェクトだけに登録してください。
既存MCPや全体設定を一括で変更せず、認証が必要になったら本人操作へ引き渡してください。
認証コード、token、cookie、秘密鍵をチャット・ログ・リポジトリへ出さないでください。
利用履歴と任意の質問文の保存条件を利用者に説明してください。
設定後は機能一覧の取得と、本人認証後のlist_accessible_contextsで接続を確認してください。
```

Grok Botでは、手元のPCではなくBotのクラウドPC上に配置・設定します。Grok Bot実機とCodex Desktop UI全体での動作確認は未完了のため、まず少人数で接続を確認してください。

## 参照できること

- キーワード・商品ターゲットの検索
- 現在保存されているルール設定と適用範囲
- 記録された入札変更履歴、適用ルール、当時の根拠数値
- データ取得・評価・反映・通知の観測状態

ルール編集、評価起動、入札変更、通知送信の機能はありません。閲覧できるのは認証済みアカウントに許可された法人のデータです。収集範囲や欠損があるため、履歴を完全な全変更と断定しないでください。

質問例:

> ターゲットXXXの過去7日間の入札変更履歴と、適用されたルール、根拠となる数値を一覧にしてください。更新時刻と確認できた範囲も示してください。

## セットアップ

### 1. クライアントを取得

[Release v0.4.0](https://github.com/common-ops/amazon-ads-readonly-mcp-public/releases/tag/v0.4.0)のAssetsから `amazonads-readonly-mcp-client-public-v0.4.0.zip` をダウンロード・展開するか、次のコマンドで取得します。

```sh
git clone https://github.com/common-ops/amazon-ads-readonly-mcp-public.git
cd amazon-ads-readonly-mcp-public
```

前提は[公式Node.js](https://nodejs.org/en/download) 24.22以上と[公式cloudflared CLI](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)です。接続ブリッジはNode標準ライブラリだけを使うため、npm installは不要です。

### 2. Cloudflareにログイン

取得したフォルダで次を実行します。`/absolute/path/to/cloudflared`は、その環境にある実際の実行ファイルの絶対パスに置き換えてください。

```sh
node scripts/access-bridge.mjs --login --cloudflared /absolute/path/to/cloudflared
```

ブラウザでは、管理者から利用を案内された既存アカウントのメールを使って認証します。コード等を通常のチャットに貼らず、ブラウザで認証を完了してください。ブリッジは認証コマンドのtoken出力を表示しません。

### 3. 利用環境の設定を生成

```sh
node scripts/print-production-config.mjs --cloudflared /absolute/path/to/cloudflared
```

標準出力はClaude Desktop等のJSON、標準エラーはCodex用・Grok CLI用それぞれのTOMLです。生成された絶対パスを使い、利用するクライアントの設定へ反映してください。設定ファイルの自動変更はしません。

Codex用は「Codex TOML」ブロックです。`required = false`、`startup_timeout_sec = 5`、`tool_timeout_sec = 12`を維持し、まず専用の検証プロジェクトだけに登録します。ほかの設定を丸ごと上書きしないでください。[公式MCP設定](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)も参照できます。

Grok CLIには「Grok CLI TOML」ブロックを使います。Grok Botのコマンド型MCPではBotのクラウドPCのNode実行ファイルとブリッジのパスを指定します。クラウドPC自身でCloudflare認証を完了する必要があります。[Grok Bot公式資料](https://docs.x.ai/grok-bot/computer-and-apps)を参照してください。

grok.comやChatGPTのURL型クラウドコネクタは別方式です。このCloudflare認証をそのままMCP OAuthとして登録できるとは扱っていません。

### 4. 接続を確認

最初に機能一覧を取得します。次に本人認証済みの状態で `list_accessible_contexts` を呼び、閲覧可能な法人が返ることを確認します。以後は検索で対象を特定してから、設定・履歴・処理状況を参照します。

**初期化や機能一覧の成功は、本番の本人認証成功を意味しません。** 実データの参照成功を別に確認してください。AI向けガイドは[AI_README.md](AI_README.md)とMCPリソース `amazonads://guide/ai-readme`で参照できます。

## 利用履歴と質問文の保存

本番サーバーは、認証済みユーザー・日時・利用機能・参照条件・処理結果・所要時間を、管理者向けに記録します。広告データの応答本文や会話全体は記録しません。他の利用者の履歴を読むMCP機能はありません。

v0.4.0では各ツールに任意の `user_question` を追加しました。AIが関連する質問原文を取得でき、送信してよい場合にだけ付けます（1〜2000文字）。原文不明・長文・秘密情報を含む場合や、利用者が質問文の保存を望まない場合は省略します。質問文を省略しても参照機能は使え、参照条件の利用履歴は残ります。

質問文は「AIから送られた文面」として保存し、実際の原文との一致や全質問の捕捉は保証しません。MCPを使わない会話や導入前の質問は取得できません。認証情報・パスワード・鍵などを質問文へ含めないでください。送信ルールは[AI_README.md](AI_README.md)に記載しています。

旧版でも質問文なしの参照は継続できます。質問文の送信に対応するには、実際に起動しているクライアントのフォルダをこの版へ更新し、MCPを再接続して機能一覧を取り直してください。ログ障害時も参照を継続する構成なので、利用履歴は完全な監査証跡ではありません。

## 認証切れ・通信エラー

起動、ping、機能一覧、公開AIガイドはローカルで応答し、Cloudflare認証やHTTPを待ちません。実データを参照する `tools/call` だけが認証済みの接続を使います。

- token取得は2秒、操作全体は8秒で打ち切ります。
- 同時処理は2件までで、障害後は30秒間の再試行抑制を行います。
- 認証切れや通信障害は `isError` のツール結果で返します。失敗を0件の検索結果と解釈しないでください。
- 通常利用中に自動でログイン画面を開いたり、無制限に認証を再試行したりしません。

認証切れの場合は上記の `--login` コマンドを別ターミナルで明示的に実行し、30秒後にデータ参照を再試行します。緊急時は、このMCPのCodex設定ブロックだけを `enabled = false` にして無効化できます。

認証なし・期限切れ・401/403・リダイレクト・通信停止等の合成検証と、公式SDKによるstdio検証を実施しています。クライアント製品自体の障害まで保証するものではありません。

## 公開範囲

接続先は `https://amazonads-v2.cs-fom.com/readonly-mcp` です。公開しているのは接続クライアント・利用手順・公開MCP契約だけです。サーバーの管理者資料、DBの構造や実データ、実行用資格情報、秘密鍵、利用者のローカル設定は含みません。

このコードの取得や公開によって、本番の認証・閲覧権限が変更されることはありません。
