#ifndef MONITOR_H
#define MONITOR_H

#ifdef __cplusplus
extern "C" {
#endif

typedef void (*TrackpadCallback)(void);

void trackpad_monitor_initialize(void);
void trackpad_monitor_set_scroll_start_callback(TrackpadCallback callback);
void trackpad_monitor_set_scroll_stop_callback(TrackpadCallback callback);
void trackpad_monitor_set_force_click_callback(TrackpadCallback callback);

#ifdef __cplusplus
}
#endif

#endif // MONITOR_H
