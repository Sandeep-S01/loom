use std::path::PathBuf;
use serde::Serialize;
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineIdentity {
    pub machine_label: String,
    pub fingerprint_seed: String,
}

#[derive(Serialize)]
pub struct FolderSelection {
    pub path: String,
    pub alias: String,
}

/// Opens a native folder picker dialog and returns the selected path.
#[tauri::command]
pub async fn select_folder(app: tauri::AppHandle) -> Result<Option<FolderSelection>, String> {
    let (sender, receiver) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .set_title("Select Project Folder")
        .pick_folder(move |folder_path| {
            let _ = sender.send(folder_path);
        });

    let result = receiver.await.map_err(|e| e.to_string())?;

    match result {
        Some(file_path) => {
            let path_buf: PathBuf = file_path.as_path().ok_or("Invalid path")?.to_path_buf();
            let path_str = path_buf.to_string_lossy().to_string();
            let alias = path_buf
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "project".to_string());

            Ok(Some(FolderSelection {
                path: path_str,
                alias,
            }))
        }
        None => Ok(None),
    }
}

#[derive(Serialize)]
pub struct CompanionStatus {
    pub version: String,
    pub connected: bool,
}

#[tauri::command]
pub fn get_machine_identity() -> MachineIdentity {
    let machine_label = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "CLM Companion".to_string());
    let fingerprint_seed = format!(
        "{}|{}|{}",
        machine_label,
        std::env::consts::OS,
        std::env::consts::ARCH
    );

    MachineIdentity {
        machine_label,
        fingerprint_seed,
    }
}

/// Returns companion status information.
#[tauri::command]
pub fn get_companion_status() -> CompanionStatus {
    CompanionStatus {
        version: env!("CARGO_PKG_VERSION").to_string(),
        connected: false, // Will be updated when WS client is implemented in Phase 3
    }
}
