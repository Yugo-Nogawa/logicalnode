// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::collections::HashMap;
use tauri::{Manager, Emitter};

// 待機中のファイルデータ
#[derive(Clone)]
struct PendingFileData {
    content: String,
    file_name: String,
}

// グローバルステート：ウィンドウごとのファイルパスを保持
struct AppState {
    window_file_paths: Mutex<HashMap<String, Option<String>>>,
    pending_file_data: Mutex<HashMap<String, PendingFileData>>,
}

// ウィンドウタイトル更新コマンド
#[tauri::command]
async fn update_window_title(
    window: tauri::Window,
    file_name: Option<String>,
    has_unsaved_changes: bool
) -> Result<(), String> {
    let unsaved_mark = if has_unsaved_changes { "● " } else { "" };
    let file_display = file_name.unwrap_or_else(|| "Untitled".to_string());
    let title = format!("{}{}  -  Logical Node 3", unsaved_mark, file_display);
    window.set_title(&title).map_err(|e| e.to_string())?;
    Ok(())
}

// ファイル保存コマンド（上書き保存）
#[tauri::command]
async fn save_file(
    content: String,
    default_filename: String,
    window: tauri::Window,
    state: tauri::State<'_, AppState>
) -> Result<String, String> {
    use tauri_plugin_dialog::{DialogExt, FilePath};

    let window_label = window.label().to_string();

    // 現在のファイルパスを取得
    let current_path = {
        let paths = state.window_file_paths.lock().unwrap();
        paths.get(&window_label).and_then(|p| p.clone())
    };

    if let Some(path_str) = current_path {
        // 既存のファイルパスがある場合は上書き保存
        std::fs::write(&path_str, content)
            .map_err(|e| e.to_string())?;
        Ok(path_str)
    } else {
        // ファイルパスがない場合はダイアログを表示
        let file_path = window.app_handle().dialog()
            .file()
            .set_file_name(&default_filename)
            .add_filter("Tree Files", &["tree"])
            .blocking_save_file();

        match file_path {
            Some(FilePath::Path(path)) => {
                std::fs::write(&path, content)
                    .map_err(|e| e.to_string())?;
                let path_str = path.to_string_lossy().to_string();
                // 現在のファイルパスを更新
                {
                    let mut paths = state.window_file_paths.lock().unwrap();
                    paths.insert(window_label, Some(path_str.clone()));
                }
                Ok(path_str)
            },
            _ => Err("No file selected".to_string())
        }
    }
}

// ファイル別名保存コマンド
#[tauri::command]
async fn save_file_as(
    content: String,
    default_filename: String,
    window: tauri::Window,
    state: tauri::State<'_, AppState>
) -> Result<String, String> {
    use tauri_plugin_dialog::{DialogExt, FilePath};

    let window_label = window.label().to_string();

    let file_path = window.app_handle().dialog()
        .file()
        .set_file_name(&default_filename)
        .add_filter("Tree Files", &["tree"])
        .blocking_save_file();

    match file_path {
        Some(FilePath::Path(path)) => {
            std::fs::write(&path, content)
                .map_err(|e| e.to_string())?;
            let path_str = path.to_string_lossy().to_string();
            // 現在のファイルパスを更新
            {
                let mut paths = state.window_file_paths.lock().unwrap();
                paths.insert(window_label, Some(path_str.clone()));
            }
            Ok(path_str)
        },
        _ => Err("No file selected".to_string())
    }
}

