use crate::BackendResult;
use once_cell::sync::Lazy;
use std::env;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq)]
pub enum BrowserFamily {
    Chromium,
    Firefox,
    Safari,
}

#[derive(Debug, Clone)]
pub struct BrowserConfig {
    pub name: &'static str,
    pub family: BrowserFamily,
    /// Function that returns the path to the browser's history database
    pub get_history_path: fn(&str) -> PathBuf,
    /// Function that returns the path to the browser's bookmarks database
    pub get_bookmarks_path: fn(&str) -> PathBuf,
}

fn get_home_dir() -> Option<String> {
    env::var("HOME").or_else(|_| env::var("USERPROFILE")).ok()
}

// Chromium-based browser paths
fn chrome_history_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => {
            Path::new(home_dir).join("Library/Application Support/Google/Chrome/Default/History")
        }
        "windows" => {
            Path::new(home_dir).join("AppData/Local/Google/Chrome/User Data/Default/History")
        }
        "linux" => Path::new(home_dir).join(".config/google-chrome/Default/History"),
        _ => Path::new(home_dir).join(""),
    }
}

fn chrome_bookmarks_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => {
            Path::new(home_dir).join("Library/Application Support/Google/Chrome/Default/Bookmarks")
        }
        "windows" => {
            Path::new(home_dir).join("AppData/Local/Google/Chrome/User Data/Default/Bookmarks")
        }
        "linux" => Path::new(home_dir).join(".config/google-chrome/Default/Bookmarks"),
        _ => Path::new(home_dir).join(""),
    }
}

fn brave_history_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => Path::new(home_dir)
            .join("Library/Application Support/BraveSoftware/Brave-Browser/Default/History"),
        "windows" => Path::new(home_dir)
            .join("AppData/Local/BraveSoftware/Brave-Browser/User Data/Default/History"),
        "linux" => Path::new(home_dir).join(".config/BraveSoftware/Brave-Browser/Default/History"),
        _ => Path::new(home_dir).join(""),
    }
}

fn edge_history_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => {
            Path::new(home_dir).join("Library/Application Support/Microsoft Edge/Default/History")
        }
        "windows" => {
            Path::new(home_dir).join("AppData/Local/Microsoft/Edge/User Data/Default/History")
        }
        "linux" => Path::new(home_dir).join(".config/microsoft-edge/Default/History"),
        _ => Path::new(home_dir).join(""),
    }
}
fn opera_history_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => Path::new(home_dir)
            .join("Library/Application Support/com.operasoftware.Opera/Default/History"),
        "windows" => {
            Path::new(home_dir).join("AppData/Local/Opera Software/Opera Stable/Default/History")
        }
        "linux" => Path::new(home_dir).join(".config/opera/Default/History"),
        _ => Path::new(home_dir).join(""),
    }
}

fn vivaldi_history_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => Path::new(home_dir).join("Library/Application Support/Vivaldi/Default/History"),
        "windows" => Path::new(home_dir).join("AppData/Local/Vivaldi/User Data/Default/History"),
        "linux" => Path::new(home_dir).join(".config/vivaldi/Default/History"),
        _ => Path::new(home_dir).join(""),
    }
}

fn arc_history_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => {
            Path::new(home_dir).join("Library/Application Support/Arc/User Data/Default/History")
        }
        "windows" => Path::new(home_dir).join("AppData/Local/Arc/User Data/Default/History"),
        "linux" => Path::new(home_dir).join(".config/arc/Default/History"),
        _ => Path::new(home_dir).join(""),
    }
}

fn dia_history_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => {
            Path::new(home_dir).join("Library/Application Support/Dia/User Data/Default/History")
        }
        "windows" => Path::new(home_dir).join("AppData/Local/Dia/User Data/Default/History"),
        "linux" => Path::new(home_dir).join(".config/dia/Default/History"),
        _ => Path::new(home_dir).join(""),
    }
}

fn safari_history_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => Path::new(home_dir).join("Library/Safari/History.db"),
        _ => Path::new(home_dir).join(""), // Safari is only available on macOS
    }
}

