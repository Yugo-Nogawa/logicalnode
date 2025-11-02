# Logical Node 3 - Quasar Version

Electronバージョンから移植されたQuasar版のLogical Node 3です。

## 特徴

- Vue 3とQuasar Frameworkを使用
- Composition APIで実装
- Electronモードをサポート
- クロスプラットフォーム対応

## セットアップ

```bash
# プロジェクトディレクトリに移動
cd quasar

# 依存関係をインストール（初回のみ）
npm install

# Electronモードを追加（初回のみ - 既に追加済みの場合は不要）
npx quasar mode add electron
```

## 開発

```bash
# Electron開発サーバーを起動
npm run dev

# または
npx quasar dev -m electron
```

## ビルド

```bash
# Electronアプリをビルド
npx quasar build -m electron
```

ビルドされたファイルは `dist/electron` ディレクトリに生成されます。

## ファイル構造

```
quasar/
├── src/
│   ├── pages/
│   │   └── IndexPage.vue        # メインページ
│   ├── components/
│   │   └── TreeNode.vue         # ツリーノードコンポーネント
│   ├── composables/
│   │   └── useTreeLogic.js      # ツリーロジック
│   └── ...
├── src-electron/
│   ├── electron-main.js         # Electronメインプロセス
│   └── electron-preload.js      # Preloadスクリプト
└── quasar.config.js             # Quasar設定
```

## 機能

- ノードの追加・削除・編集
- ツリー構造の階層管理
- ノードのドラッグ&ドロップ
- テキストの装飾（太字、色変更）
- メモ機能
- 検索機能
- Undo/Redo
- ファイルの保存・読み込み（.tree形式）
- エクスポート機能（Markdown、テキスト、PNG）

## キーボードショートカット

- `Tab`: 子ノードを追加
- `Enter`: 兄弟ノードを追加
- `Delete`: ノードを削除
- `Ctrl+←/→`: 階層の変更
- `Ctrl+↑/↓`: ノードの移動
- `Ctrl+B`: 太字切り替え
- `Ctrl+1-5`: 色変更
- `Ctrl+7`: メモを追加/編集
- `Ctrl+C/X/V`: コピー/カット/ペースト
- `Ctrl+Z/Y`: Undo/Redo
- `Ctrl+F`: 検索
- `Ctrl+S`: 保存
- `Ctrl+Shift+S`: 別名で保存

## トラブルシューティング

### ESLintエラーが表示される

開発サーバー起動時にESLintエラーが表示される場合がありますが、アプリの動作には影響しません。これらのエラーは後で修正されます。

### Electronが起動しない

1. Node.jsのバージョンを確認してください（v20以上推奨）
2. 依存関係を再インストールしてください: `npm install`
3. `.quasar`フォルダを削除して再起動してください

## 元のElectronバージョンとの違い

- Vue.jsのReactivityシステムを使用
- Quasarのコンポーネントライブラリが利用可能
- ホットリロード対応
- より保守性の高いコード構造

## ライセンス

MIT
