# テストドキュメント

このディレクトリには、TiDB Cloud MCP extension のテストコードが含まれています。テストは TypeScript で実装されています。

## テストファイル構成

### `setup.ts`

テストユーティリティとヘルパー関数を提供します。

- `describe()`: テストスイートのグループ化
- `it()`: 同期テストケース
- `itAsync()`: 非同期テストケース
- `checkEnvVariables()`: 必要な環境変数の検証

### `basic-operations.test.ts`

基本的なデータベース操作の動作確認を行います。

**テスト観点:**

- **接続性**: TiDB Cloud への基本接続
- **データベース操作**: データベース一覧表示、テーブル一覧表示
- **CRUD 操作**: テーブル作成、データ挿入、クエリ実行、更新、削除
- **トランザクション**: 複数 SQL 文の一括実行とロールバック
- **TiDB Serverless 特有機能**: サーバーレス検出、ユーザー名プレフィックス

### `connector.test.ts`

TiDBConnector クラスの全機能を詳細にテストします。

**テスト観点:**

- **接続管理**: 接続プール、接続切り替え、接続終了
- **データベース操作**: 全ての public メソッドの動作確認
- **エラーハンドリング**: 不正な SQL、ネットワークエラー対応
- **TiDB Serverless**: ユーザー管理、プレフィックス処理
- **トランザクション**: コミット・ロールバック機能
- **型安全性**: TypeScript 型定義の検証

### `server-integration.test.ts`

MCP サーバーの統合テストを実行します（stdio トランスポート）。

**テスト観点:**

- **MCP Tools**: 7 つのツール（show_databases, switch_database, show_tables, db_query, db_execute, db_create_user, db_remove_user）
- **レスポンス形式**: MCP プロトコル準拠のレスポンス
- **エラーハンドリング**: ツールレベルでのエラー処理
- **データ整合性**: ツール間でのデータ一貫性
- **JSON 形式**: 結果の JSON シリアライゼーション

### `server-http.test.ts`

MCP サーバーの Streamable HTTP トランスポート統合テストを実行します。

**テスト観点:**

- **HTTP サーバー起動**: ランダムポートでの起動確認
- **Streamable HTTP 接続**: StreamableHTTPClientTransport による接続確立
- **セッション管理**: mcp-session-id ヘッダーによるセッション維持
- **リクエスト/レスポンス**: POST/GET/DELETE メソッドのサポート
- **全ツールの動作**: stdio モードと同等の機能確認
- **エラーハンドリング**: HTTP レスポンスコードの検証
- **Server-Sent Events**: サーバーからクライアントへの通知機能

## テスト実行方法

### 前提条件

```bash
# 依存関係のインストール
npm install

# 環境変数の設定（.envファイルを作成）
TIDB_HOST=gateway01.us-west-2.prod.aws.tidbcloud.com
TIDB_PORT=4000
TIDB_USERNAME=your_username
TIDB_PASSWORD=your_password
TIDB_DATABASE=test

# HTTPテスト用の環境変数（オプション）
MCP_HTTP_PORT=3000              # テスト用HTTPポート
MCP_CORS_ORIGIN=*               # CORS設定
```

### 実行コマンド

```bash
# 全テストを実行
npm test

# 個別テストの実行
npm run test:basic      # 基本操作テスト
npm run test:connector  # コネクタテスト
npm run test:server     # サーバー統合テスト（stdio）
npm run test:http       # HTTPサーバー統合テスト
```

## テスト設計方針

### 1. No API is the best API

- 複雑なテストフレームワークを使用しない
- Node.js 標準の`assert`モジュールを使用
- シンプルで読みやすいテストコード

### 2. 型安全性の確保

- TypeScript による型チェック
- インターフェースによる明確な契約定義
- コンパイル時エラーの早期発見

### 3. 実環境でのテスト

- 実際の TiDB Cloud インスタンスに接続
- 本物の SQL 実行とデータ操作
- ネットワーク条件を含む統合テスト

### 4. 包括的なテストカバレッジ

- **機能テスト**: 全ての public メソッドをテスト
- **エラーテスト**: 異常系の動作確認
- **統合テスト**: コンポーネント間の連携
- **TiDB 固有機能**: Serverless 特有の動作

## テスト結果の確認

### 成功例

```
## Test 1: Connection and basic query
✓ Connection successful

## Test 2: Show databases
✓ Found 4 databases
```

### 失敗時の情報

- エラーメッセージの詳細表示
- スタックトレースの提供
- 実行中断による早期発見

## 注意事項

1. **環境変数**: テスト実行前に`.env`ファイルの設定が必要
2. **ネットワーク**: TiDB Cloud への接続にはインターネット接続が必要
3. **権限**: 一部のテスト（ユーザー管理）は権限により実行をスキップする場合がある
4. **データ**: テストは一時的なテストテーブルを作成・削除するため、既存データには影響しない
5. **HTTPテスト**: ランダムポートを使用するため、同時実行時の競合を回避
6. **Streamable HTTP**: HTTPテストでは `@modelcontextprotocol/sdk` の StreamableHTTPClientTransport を使用

## 拡張方法

新しいテストケースを追加する場合：

1. 適切なテストファイルを選択（または新規作成）
2. `describe()` でテストグループを定義
3. `itAsync()` で非同期テストケースを実装
4. `assert` モジュールで検証ロジックを記述
5. 必要に応じて型定義を追加

テストの品質を保つため、実際の TiDB Cloud での動作確認を重視し、モックに依存しすぎないよう設計されています。
