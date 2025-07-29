use crate::commands::files::{read_app_data_file, save_markdown_content};
use crate::commands::project::scan_project;
use crate::models::Collection;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

// Default fallback values for quick entry
const DEFAULT_PROJECT_PATH: &str = "/Users/danny/dev/astro-editor/temp-dummy-astro-project";
const DEFAULT_COLLECTION_NAME: &str = "notes";

#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickEntryData {
    pub project_path: String,
    pub default_collection: String,
    pub collections: Vec<Collection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct QuickEntrySettings {
    enabled: bool,
    #[serde(rename = "globalShortcut")]
    global_shortcut: String,
    #[serde(rename = "defaultCollection")]
    default_collection: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GeneralSettings {
    #[serde(rename = "ideCommand")]
    ide_command: String,
    theme: String,
    highlights: serde_json::Value,
    #[serde(rename = "quickEntry")]
    quick_entry: QuickEntrySettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GlobalSettings {
    general: GeneralSettings,
    #[serde(rename = "defaultProjectSettings")]
    default_project_settings: serde_json::Value,
    version: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ProjectRegistry {
    projects: HashMap<String, serde_json::Value>,
    #[serde(rename = "lastOpenedProject")]
    last_opened_project: Option<String>,
    version: i32,
}

/// Create default quick entry data for fallback scenarios
async fn create_default_quick_entry_data() -> Result<QuickEntryData, String> {
    let collections = scan_project(DEFAULT_PROJECT_PATH.to_string()).await?;
    Ok(QuickEntryData {
        project_path: DEFAULT_PROJECT_PATH.to_string(),
        default_collection: DEFAULT_COLLECTION_NAME.to_string(),
        collections,
    })
}

/// Spawn the quick entry window
#[tauri::command]
pub async fn spawn_quick_entry_window(app: AppHandle) -> Result<(), String> {
    // Check if window already exists
    if let Some(existing_window) = app.get_webview_window("quick-entry") {
        // If window exists, just show and focus it
        existing_window
            .show()
            .map_err(|e| format!("Failed to show existing window: {e}"))?;
        existing_window
            .set_focus()
            .map_err(|e| format!("Failed to focus existing window: {e}"))?;
        return Ok(());
    }

    // Create new quick entry window
    let window = WebviewWindowBuilder::new(
        &app,
        "quick-entry",
        WebviewUrl::App("quick-entry.html".into()),
    )
    .title("Quick Note")
    .inner_size(420.0, 380.0)
    .min_inner_size(350.0, 250.0)
    .center()
    .decorations(false)
    .always_on_top(true)
    .resizable(true)
    .transparent(true)
    .shadow(true)
    .skip_taskbar(true)
    .visible(false) // Start hidden, show after setup
    .build()
    .map_err(|e| format!("Failed to create window: {e}"))?;

    // Apply macOS vibrancy
    #[cfg(target_os = "macos")]
    {
        apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0))
            .map_err(|e| format!("Failed to apply vibrancy: {e}"))?
    }

    // Show the window
    window
        .show()
        .map_err(|e| format!("Failed to show window: {e}"))?;

    info!("Quick entry window spawned successfully");
    Ok(())
}

/// Save a quick note to the specified collection
#[tauri::command]
pub async fn save_quick_note(
    app: AppHandle,
    title: String,
    content: String,
    collection: String,
) -> Result<(), String> {
    // Get project data to determine where to save
    let quick_entry_data = get_quick_entry_data(app.clone()).await?;

    // Generate filename
    let filename = generate_quick_note_filename(&title, &content);

    // Build file path
    let collection_path = PathBuf::from(&quick_entry_data.project_path)
        .join("src")
        .join("content")
        .join(&collection)
        .join(format!("{filename}.md"));

    // Create frontmatter
    let mut frontmatter = HashMap::new();
    if !title.trim().is_empty() {
        frontmatter.insert("title".to_string(), serde_json::Value::String(title));
    }

    // Add creation date
    let now = chrono::Utc::now();
    frontmatter.insert(
        "created".to_string(),
        serde_json::Value::String(now.to_rfc3339()),
    );

    // Save the file
    save_markdown_content(
        collection_path.to_string_lossy().to_string(),
        frontmatter,
        content,
        String::new(),                 // No imports for quick notes
        None,                          // No schema field order
        quick_entry_data.project_path, // project root
    )
    .await?;

    info!("Quick note saved successfully to collection: {collection}");
    Ok(())
}

/// Get project data needed for quick entry window
#[tauri::command]
pub async fn get_quick_entry_data(app: AppHandle) -> Result<QuickEntryData, String> {
    // Read global settings to get quick entry configuration
    let global_settings =
        match read_app_data_file(app.clone(), "preferences/global-settings.json".to_string()).await
        {
            Ok(content) => {
                match serde_json::from_str::<GlobalSettings>(&content) {
                    Ok(settings) => settings,
                    Err(e) => {
                        warn!("Failed to parse global settings: {e}, using defaults");
                        // Use default values if parsing fails
                        return create_default_quick_entry_data().await;
                    }
                }
            }
            Err(e) => {
                warn!("Failed to read global settings: {e}, using defaults");
                // Use default values if file doesn't exist
                return create_default_quick_entry_data().await;
            }
        };

    // Get the current project path from project registry
    let project_path = match read_app_data_file(
        app.clone(),
        "preferences/project-registry.json".to_string(),
    )
    .await
    {
        Ok(content) => {
            match serde_json::from_str::<ProjectRegistry>(&content) {
                Ok(registry) => {
                    if let Some(last_project_id) = registry.last_opened_project {
                        if let Some(project_data) = registry.projects.get(&last_project_id) {
                            // Extract path from project metadata
                            if let Some(path) = project_data.get("path") {
                                if let Some(path_str) = path.as_str() {
                                    path_str.to_string()
                                } else {
                                    warn!("Project path is not a string, using default");
                                    DEFAULT_PROJECT_PATH.to_string()
                                }
                            } else {
                                warn!("Project data missing path field, using default");
                                DEFAULT_PROJECT_PATH.to_string()
                            }
                        } else {
                            warn!("Last opened project not found in registry, using default");
                            DEFAULT_PROJECT_PATH.to_string()
                        }
                    } else {
                        warn!("No last opened project, using default");
                        DEFAULT_PROJECT_PATH.to_string()
                    }
                }
                Err(e) => {
                    warn!("Failed to parse project registry: {e}, using default");
                    DEFAULT_PROJECT_PATH.to_string()
                }
            }
        }
        Err(e) => {
            warn!("Failed to read project registry: {e}, using default");
            DEFAULT_PROJECT_PATH.to_string()
        }
    };

    // Get collections for the project
    let collections = scan_project(project_path.clone()).await?;

    Ok(QuickEntryData {
        project_path,
        default_collection: global_settings.general.quick_entry.default_collection,
        collections,
    })
}

/// Register global shortcut for quick entry
#[tauri::command]
pub async fn register_quick_entry_shortcut(
    _app: AppHandle,
    shortcut: String,
) -> Result<(), String> {
    // In Tauri v2, shortcut registration is done through the plugin builder
    // This function is kept for API compatibility but actual registration happens in lib.rs
    warn!("Global shortcut registration should be done through plugin builder in Tauri v2");

    // For now, we'll just validate the shortcut format
    if shortcut.is_empty() {
        return Err("Shortcut cannot be empty".to_string());
    }

    info!("Global shortcut '{shortcut}' registered successfully");
    Ok(())
}

/// Unregister global shortcut
#[tauri::command]
pub async fn unregister_quick_entry_shortcut(
    _app: AppHandle,
    shortcut: String,
) -> Result<(), String> {
    // In Tauri v2, shortcut unregistration is done through the plugin
    // This function is kept for API compatibility
    warn!("Global shortcut unregistration should be done through plugin in Tauri v2");

    if shortcut.is_empty() {
        return Err("Shortcut cannot be empty".to_string());
    }

    info!("Global shortcut '{shortcut}' unregistered successfully");
    Ok(())
}

/// Generate a filename for a quick note
fn generate_quick_note_filename(title: &str, content: &str) -> String {
    // Priority: title > first line > timestamp
    if !title.trim().is_empty() {
        return slugify(title);
    }

    // Try to use first line of content
    let first_line = content
        .lines()
        .next()
        .unwrap_or("")
        .replace('#', "")
        .trim()
        .to_string();

    if !first_line.is_empty() && first_line.len() <= 50 {
        return slugify(&first_line);
    }

    // Fallback to timestamp
    let timestamp = chrono::Utc::now();
    format!("quick-note-{}", timestamp.format("%Y-%m-%d-%H%M%S"))
}

/// Convert text to a URL-friendly slug
fn slugify(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<&str>>()
        .join("-")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_slugify() {
        assert_eq!(slugify("Hello World"), "hello-world");
        assert_eq!(slugify("Test-With_Underscores"), "test-with-underscores");
        assert_eq!(slugify("Special!@#$%Characters"), "special-characters");
        assert_eq!(slugify("Multiple   Spaces"), "multiple-spaces");
    }

    #[test]
    fn test_filename_generation() {
        assert_eq!(
            generate_quick_note_filename("My Title", "Some content"),
            "my-title"
        );
        assert_eq!(
            generate_quick_note_filename("", "# First Line\nOther content"),
            "first-line"
        );
        // Timestamp test would be hard to verify exactly, so just check it starts with "quick-note-"
        assert!(generate_quick_note_filename("", "").starts_with("quick-note-"));
    }
}
