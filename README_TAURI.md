# 🚀 Logical Node 3 - Tauri版セットアップガイド

Tauriを使用した、すべてのプラットフォームに対応したバージョンです。

## ✨ 対応プラットフォーム

- ✅ Windows (.exe) - **超軽量（3-10MB）**
- ✅ macOS (.app)
- ✅ Linux
- ✅ iOS (macOS上で開発)
- ✅ Android
- ✅ Web（ブラウザ）

**すべて1つのコードベースから生成！**

## 🔧 必要な環境（Windows）

### 1. Rust のインストール

```bash
# PowerShellで実行
# https://rustup.rs/ から rustup-init.exe をダウンロード
# または以下のコマンドで直接インストール
winget install Rustlang.Rustup
```

インストール後、新しいターミナルを開いて確認：
```bash
rustc --version
cargo --version
```

### 2. C++ Build Tools のインストール

Visual Studio Build Tools が必要です：

**オプション1: Visual Studio Installer経由**
1. https://visualstudio.microsoft.com/downloads/ から「Build Tools for Visual Studio」をダウンロード
2. 「C++によるデスクトップ開発」をインストール

**オプション2: winget経由**
```bash
winget install Microsoft.VisualStudio.2022.BuildTools --force --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

### 3. WebView2 のインストール

Windows 10/11では通常プリインストールされています。確認：
```bash
# PowerShellで実行
Get-AppxPackage -Name Microsoft.WebView2
```

なければインストール：
```bash
winget install Microsoft.EdgeWebView2Runtime
```

## 🚀 開発を始める

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 開発モードで起動

```bash
npm run tauri:dev
```

アプリケーションウィンドウが開き、ホットリロード対応で開発できます！

### 3. ビルド（.exe作成）

```bash
npm run tauri:build
```

生成される場所：
```
src-tauri/target/release/logical-node-3.exe  （軽量版！）
src-tauri/target/release/bundle/msi/         （インストーラー）
```

## 📱 モバイル開発

### iOS（macOSが必要）

```bash
# 初回のみ
npm run tauri:ios