// Firefox-based browser paths
fn firefox_history_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => Path::new(home_dir).join("Library/Application Support/Firefox/Profiles"),
        "windows" => Path::new(home_dir).join("AppData/Roaming/Mozilla/Firefox/Profiles"),
        "linux" => Path::new(home_dir).join(".mozilla/firefox"),
        _ => Path::new(home_dir).join(""),
    }
}

fn tor_history_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => Path::new(home_dir).join("Library/Application Support/TorBrowser-Data/Browser/profile.default"),
        "windows" => Path::new(home_dir).join("AppData/Roaming/TorBrowser/Browser/TorBrowser/Data/Browser/profile.default"),
        "linux" => Path::new(home_dir).join(".local/share/torbrowser/tbb/x86_64/tor-browser/Browser/TorBrowser/Data/Browser/profile.default"),
        _ => Path::new(home_dir).join(""),
    }
}

fn waterfox_history_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => Path::new(home_dir).join("Library/Application Support/Waterfox/Profiles"),
        "windows" => Path::new(home_dir).join("AppData/Roaming/Waterfox/Profiles"),
        "linux" => Path::new(home_dir).join(".waterfox"),
        _ => Path::new(home_dir).join(""),
    }
}

fn zen_history_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => Path::new(home_dir).join("Library/Application Support/zen/Profiles"),
        "windows" => Path::new(home_dir).join("AppData/Roaming/zen/Profiles"),
        "linux" => Path::new(home_dir).join(".zen"),
        _ => Path::new(home_dir).join(""),
    }
}

fn firefox_bookmarks_path(home_dir: &str) -> PathBuf {
    // For Firefox, the bookmarks are in the same places.sqlite file as history
    match env::consts::OS {
        "macos" => Path::new(home_dir).join("Library/Application Support/Firefox/Profiles"),
        "windows" => Path::new(home_dir).join("AppData/Roaming/Mozilla/Firefox/Profiles"),
        "linux" => Path::new(home_dir).join(".mozilla/firefox"),
        _ => Path::new(home_dir).join(""),
    }
}

fn tor_bookmarks_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => Path::new(home_dir).join("Library/Application Support/TorBrowser-Data/Browser/profile.default/places.sqlite"),
        "windows" => Path::new(home_dir).join("AppData/Roaming/TorBrowser/Browser/TorBrowser/Data/Browser/profile.default/places.sqlite"),
        "linux" => Path::new(home_dir).join(".local/share/torbrowser/tbb/x86_64/tor-browser/Browser/TorBrowser/Data/Browser/profile.default/places.sqlite"),
        _ => Path::new(home_dir).join(""),
    }
}

fn waterfox_bookmarks_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => Path::new(home_dir).join("Library/Application Support/Waterfox/Profiles"),
        "windows" => Path::new(home_dir).join("AppData/Roaming/Waterfox/Profiles"),
        "linux" => Path::new(home_dir).join(".waterfox"),
        _ => Path::new(home_dir).join(""),
    }
}

fn zen_bookmarks_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => Path::new(home_dir).join("Library/Application Support/zen/Profiles"),
        "windows" => Path::new(home_dir).join("AppData/Roaming/zen/Profiles"),
        "linux" => Path::new(home_dir).join(".zen"),
        _ => Path::new(home_dir).join(""),
    }
}

fn safari_bookmarks_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => Path::new(home_dir).join("Library/Safari/Bookmarks.db"),
        _ => Path::new(home_dir).join(""), // Safari is only available on macOS
    }
}

fn brave_bookmarks_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => Path::new(home_dir)
            .join("Library/Application Support/BraveSoftware/Brave-Browser/Default/Bookmarks"),
        "windows" => Path::new(home_dir)
            .join("AppData/Local/BraveSoftware/Brave-Browser/User Data/Default/Bookmarks"),
        "linux" => {
            Path::new(home_dir).join(".config/BraveSoftware/Brave-Browser/Default/Bookmarks")
        }
        _ => Path::new(home_dir).join(""),
    }
}

