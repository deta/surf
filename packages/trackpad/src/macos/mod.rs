use std::sync::{Arc, LazyLock, Mutex, Once};

static INIT: Once = Once::new();

type TrackpadCallback = Box<dyn Fn() + Send + Sync>;

static SCROLL_START_CALLBACK: LazyLock<Arc<Mutex<Option<TrackpadCallback>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(None)));
static SCROLL_STOP_CALLBACK: LazyLock<Arc<Mutex<Option<TrackpadCallback>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(None)));
static FORCE_CLICK_CALLBACK: LazyLock<Arc<Mutex<Option<TrackpadCallback>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(None)));

#[link(name = "monitor")]
extern "C" {
    fn trackpad_monitor_initialize();
    fn trackpad_monitor_set_scroll_start_callback(callback: extern "C" fn());
    fn trackpad_monitor_set_scroll_stop_callback(callback: extern "C" fn());
    fn trackpad_monitor_set_force_click_callback(callback: extern "C" fn());
}

extern "C" fn scroll_start_callback() {
    if let Some(callback) = SCROLL_START_CALLBACK.lock().unwrap().as_ref() {
        callback();
    }
}

extern "C" fn scroll_stop_callback() {
    if let Some(callback) = SCROLL_STOP_CALLBACK.lock().unwrap().as_ref() {
        callback();
    }
}

extern "C" fn force_click_callback() {
    if let Some(callback) = FORCE_CLICK_CALLBACK.lock().unwrap().as_ref() {
        callback();
    }
}

pub fn set_scroll_start_callback<F: Fn() + Send + Sync + 'static>(callback: F) {
    *SCROLL_START_CALLBACK.lock().unwrap() = Some(Box::new(callback));
}

pub fn set_scroll_stop_callback<F: Fn() + Send + Sync + 'static>(callback: F) {
    *SCROLL_STOP_CALLBACK.lock().unwrap() = Some(Box::new(callback));
}

pub fn set_force_click_callback<F: Fn() + Send + Sync + 'static>(callback: F) {
    *FORCE_CLICK_CALLBACK.lock().unwrap() = Some(Box::new(callback));
}

pub fn initialize_trackpad_monitor() {
    INIT.call_once(|| unsafe {
        trackpad_monitor_initialize();
        trackpad_monitor_set_scroll_start_callback(scroll_start_callback);
        trackpad_monitor_set_scroll_stop_callback(scroll_stop_callback);
        trackpad_monitor_set_force_click_callback(force_click_callback);
    });
}
