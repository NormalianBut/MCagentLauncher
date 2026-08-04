mod controlled_workspace;

use controlled_workspace::ControlledWorkspace;
use tauri::Manager;

fn executor(app: &tauri::AppHandle) -> Result<ControlledWorkspace, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|_| {
        "APP_DATA_UNAVAILABLE: The Desktop application data boundary is unavailable.".to_owned()
    })?;
    ControlledWorkspace::from_app_data_dir(app_data_dir).map_err(|error| error.user_message())
}

#[tauri::command]
fn executor_preview_controlled_workspace(
    app: tauri::AppHandle,
    workspace_id: String,
    transaction_id: String,
    operation: String,
) -> Result<String, String> {
    executor(&app)?
        .preview(&workspace_id, &transaction_id, &operation)
        .map_err(|error| error.user_message())
}

#[tauri::command]
fn executor_confirm_controlled_workspace(
    app: tauri::AppHandle,
    workspace_id: String,
    transaction_id: String,
    operation: String,
    confirmation: String,
) -> Result<String, String> {
    executor(&app)?
        .confirm_and_begin(&workspace_id, &transaction_id, &operation, &confirmation)
        .map_err(|error| error.user_message())
}

#[tauri::command]
fn executor_simulate_commit(
    app: tauri::AppHandle,
    workspace_id: String,
    transaction_id: String,
) -> Result<String, String> {
    executor(&app)?
        .simulate_commit(&workspace_id, &transaction_id)
        .map_err(|error| error.user_message())
}

#[tauri::command]
fn executor_simulate_interruption(
    app: tauri::AppHandle,
    workspace_id: String,
    transaction_id: String,
) -> Result<String, String> {
    executor(&app)?
        .simulate_interruption(&workspace_id, &transaction_id)
        .map_err(|error| error.user_message())
}

#[tauri::command]
fn executor_recover(
    app: tauri::AppHandle,
    workspace_id: String,
    transaction_id: String,
) -> Result<String, String> {
    executor(&app)?
        .recover(&workspace_id, &transaction_id)
        .map_err(|error| error.user_message())
}

#[tauri::command]
fn executor_rollback(
    app: tauri::AppHandle,
    workspace_id: String,
    transaction_id: String,
) -> Result<String, String> {
    executor(&app)?
        .rollback(&workspace_id, &transaction_id)
        .map_err(|error| error.user_message())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            executor_preview_controlled_workspace,
            executor_confirm_controlled_workspace,
            executor_simulate_commit,
            executor_simulate_interruption,
            executor_recover,
            executor_rollback,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run MCagentlauncher desktop shell");
}