fn edge_bookmarks_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => {
            Path::new(home_dir).join("Library/Application Support/Microsoft Edge/Default/Bookmarks")
        }
        "windows" => {
            Path::new(home_dir).join("AppData/Local/Microsoft/Edge/User Data/Default/Bookmarks")
        }
        "linux" => Path::new(home_dir).join(".config/microsoft-edge/Default/Bookmarks"),
        _ => Path::new(home_dir).join(""),
    }
}

fn opera_bookmarks_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => Path::new(home_dir)
            .join("Library/Application Support/com.operasoftware.Opera/Default/Bookmarks"),
        "windows" => {
            Path::new(home_dir).join("AppData/Local/Opera Software/Opera Stable/Default/Bookmarks")
        }
        "linux" => Path::new(home_dir).join(".config/opera/Default/Bookmarks"),
        _ => Path::new(home_dir).join(""),
    }
}

fn vivaldi_bookmarks_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => {
            Path::new(home_dir).join("Library/Application Support/Vivaldi/Default/Bookmarks")
        }
        "windows" => Path::new(home_dir).join("AppData/Local/Vivaldi/User Data/Default/Bookmarks"),
        "linux" => Path::new(home_dir).join(".config/vivaldi/Default/Bookmarks"),
        _ => Path::new(home_dir).join(""),
    }
}

fn arc_bookmarks_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => {
            Path::new(home_dir).join("Library/Application Support/Arc/User Data/Default/Bookmarks")
        }
        "windows" => Path::new(home_dir).join("AppData/Local/Arc/User Data/Default/Bookmarks"),
        "linux" => Path::new(home_dir).join(".config/arc/Default/Bookmarks"),
        _ => Path::new(home_dir).join(""),
    }
}

fn dia_bookmarks_path(home_dir: &str) -> PathBuf {
    match env::consts::OS {
        "macos" => {
            Path::new(home_dir).join("Library/Application Support/Dia/User Data/Default/Bookmarks")
        }
        "windows" => Path::new(home_dir).join("AppData/Local/Dia/User Data/Default/Bookmarks"),
        "linux" => Path::new(home_dir).join(".config/dia/Default/Bookmarks"),
        _ => Path::new(home_dir).join(""),
    }
}

static SUPPORTED_BROWSERS: Lazy<Vec<BrowserConfig>> = Lazy::new(|| {
    vec![
        // Safari browser
        BrowserConfig {
            name: "safari",
            family: BrowserFamily::Safari,
            get_history_path: safari_history_path,
            get_bookmarks_path: safari_bookmarks_path,
        },
        // Chromium-based browsers
        BrowserConfig {
            name: "chrome",
            family: BrowserFamily::Chromium,
            get_history_path: chrome_history_path,
            get_bookmarks_path: chrome_bookmarks_path,
        },
        BrowserConfig {
            name: "brave",
            family: BrowserFamily::Chromium,
            get_history_path: brave_history_path,
            get_bookmarks_path: brave_bookmarks_path,
        },
        BrowserConfig {
            name: "edge",
            family: BrowserFamily::Chromium,
            get_history_path: edge_history_path,
            get_bookmarks_path: edge_bookmarks_path,
        },
        BrowserConfig {
            name: "opera",
            family: BrowserFamily::Chromium,
            get_history_path: opera_history_path,
            get_bookmarks_path: opera_bookmarks_path,
        },
        BrowserConfig {
            name: "vivaldi",
            family: BrowserFamily::Chromium,
            get_history_path: vivaldi_history_path,
            get_bookmarks_path: vivaldi_bookmarks_path,
        },
        BrowserConfig {
            name: "arc",
            family: BrowserFamily::Chromium,
            get_history_path: arc_history_path,
            get_bookmarks_path: arc_bookmarks_path,
        },
        BrowserConfig {
            name: "dia",
            family: BrowserFamily::Chromium,
            get_history_path: dia_history_path,
            get_bookmarks_path: dia_bookmarks_path,
        },
        // Firefox-based browsers
        BrowserConfig {
            name: "firefox",
            family: BrowserFamily::Firefox,
            get_history_path: firefox_history_path,
            get_bookmarks_path: firefox_bookmarks_path,
        },
        BrowserConfig {
            name: "tor",
            family: BrowserFamily::Firefox,
            get_history_path: tor_history_path,
            get_bookmarks_path: tor_bookmarks_path,
        },
        BrowserConfig {
            name: "waterfox",
            family: BrowserFamily::Firefox,
            get_history_path: waterfox_history_path,
            get_bookmarks_path: waterfox_bookmarks_path,
        },
        // Add Zen browser
        BrowserConfig {
            name: "zen",
            family: BrowserFamily::Firefox,
            get_history_path: zen_history_path,
            get_bookmarks_path: zen_bookmarks_path,
        },
    ]
});

