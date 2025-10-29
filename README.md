# Logical Node 3

階層構造で情報を整理できる、シンプルで使いやすいロジックツリーアプリケーション。

## 📦 3つのバージョン

このリポジトリには、プラットフォームに応じた3つのバージョンが含まれています：

### 1️⃣ **Tauri版** - 全プラットフォーム対応（推奨）

最も幅広いプラットフォームに対応した最新バージョン

- **対応プラットフォーム**: Windows, macOS, Linux, iOS, Android, Web
- **ファイルサイズ**: 3-10MB（最小）
- **特徴**: ネイティブファイルダイアログ、高速、軽量
- **開発言語**: HTML/CSS/JavaScript + Rust

📁 **[tauri/](tauri/) ディレクトリへ**

### 2️⃣ **Electron版** - デスクトップ専用

従来のデスクトップアプリケーション版

- **対応プラットフォーム**: Windows, macOS, Linux
- **ファイルサイズ**: 50-100MB
- **特徴**: 安定性、豊富なコミュニティ
- **開発言語**: HTML/CSS/JavaScript + Node.js

📁 **[electron/](electron/) ディレクトリへ**

### 3️⃣ **Capacitor版** - モバイル専用

iOS・Androidネイティブアプリ版

- **対応プラットフォーム**: iOS, Android, Web
- **特徴**: Web API使用、簡単なモバイル展開
- **開発言語**: HTML/CSS/JavaScript

📁 **[capacitor/](capacitor/) ディレクトリへ**

## 🎯 どのバージョンを選ぶべきか？

| 目的 | 推奨バージョン |
|------|--------------|
| 全プラットフォームで使いたい | **Tauri** |
| デスクトップのみで十分 | **Electron** |
| iOSやAndroidアプリとして配布したい | **Capacitor** または **Tauri** |
| 最小のファイルサイズが必要 | **Tauri** |
| Rustの設定が面倒 | **Electron** または **Capacitor** |

## 📊 機能比較

| 機能 | Tauri | Electron | Capacitor |
|------|-------|----------|-----------|
| Windows | ✅ | ✅ | ❌ |
| macOS | ✅ | ✅ | ❌ |
| Linux | ✅ | ✅ | ❌ |
| iOS | ✅ | ❌ | ✅ |
| Android | ✅ | ❌ | ✅ |
| Web | ✅ | ❌ | ✅ |
| ファイル操作 | ネイティブ | ネイティブ | Web API |
| ファイルサイズ | 小 (3-10MB) | 大 (50-100MB) | 中 (15-30MB) |
| 起動速度 | 高速 | 普通 | 高速 |

## 🚀 クイックスタート

各バージョンのディレクトリに移動して、それぞれのREADMEをご覧ください：

```bash
# Tauri版
cd tauri
npm install

# Electron版
cd electron
npm install

# Capacitor版
cd capacitor
npm install
```

## 💡 共通機能

すべてのバージョンで以下の機能が利用可能です：

- ✅ 階層構造のノード作成・編集
- ✅ ノードの色付け（5色）
- ✅ メモ機能
- ✅ 検索機能（Ctrl+F）
- ✅ ファイル保存・読み込み（.tree, .json）
- ✅ エクスポート機能（Markdown, テキスト, JSON）
- ✅ キーボードショートカット対応
- ✅ 複数ノード選択と一括操作

## 🔧 技術スタック

- **フロントエンド**: HTML5, CSS3, JavaScript (ES6+)
- **Tauri**: Rust + Tauri 2.0
- **Electron**: Node.js + Electron
- **Capacitor**: Capacitor 7.x + iOS/Android

## 📝 データ互換性

すべてのバージョンで同じJSON形式のファイルを使用しているため、バージョン間でファイルを共有できます。

```json
{
  "id": "unique-id",
  "content": "ノードの内容",
  "color": "blue",
  "bold": false,
  "memo": "",
  "collapsed": false,
  "children": []
}
```

## 🤝 貢献

バグ報告や機能提案は、Issuesでお願いします。

## 📄 ライセンス

MIT License

## 📚 ドキュメント

各バージョンの詳細なドキュメントは、それぞれのディレクトリ内のREADMEをご覧ください：

- [Tauri版 README](tauri/README.md)
- [Electron版 README](electron/README.md)
- [Capacitor版 README](capacitor/README.md)