# これでXcodeが開きます
```

### Android

```bash
# Android Studioをインストール後
npm run tauri:android
```

## 🎯 主な機能

### Electron版との違い

| 機能 | Electron版 | Tauri版 |
|------|-----------|---------|
| ファイルサイズ | 50-100MB | **3-10MB** ⭐ |
| 起動速度 | 普通 | **高速** ⭐ |
| メモリ使用量 | 多い | **少ない** ⭐ |
| ファイル保存 | ファイルシステム | ファイルシステム |
| モバイル対応 | ❌ | ✅ iOS/Android |
| Web対応 | ❌ | ✅ |

### ファイル操作

すべてネイティブなファイルダイアログを使用：

- **保存**: ツールバーの「Save」ボタン
  - ネイティブなファイル選択ダイアログ
  - `.tree`ファイルとして保存

- **読込**: ツールバーの「Load」ボタン
  - ネイティブなファイル選択ダイアログ
  - `.tree`または`.json`ファイルを読込

- **エクスポート**: メニュー（☰）から
  - Markdown (.md)
  - Text (.txt)
  - JSON (.tree)

### キーボードショートカット

すべてElectron版と同じです：
- `Ctrl+S`: 保存
- `Ctrl+O`: 開く
- `Ctrl+Z`: 元に戻す
- `Ctrl+F`: 検索
- その他すべて対応

## 📊 プロジェクト構造

```
logicalnode3/
├── www/                      # フロントエンド（HTML/CSS/JS）
│   ├── index.html           # メインHTML
│   ├── styles.css           # スタイル
│   └── renderer.js          # メインロジック（Tauri API使用）
│
├── src-tauri/               # Tauriバックエンド（Rust）
│   ├── src/
│   │   └── main.rs         # Rustエントリーポイント
│   ├── Cargo.toml          # Rust設定
│   ├── tauri.conf.json     # Tauri設定
│   └── target/             # ビルド出力
│       └── release/
│           └── logical-node-3.exe  # 完成したアプリ！
│
├── index.html               # Electron版（既存）
├── renderer.js              # Electron版（既存）
└── main.js                  # Electron版（既存）
```

## 🔄 開発ワークフロー

### コード変更時

1. `www/`内のHTML/CSS/JSを編集
2. 開発モードなら自動でリロード（`npm run tauri:dev`実行中）
3. ビルドモードなら再ビルド（`npm run tauri:build`）

### Rust側の変更（通常不要）

`src-tauri/src/main.rs`を編集したら：
```bash
npm run tauri:dev  # 自動で再コンパイル
```

## 🆚 Electron版 vs Tauri版 vs Capacitor版

| | Electron | Tauri | Capacitor |
|---|----------|-------|-----------|
| **Windows** | ✅ 50-100MB | ✅ **3-10MB** ⭐ | ❌ |
| **macOS** | ✅ | ✅ | ❌ |
| **Linux** | ✅ | ✅ | ❌ |
| **iOS** | ❌ | ✅ | ✅ |
| **Android** | ❌ | ✅ | ✅ |
| **Web** | ❌ | ✅ | ✅ |
| **ファイルサイズ** | 大 | **小** ⭐ | 大 |
| **起動速度** | 普通 | **高速** ⭐ | 普通 |

**推奨**:
- デスクトップメイン → **Tauri** 🏆
- モバイルメイン → Capacitor
- すべて必要 → **Tauri** 🏆（2025年時点でモバイル対応済み）

## 🐛 トラブルシューティング

### "error: linker `link.exe` not found"

Visual Studio Build Toolsがインストールされていません。上記の手順でインストールしてください。

### "WebView2 not found"

```bash
winget install Microsoft.EdgeWebView2Runtime
```

### ビルドが遅い

初回ビルドは5-10分かかります（Rustの依存関係をコンパイル）。
2回目以降は数秒で完了します。

### ファイルサイズを更に小さく

```bash
# リリースビルド時に最適化
npm run tauri:build
```

すでに最適化されていますが、さらに：
```toml
# src-tauri/Cargo.tomlに追加
[profile.release]
opt-level = "z"     # サイズ最適化
lto = true          # リンク時最適化
codegen-units = 1   # コード生成ユニット
panic = "abort"     # パニック時の動作
strip = true        # デバッグシンボル削除
```

## 🚢 配布方法

### Windows

ビルド後、以下を配布：
```
src-tauri/target/release/logical-node-3.exe
```

または、MSIインストーラー：
```
src-tauri/target/release/bundle/msi/Logical Node 3_1.0.0_x64_en-US.msi
```

### macOS

```
src-tauri/target/release/bundle/macos/Logical Node 3.app
```

DMGファイルも生成されます。

### iOS/Android

App Store / Google Play への公開手順は別途ドキュメント参照。

## 📈 次のステップ

### iOS版を作る（Macが必要）

```bash
# Macで実行
cd logicalnode3
npm install
npm run tauri:ios

# Xcodeが開くので、シミュレーターを選択して実行
```

### Android版を作る（Windows/Mac/Linux可）

```bash
# Android Studioをインストール後
npm run tauri:android
```

### Web版として公開

`www/`ディレクトリをそのままホスティングするだけ：

```bash
# 例: Vercel
vercel www/

# 例: Netlify
netlify deploy --dir=www --prod
```

## 💡 ヒント

### アイコンの変更

`src-tauri/icons/`内のファイルを置き換えます。

自動生成ツール：
```bash
npx @tauri-apps/cli icon path/to/your-icon.png
```

### 自動更新機能

Tauri Updaterプラグインを使用：
```bash
npm install @tauri-apps/plugin-updater
```

### ネイティブ機能の追加

Tauriプラグインを追加：
```bash
npm install @tauri-apps/plugin-notification
npm install @tauri-apps/plugin-clipboard
# など
```

## 🔗 参考リンク

- [Tauri公式ドキュメント](https://tauri.app/v2/guides/)
- [Tauri APIリファレンス](https://tauri.app/v2/api/js/)
- [Rustプログラミング言語](https://doc.rust-lang.org/book/)

---

**開発者**: Logical Node 3 Team
**バージョン**: 1.0.0 (Tauri)
**ライセンス**: MIT

**🎉 Tauriで、すべてのプラットフォームに対応した軽量アプリを楽しんでください！**
