# TiDB Cloud Serverless MCP E2E テストプロンプト

このファイルには、TiDB Cloud Serverless MCP サーバーの全機能をテストするためのプロンプトが含まれています。

## 前提条件

- TiDB Cloud Serverless のデータベースが設定済み
- MCP サーバーが正常に動作している
- 必要な環境変数またはDXT設定が完了している

## テストシナリオ

### 1. データベース接続テスト

```
利用可能なデータベース一覧を表示してください。
```

### 2. テーブル管理テスト

```
現在のデータベースのテーブル一覧を表示してください。
```

### 3. テーブル作成・データ挿入テスト

```
以下の手順を実行してください：
1. 'test_users' というテーブルを作成（id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(255)）
2. サンプルデータを3件挿入
3. 作成したテーブルの構造を確認
```

### 4. データクエリテスト

```
test_users テーブルから全てのデータを取得してください。
```

### 5. データ更新テスト

```
test_users テーブルで id=1 のユーザーの名前を '更新されたユーザー' に更新してください。
```

### 6. 条件付きクエリテスト

```
test_users テーブルから email に 'test' が含まれるユーザーを検索してください。
```

### 7. トランザクションテスト

```
複数のSQL文を一つのトランザクションで実行してください：
1. 新しいユーザーを挿入
2. 既存のユーザーを更新
3. 結果を確認
```

### 8. ユーザー管理テスト

```
以下の手順を実行してください：
1. 'test_user' という名前の新しいデータベースユーザーを作成（パスワード: 'test123'）
2. 作成したユーザーの情報を確認
3. 作成したユーザーを削除
```

### 9. エラーハンドリングテスト

```
以下の無効なSQL文を実行して、エラーが適切に処理されることを確認してください：
'SELECT * FROM non_existent_table'
```

### 10. ベクトル検索テスト（TiDB固有機能）

```
以下の手順を実行してください：
1. ベクトル列を含むテーブルを作成
2. ベクトルデータを挿入
3. VEC_COSINE_DISTANCE 関数を使用したベクトル検索を実行
```

### 11. 大量データテスト

```
パフォーマンステストとして、1000件のレコードを持つテーブルを作成し、LIMIT句を使用してページネーションクエリを実行してください。
```

### 12. データベース切り替えテスト

```
異なるデータベースに切り替えて、テーブル一覧を確認してください。
```

## 実行方法

1. 上記のプロンプトを順番に実行
2. 各テストの結果を記録
3. エラーが発生した場合は、エラーメッセージと原因を記録
4. 全てのテストが完了したら、結果をまとめて報告

## 期待される結果

- 全てのMCP機能が正常に動作すること
- エラーが適切に処理されること
- TiDB固有の機能（ベクトル検索など）が正常に動作すること
- トランザクション処理が正常に動作すること
- ユーザー管理機能が正常に動作すること