// ファイル読み込みコマンド（新しいウィンドウで開く）
#[tauri::command]
async fn open_file(
    window: tauri::Window,
    state: tauri::State<'_, AppState>
) -> Result<(), String> {
    use tauri_plugin_dialog::{DialogExt, FilePath};

    let file_path = window.app_handle().dialog()
        .file()
        .add_filter("Tree Files", &["tree", "json"])
        .blocking_pick_file();

    match file_path {
        Some(FilePath::Path(path)) => {
            let content = std::fs::read_to_string(&path)
                .map_err(|e| e.to_string())?;
            let path_str = path.to_string_lossy().to_string();

            // ファイル名を抽出
            let file_name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Untitled")
                .to_string();

            // 新しいウィンドウを作成
            let app_handle = window.app_handle();
            let window_count = {
                let paths = state.window_file_paths.lock().unwrap();
                paths.len()
            };

            let new_window_label = format!("window-{}", window_count);

            let new_window = tauri::webview::WebviewWindowBuilder::new(
                app_handle,
                &new_window_label,
                tauri::WebviewUrl::App("index.html".into())
            )
            .title(&format!("{}  -  Logical Node 3", file_name))
            .inner_size(1200.0, 800.0)
            .build()
            .map_err(|e| e.to_string())?;

            // 終了確認は実装が複雑なため一旦無効化

            // 新しいウィンドウのファイルパスを保存
            {
                let mut paths = state.window_file_paths.lock().unwrap();
                paths.insert(new_window_label.clone(), Some(path_str.clone()));
            }

            // 新しいウィンドウ用のファイルデータを待機状態に保存
            {
                let mut pending = state.pending_file_data.lock().unwrap();
                pending.insert(new_window_label, PendingFileData {
                    content,
                    file_name,
                });
            }

            Ok(())
        },
        _ => Err("No file selected".to_string())
    }
}

// 新規ファイルコマンド（新しいウィンドウを開く）
#[tauri::command]
async fn new_file(
    window: tauri::Window,
    state: tauri::State<'_, AppState>
) -> Result<(), String> {
    let app_handle = window.app_handle();
    let window_count = {
        let paths = state.window_file_paths.lock().unwrap();
        paths.len()
    };

    let new_window_label = format!("window-{}", window_count);

    let new_window = tauri::webview::WebviewWindowBuilder::new(
        app_handle,
        &new_window_label,
        tauri::WebviewUrl::App("index.html".into())
    )
    .title("Untitled  -  Logical Node 3")
    .inner_size(1200.0, 800.0)
    .build()
    .map_err(|e| e.to_string())?;

    // 終了確認は実装が複雑なため一旦無効化

    // 新しいウィンドウのファイルパスを初期化
    {
        let mut paths = state.window_file_paths.lock().unwrap();
        paths.insert(new_window_label, None);
    }

    Ok(())
}

// 未保存の変更があるかチェックするコマンド
#[tauri::command]
async fn get_file_path(
    window: tauri::Window,
    state: tauri::State<'_, AppState>
) -> Result<Option<String>, String> {
    let window_label = window.label().to_string();
    let paths = state.window_file_paths.lock().unwrap();
    Ok(paths.get(&window_label).and_then(|p| p.clone()))
}

// ウィンドウを閉じるコマンド
#[tauri::command]
async fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

// 待機中のファイルデータを取得
#[tauri::command]
async fn get_pending_file_data(
    window: tauri::Window,
    state: tauri::State<'_, AppState>
) -> Result<Option<(String, String)>, String> {
    let window_label = window.label().to_string();
    let mut pending = state.pending_file_data.lock().unwrap();

    if let Some(data) = pending.remove(&window_label) {
        Ok(Some((data.content, data.file_name)))
    } else {
        Ok(None)
    }
}

// ファイルを直接読み込む（パスを指定）
#[tauri::command]
async fn read_file(file_path: String) -> Result<String, String> {
    std::fs::read_to_string(&file_path)
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            window_file_paths: Mutex::new(HashMap::new()),
            pending_file_data: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            update_window_title,
            save_file,
            save_file_as,
            open_file,
            new_file,
            get_file_path,
            close_window,
            get_pending_file_data,
            read_file
        ])
        .setup(|_app| {
            // 終了確認は実装が複雑なため一旦無効化
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
