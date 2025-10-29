# 🚀 クイックスタート

## 🎯 3つのバージョンから選べます

| バージョン | 対応プラットフォーム | ファイルサイズ | おすすめ |
|-----------|-------------------|--------------|---------|
| **Tauri** ⭐ | Windows, Mac, Linux, iOS, Android, Web | **3-10MB** | すべて |
| Electron | Windows, Mac, Linux | 50-100MB | デスクトップのみ |
| Capacitor | iOS, Android, Web | 50-100MB | モバイルのみ |

---

## 🏆 Tauri版（最もおすすめ！）

### Windows

1. **Rustをインストール**:
   ```bash
   winget install Rustlang.Rustup
   ```

2. **起動**:
   ```bash
   npm run tauri:dev
   ```

3. **ビルド（.exe作成）**:
   ```bash
   npm run tauri:build
   # → src-tauri/target/release/logical-node-3.exe
   ```

詳細: `README_TAURI.md`

---

## 💻 Electron版（従来版）

```bash
npm start
```

---

## 📱 Capacitor版（iOS/Android）

### iOS（Macのみ）

1. **セットアップ**:
   ```bash
   npm install
   cd ios/App && pod install && cd ../..
   ```

2. **起動**:
   ```bash
   npm run cap:open:ios
   ```

### Android

```bash
npm run cap:sync
npx cap open android
```

詳細: `README_iOS.md`

---

## 🎯 主要コマンド一覧

### Tauri版 ⭐

| コマンド | 説明 |
|---------|------|
| `npm run tauri:dev` | 開発モードで起動 |
| `npm run tauri:build` | .exe/.app作成 |
| `npm run tauri:ios` | iOS版（Mac） |
| `npm run tauri:android` | Android版 |

### Electron版

| コマンド | 説明 |
|---------|------|
| `npm start` | Electron起動 |
| `npm run build` | .exe/.app作成 |

### Capacitor版

| コマンド | 説明 |
|---------|------|
| `npm run cap:sync` | ファイル同期 |
| `npm run cap:open:ios` | Xcode起動 |

---

## 📖 詳細ドキュメント

- **Tauri版**: `README_TAURI.md` ⭐
- **Capacitor/iOS版**: `README_iOS.md`
- **セットアップ完了**: `TAURI_SETUP_COMPLETE.md`

---

## 🆘 困ったときは

### Tauri版
- Rustがない → `winget install Rustlang.Rustup`
- ビルドエラー → `README_TAURI.md`のトラブルシューティング

### iOS版
- CocoaPodsエラー → `README_iOS.md`のトラブルシューティング

---

**🎉 推奨: Tauri版が最も軽量で高速です！**
