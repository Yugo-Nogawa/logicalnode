// electron-builder が winCodeSign の展開に失敗する環境(シンボリックリンク権限が無い等)では、
// ビルド後の exe に自前アイコンが埋め込まれず、Electron 既定アイコンのままになる。
// このスクリプトは electron-builder が同梱する rcedit を使い、ビルド済み exe に
// assets/icons/icon.ico を直接埋め込む(build:win の後段で自動実行)。
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const ROOT = __dirname;
const ICON = path.join(ROOT, 'assets', 'icons', 'icon.ico');
const UNPACKED = path.join(ROOT, 'dist', 'win-unpacked');

function findRcedit() {
  // 1) winCodeSign キャッシュ内の rcedit-x64.exe を探す
  const cache = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign');
  if (fs.existsSync(cache)) {
    for (const d of fs.readdirSync(cache)) {
      const p = path.join(cache, d, 'rcedit-x64.exe');
      if (fs.existsSync(p)) return p;
    }
  }
  // 2) rcedit npm パッケージ(あれば)
  const pkg = path.join(ROOT, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe');
  if (fs.existsSync(pkg)) return pkg;
  return null;
}

function main() {
  if (!fs.existsSync(ICON)) { console.error('icon.ico が見つかりません: ' + ICON); process.exit(1); }
  if (!fs.existsSync(UNPACKED)) { console.error('win-unpacked が見つかりません。先に electron-builder --win を実行してください。'); process.exit(1); }
  const exe = fs.readdirSync(UNPACKED).find(f => f.toLowerCase().endsWith('.exe'));
  if (!exe) { console.error('win-unpacked 内に .exe がありません。'); process.exit(1); }
  const exePath = path.join(UNPACKED, exe);
  const rcedit = findRcedit();
  if (!rcedit) { console.error('rcedit が見つかりません(winCodeSign キャッシュ / rcedit パッケージ)。'); process.exit(1); }

  execFileSync(rcedit, [exePath, '--set-icon', ICON], { stdio: 'inherit' });
  console.log('✓ アイコンを埋め込みました: ' + exePath);
}

main();
