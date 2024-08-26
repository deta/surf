#[cfg(target_os = "macos")]
pub use crate::macos::*;

#[cfg(not(target_os = "macos"))]
mod other {
    pub fn set_scroll_began_callback<F: Fn() + Send + Sync + 'static>(_callback: F) {}
    pub fn set_scroll_ended_callback<F: Fn() + Send + Sync + 'static>(_callback: F) {}
    pub fn set_force_click_callback<F: Fn() + Send + Sync + 'static>(callback: F) {}

    pub fn initialize_trackpad_monitor() {}
}
#[cfg(not(target_os = "macos"))]
pub use other::*;
