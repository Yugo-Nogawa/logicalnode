# Logical Node 3 - iOS版セットアップガイド

このプロジェクトはCapacitorを使用してiOSアプリに変換されています。

## 必要なもの

1. **macOS** - iOS開発にはmacOSが必要です
2. **Xcode** - App Storeから最新版をインストール
3. **CocoaPods** - 依存関係管理ツール
   ```bash
   sudo gem install cocoapods
   ```
4. **Node.js** - v16以上

## セットアップ手順

### 1. 依存関係のインストール

```bash
# プロジェクトディレクトリで実行
npm install
```

### 2. CocoaPodsの依存関係をインストール

```bash
cd ios/App
pod install
cd ../..
```

### 3. Webアセットを同期

```bash
npm run cap:sync
```

### 4. Xcodeでプロジェクトを開く

```bash
npm run cap:open:ios
```

または手動で開く:
```bash
open ios/App/App.xcworkspace
```

**注意**: `App.xcworkspace`を開いてください（`App.xcodeproj`ではありません）

### 5. ビルドと実行

1. Xcodeでプロジェクトが開きます
2. 上部のデバイス選択で「iPhone 15 Pro」などのシミュレーターを選択
3. 再生ボタン（▶️）をクリックしてビルド＆実行

## 主な機能

### ファイル操作

- **保存**: ツールバーの「Save」ボタンまたは`Ctrl+S`
  - データはlocalStorageに自動保存されます
  - 5秒ごとに自動保存されます

- **読込**: ツールバーの「Load」ボタン
  - `.tree`または`.json`ファイルを選択

- **エクスポート**: メニュー（☰）ボタンから
  - Markdown形式
  - テキスト形式
  - JSON形式（共有機能を使用）

### ツリー操作

- **ノード追加**:
  - 子ノード: `Tab`キー
  - 兄弟ノード: `Enter`キー

- **ノード移動**:
  - 上/下: `Ctrl+↑/↓`
  - インデント: `Ctrl+→`
  - アウトデント: `Ctrl+←`

- **編集**:
  - ノードをクリックして編集
  - `Esc`キーで編集終了

- **スタイル**:
  - 太字: `Ctrl+B`
  - 色変更: `Ctrl+1-5`

- **その他**:
  - Undo: `Ctrl+Z`
  - Redo: `Ctrl+Shift+Z`
  - 検索: `Ctrl+F`
  - コピー/カット/ペースト: `Ctrl+C/X/V`

## デバッグ

### Safariでデバッグ

1. iOSシミュレーターでアプリを起動
2. SafariのメニューからDevelop > Simulator > [あなたのアプリ]を選択
3. Web Inspectorが開きます

### 実機でのテスト

1. Xcodeで「Signing & Capabilities」タブを開く
2. チームを選択（Apple IDが必要）
3. 実機をUSBで接続
4. デバイスを選択してビルド

## トラブルシューティング

### "CocoaPods not found"エラー

```bash
sudo gem install cocoapods
cd ios/App
pod install
```

### ビルドエラー

1. Clean Build Folder: Xcodeで`Cmd+Shift+K`
2. Derived Dataを削除:
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData
   ```
3. 再度pod install:
   ```bash
   cd ios/App
   pod deintegrate
   pod install
   ```

### 変更が反映されない

```bash
npm run cap:sync
```

Webファイル（HTML/CSS/JS）を変更した場合は必ずsyncを実行してください。

## プロジェクト構造

```
logicalnode3/
├── www/                    # Webアセット（iOS/Androidで共有）
│   ├── index.html         # メインHTML
│   ├── styles.css         # スタイル
│   ├── renderer.js        # メインロジック
│   └── capacitor.js       # Capacitor初期化
├── ios/                    # iOSプロジェクト
│   └── App/
│       ├── App.xcworkspace    # Xcodeワークスペース（これを開く）
│       └── App/
│           └── public/        # 同期されたWebアセット
├── capacitor.config.json  # Capacitor設定
└── package.json           # npm設定

```

## 次のステップ

### App Storeへの公開

1. Apple Developer Programに登録（年間99ドル）
2. App IDとプロビジョニングプロファイルを作成
3. Xcodeでアーカイブを作成
4. App Store Connectにアップロード

### アイコンとスプラッシュスクリーンの変更

```bash
# アイコンジェネレーターの使用を推奨
# https://capacitorjs.com/docs/guides/splash-screens-and-icons
```

## 注意事項

- **Windows環境**: このREADMEを作成した環境はWindowsです。iOS開発にはmacOSが必要なため、MacでXcodeを使用してください。
- **自動保存**: データは自動的にlocalStorageに保存されますが、アプリを削除するとデータも失われます。重要なデータは必ずエクスポートしてバックアップしてください。

## サポート

問題が発生した場合:
1. Capacitorドキュメント: https://capacitorjs.com/docs
2. GitHubイシュー: プロジェクトのイシューページ

---

**開発者**: Logical Node 3 Team
**バージョン**: 1.0.0
**ライセンス**: MIT