pub fn get_browser_config(browser_type: &str) -> Option<&'static BrowserConfig> {
    SUPPORTED_BROWSERS.iter().find(|b| b.name == browser_type)
}

pub fn get_history_file_path(browser_type: &str) -> BackendResult<PathBuf> {
    let home_dir = get_home_dir().ok_or_else(|| {
        crate::BackendError::GenericError("Could not determine home directory".to_string())
    })?;

    let browser_config = get_browser_config(browser_type).ok_or_else(|| {
        crate::BackendError::GenericError(format!("Unsupported browser type: {}", browser_type))
    })?;

    let base_path = (browser_config.get_history_path)(&home_dir);

    match browser_config.family {
        BrowserFamily::Chromium => {
            if !base_path.exists() {
                return Err(crate::BackendError::GenericError(format!(
                    "Browser history file not found at: {:?}",
                    base_path
                )));
            }
            Ok(base_path)
        }
        BrowserFamily::Firefox => {
            if base_path.exists() {
                // For Firefox-based browsers, we need to find the default profile
                if let Ok(entries) = std::fs::read_dir(&base_path) {
                    for entry in entries.filter_map(Result::ok) {
                        let path = entry.path();
                        if path.is_dir() {
                            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                                // Handle various profile naming patterns
                                if name.ends_with(".default-release")
                                    || name.ends_with(".default")
                                    || name.contains("Default")
                                    || (name.contains('.') && name.contains("release"))
                                {
                                    let history_file = path.join("places.sqlite");
                                    if history_file.exists() {
                                        return Ok(history_file);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Err(crate::BackendError::GenericError(format!(
                "Could not find history file in profiles directory: {:?}",
                base_path
            )))
        }
        BrowserFamily::Safari => {
            if !base_path.exists() {
                return Err(crate::BackendError::GenericError(format!(
                    "Browser history file not found at: {:?}",
                    base_path
                )));
            }
            Ok(base_path)
        }
    }
}

pub fn get_bookmarks_file_path(browser_type: &str) -> BackendResult<PathBuf> {
    let home_dir = get_home_dir().ok_or_else(|| {
        crate::BackendError::GenericError("Could not determine home directory".to_string())
    })?;

    let browser_config = get_browser_config(browser_type).ok_or_else(|| {
        crate::BackendError::GenericError(format!("Unsupported browser type: {}", browser_type))
    })?;

    let base_path = (browser_config.get_bookmarks_path)(&home_dir);

    match browser_config.family {
        BrowserFamily::Chromium => {
            if !base_path.exists() {
                return Err(crate::BackendError::GenericError(format!(
                    "Browser history file not found at: {:?}",
                    base_path
                )));
            }
            Ok(base_path)
        }
        BrowserFamily::Firefox => {
            if base_path.exists() {
                // For Firefox-based browsers, we need to find the default profile
                if let Ok(entries) = std::fs::read_dir(&base_path) {
                    for entry in entries.filter_map(Result::ok) {
                        let path = entry.path();
                        if path.is_dir() {
                            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                                // Handle various profile naming patterns
                                if name.ends_with(".default-release")
                                    || name.ends_with(".default")
                                    || name.contains("Default")
                                    || (name.contains('.') && name.contains("release"))
                                {
                                    let history_file = path.join("places.sqlite");
                                    if history_file.exists() {
                                        return Ok(history_file);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Err(crate::BackendError::GenericError(format!(
                "Could not find history file in profiles directory: {:?}",
                base_path
            )))
        }
        BrowserFamily::Safari => {
            if !base_path.exists() {
                return Err(crate::BackendError::GenericError(format!(
                    "Browser history file not found at: {:?}",
                    base_path
                )));
            }
            Ok(base_path)
        }
    }
}
