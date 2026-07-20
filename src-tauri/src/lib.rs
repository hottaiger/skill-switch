mod backup_service;
mod commands;
mod config_store;
mod error;
mod import_service;
mod link_manager;
mod models;
mod paths;
mod skill_fs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::Manager;

    let app = tauri::Builder::default()
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_skills,
            commands::scan_import_candidates,
            commands::set_skill_visibility,
            commands::import_skills,
            commands::resolve_import_conflict,
            commands::uninstall_skill,
            commands::list_backups,
            commands::restore_backup,
            commands::get_settings,
            commands::update_app_path,
            commands::set_app_support,
            commands::update_ui_preferences,
        ])
        .build(tauri::generate_context!())
        .expect("failed to build Skill Switch");

    app.run(|handle, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen {
            has_visible_windows,
            ..
        } = event
        {
            if !has_visible_windows {
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        }
    });
}
