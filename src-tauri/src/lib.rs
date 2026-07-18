mod config_store;
mod error;
mod link_manager;
mod models;
mod paths;
mod skill_fs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("failed to run Skill Switch");
}
