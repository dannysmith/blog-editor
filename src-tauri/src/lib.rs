mod commands;
mod models;
mod parser;

use commands::*;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

// Import for PATH environment fix in production builds
// use fix_path_env;

// Store menu item references for later access
struct MenuState {
    format_items: HashMap<String, MenuItem<tauri::Wry>>,
}

impl MenuState {
    fn new() -> Self {
        Self {
            format_items: HashMap::new(),
        }
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! You've been greeted from Rust!")
}

#[tauri::command]
async fn update_format_menu_state(
    app_handle: tauri::AppHandle,
    enabled: bool,
) -> Result<(), String> {
    // Try to enable/disable menu items using stored references
    if let Some(menu_state) = app_handle.try_state::<Mutex<MenuState>>() {
        if let Ok(state) = menu_state.lock() {
            for item in state.format_items.values() {
                let _ = item.set_enabled(enabled);
            }
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            .with_shortcuts(["CmdOrCtrl+Shift+N"])?
            .with_handler(|app, shortcut, event| {
                use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};
                if event.state == ShortcutState::Pressed
                    && (shortcut.matches(Modifiers::SUPER | Modifiers::SHIFT, Code::KeyN) ||
                       shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyN)) {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(e) = spawn_quick_entry_window(app_handle).await {
                                eprintln!("Failed to spawn quick entry window: {e}");
                            }
                        });
                    }
            })
            .build())
        .plugin(tauri_plugin_log::Builder::new()
            .targets([tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout)])
            .build())
        .manage(commands::watcher::init_watcher_state())
        .setup(|app| {
            // Fix PATH environment variable for production builds
            // This ensures shell commands can find executables like 'code', 'cursor', etc.
            // if let Err(e) = fix_path_env::fix() {
            //     eprintln!("Warning: Failed to fix PATH environment: {}", e);
            // }

            // Create menu state
            let mut menu_state = MenuState::new();

            // Create macOS menu bar
            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &MenuItem::with_id(
                        app,
                        "open_project",
                        "Open Project...",
                        true,
                        Some("CmdOrCtrl+Shift+O"),
                    )?,
                    &MenuItem::with_id(app, "new_file", "New File", true, Some("CmdOrCtrl+N"))?,
                    &MenuItem::with_id(app, "quick_note", "Quick Note", true, Some("CmdOrCtrl+Shift+N"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::close_window(app, Some("Close"))?,
                ],
            )?;

            // Create format menu items and store references
            let format_bold = MenuItem::with_id(app, "format_bold", "Bold", false, Some("Cmd+B"))?;
            let format_italic =
                MenuItem::with_id(app, "format_italic", "Italic", false, Some("Cmd+I"))?;
            let format_link =
                MenuItem::with_id(app, "format_link", "Add Link", false, Some("Cmd+K"))?;
            let format_h1 =
                MenuItem::with_id(app, "format_h1", "Heading 1", false, Some("Option+Cmd+1"))?;
            let format_h2 =
                MenuItem::with_id(app, "format_h2", "Heading 2", false, Some("Option+Cmd+2"))?;
            let format_h3 =
                MenuItem::with_id(app, "format_h3", "Heading 3", false, Some("Option+Cmd+3"))?;
            let format_h4 =
                MenuItem::with_id(app, "format_h4", "Heading 4", false, Some("Option+Cmd+4"))?;
            let format_paragraph = MenuItem::with_id(
                app,
                "format_paragraph",
                "Paragraph",
                false,
                Some("Option+Cmd+0"),
            )?;

            // Store references for later access
            menu_state
                .format_items
                .insert("format_bold".to_string(), format_bold.clone());
            menu_state
                .format_items
                .insert("format_italic".to_string(), format_italic.clone());
            menu_state
                .format_items
                .insert("format_link".to_string(), format_link.clone());
            menu_state
                .format_items
                .insert("format_h1".to_string(), format_h1.clone());
            menu_state
                .format_items
                .insert("format_h2".to_string(), format_h2.clone());
            menu_state
                .format_items
                .insert("format_h3".to_string(), format_h3.clone());
            menu_state
                .format_items
                .insert("format_h4".to_string(), format_h4.clone());
            menu_state
                .format_items
                .insert("format_paragraph".to_string(), format_paragraph.clone());

            let edit_menu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, Some("Undo"))?,
                    &PredefinedMenuItem::redo(app, Some("Redo"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, Some("Cut"))?,
                    &PredefinedMenuItem::copy(app, Some("Copy"))?,
                    &PredefinedMenuItem::paste(app, Some("Paste"))?,
                    &PredefinedMenuItem::select_all(app, Some("Select All"))?,
                    &PredefinedMenuItem::separator(app)?,
                    // Text formatting
                    &format_bold,
                    &format_italic,
                    &format_link,
                    &PredefinedMenuItem::separator(app)?,
                    // Heading transformations
                    &format_h1,
                    &format_h2,
                    &format_h3,
                    &format_h4,
                    &format_paragraph,
                ],
            )?;

            let view_menu = Submenu::with_items(
                app,
                "View",
                true,
                &[
                    &MenuItem::with_id(
                        app,
                        "toggle_sidebar",
                        "Toggle Sidebar",
                        true,
                        Some("CmdOrCtrl+1"),
                    )?,
                    &MenuItem::with_id(
                        app,
                        "toggle_frontmatter",
                        "Toggle Frontmatter Panel",
                        true,
                        Some("CmdOrCtrl+2"),
                    )?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(
                        app,
                        "enter_fullscreen",
                        "Enter Full Screen",
                        true,
                        Some("Ctrl+Cmd+F"),
                    )?,
                ],
            )?;

            let app_menu = Submenu::with_items(
                app,
                "Astro Editor",
                true,
                &[
                    &MenuItem::with_id(app, "about", "About Astro Editor", true, None::<&str>)?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "preferences", "Preferences...", true, Some("Cmd+,"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, Some("Hide Astro Editor"))?,
                    &PredefinedMenuItem::hide_others(app, Some("Hide Others"))?,
                    &PredefinedMenuItem::show_all(app, Some("Show All"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(
                        app,
                        "quit",
                        "Quit Astro Editor",
                        true,
                        Some("CmdOrCtrl+Q"),
                    )?,
                ],
            )?;

            let menu = Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu, &view_menu])?;
            app.set_menu(menu)?;

            // Store menu state for later access
            app.manage(Mutex::new(menu_state));

            // Initialize global shortcut for quick entry

            // Global shortcut will be registered when settings are loaded
            // Register global shortcut from settings
            let app_clone = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Try to read settings and register shortcut if enabled
                match get_quick_entry_data(app_clone.clone()).await {
                    Ok(_) => {
                        // Settings loaded successfully, the actual shortcut registration
                        // will happen when preferences are loaded in the UI
                        println!("Quick entry data loaded successfully");
                    }
                    Err(e) => {
                        eprintln!("Failed to load quick entry data: {e}");
                        // Register default shortcut as fallback
                        if let Err(e) = register_quick_entry_shortcut(app_clone, "CmdOrCtrl+Shift+N".to_string()).await {
                            eprintln!("Failed to register default global shortcut: {e}");
                        }
                    }
                }
            });

            // Apply window vibrancy with rounded corners on macOS
            #[cfg(target_os = "macos")]
            {
                let window = app.get_webview_window("main").unwrap();
                apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0))
                    .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");
            }

            // Configure main window to hide instead of quit when closed
            if let Some(main_window) = app.get_webview_window("main") {
                let window_clone = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        // Prevent window from closing, hide it instead so app stays in tray
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

            // Handle menu events
            app.on_menu_event(move |app, event| match event.id().as_ref() {
                "open_project" => {
                    let _ = app.emit("menu-open-project", ());
                }
                "new_file" => {
                    let _ = app.emit("menu-new-file", ());
                }
                "quick_note" => {
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = spawn_quick_entry_window(app_handle).await {
                            eprintln!("Failed to spawn quick entry window: {e}");
                        }
                    });
                }
                "save" => {
                    let _ = app.emit("menu-save", ());
                }
                "toggle_sidebar" => {
                    let _ = app.emit("menu-toggle-sidebar", ());
                }
                "toggle_frontmatter" => {
                    let _ = app.emit("menu-toggle-frontmatter", ());
                }
                "enter_fullscreen" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.set_fullscreen(true);
                    }
                }
                "about" => {
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let package_info = app_handle.package_info();
                        let version = package_info.version.to_string();
                        let name = &package_info.name;

                        let message = format!(
                            "{name}\nVersion {version}\n\nA native macOS markdown editor for Astro content collections.\n\nBuilt with Tauri and React.\n\nCopyright © 2025 Danny Smith. All rights reserved."
                        );
                        let _ = app_handle.dialog()
                            .message(message)
                            .title("About Astro Editor")
                            .kind(MessageDialogKind::Info)
                            .blocking_show();
                    });
                }
                "preferences" => {
                    let _ = app.emit("menu-preferences", ());
                }
                "quit" => {
                    app.exit(0);
                }
                // Text formatting menu items
                "format_bold" => {
                    let _ = app.emit("menu-format-bold", ());
                }
                "format_italic" => {
                    let _ = app.emit("menu-format-italic", ());
                }
                "format_link" => {
                    let _ = app.emit("menu-format-link", ());
                }
                "format_h1" => {
                    let _ = app.emit("menu-format-h1", ());
                }
                "format_h2" => {
                    let _ = app.emit("menu-format-h2", ());
                }
                "format_h3" => {
                    let _ = app.emit("menu-format-h3", ());
                }
                "format_h4" => {
                    let _ = app.emit("menu-format-h4", ());
                }
                "format_paragraph" => {
                    let _ = app.emit("menu-format-paragraph", ());
                }
                _ => {}
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            select_project_folder,
            scan_project,
            scan_project_with_content_dir,
            scan_collection_files,
            read_file,
            write_file,
            create_file,
            delete_file,
            rename_file,
            parse_markdown_content,
            update_frontmatter,
            save_markdown_content,
            start_watching_project,
            start_watching_project_with_content_dir,
            stop_watching_project,
            copy_text_to_clipboard,
            update_format_menu_state,
            copy_file_to_assets,
            copy_file_to_assets_with_override,
            scan_mdx_components,
            save_recovery_data,
            save_crash_report,
            get_app_data_dir,
            write_app_data_file,
            read_app_data_file,
            read_file_content,
            write_file_content,
            create_directory,
            open_path_in_ide,
            get_available_ides,
            spawn_quick_entry_window,
            save_quick_note,
            get_quick_entry_data,
            register_quick_entry_shortcut,
            unregister_quick_entry_shortcut
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    Ok(())
}
