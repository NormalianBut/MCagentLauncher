fn main() {
    tauri::Builder::default()
        // Real Desktop Local Executor commands will be introduced in a later milestone
        // after dry-run review and explicit user confirmation design is complete.
        .run(tauri::generate_context!())
        .expect("failed to run MCagentlauncher desktop shell");
}
