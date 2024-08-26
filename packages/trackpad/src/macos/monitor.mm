#import <Cocoa/Cocoa.h>
#import <objc/runtime.h>
#import "monitor.h"

@interface TrackpadMonitor : NSObject
@end

@implementation TrackpadMonitor

static TrackpadCallback _scrollStartCallback;
static TrackpadCallback _scrollStopCallback;
static TrackpadCallback _forceClickCallback;
static NSDate *_lastScrollStartDate;
static NSDate *_lastScrollStopDate;
static BOOL _isScrolling = NO;
static NSInteger _lastPressureStage = 0;

+ (TrackpadCallback)scrollStartCallback { return _scrollStartCallback; }
+ (void)setScrollStartCallback:(TrackpadCallback)callback { _scrollStartCallback = callback; }
+ (TrackpadCallback)scrollStopCallback { return _scrollStopCallback; }
+ (void)setScrollStopCallback:(TrackpadCallback)callback { _scrollStopCallback = callback; }
+ (TrackpadCallback)forceClickCallback { return _forceClickCallback; }
+ (void)setForceClickCallback:(TrackpadCallback)callback { _forceClickCallback = callback; }
+ (NSDate *)lastScrollStartDate { return _lastScrollStartDate; }
+ (void)setLastScrollStartDate:(NSDate *)date { _lastScrollStartDate = date; }
+ (NSDate *)lastScrollStopDate { return _lastScrollStopDate; }
+ (void)setLastScrollStopDate:(NSDate *)date { _lastScrollStopDate = date; }
+ (BOOL)isScrolling { return _isScrolling; }
+ (void)setIsScrolling:(BOOL)scrolling { _isScrolling = scrolling; }
+ (NSInteger)lastPressureStage { return _lastPressureStage; }
+ (void)setLastPressureStage:(NSInteger)stage { _lastPressureStage = stage; }

+ (void)initialize {
    if (self == [TrackpadMonitor class]) {
        [self swizzleNSEventDeltaY];
        [self swizzleNSWindowSendEvent];
    }
}

+ (void)swizzleNSEventDeltaY {
    Class eventClass = [NSEvent class];
    SEL originalSelector = @selector(deltaY);
    SEL swizzledSelector = @selector(trackpadMonitor_deltaY);
    
    Method originalMethod = class_getInstanceMethod(eventClass, originalSelector);
    Method swizzledMethod = class_getInstanceMethod(eventClass, swizzledSelector);
    
    method_exchangeImplementations(originalMethod, swizzledMethod);
}

+ (void)swizzleNSWindowSendEvent {
    Class windowClass = [NSWindow class];
    SEL originalSelector = @selector(sendEvent:);
    SEL swizzledSelector = @selector(trackpadMonitor_sendEvent:);
    
    Method originalMethod = class_getInstanceMethod(windowClass, originalSelector);
    Method swizzledMethod = class_getInstanceMethod(windowClass, swizzledSelector);
    
    method_exchangeImplementations(originalMethod, swizzledMethod);
}

@end

@implementation NSEvent (TrackpadMonitor)

- (CGFloat)trackpadMonitor_deltaY {
    if (self.type != NSEventTypeScrollWheel) {
        return [self trackpadMonitor_deltaY];
    }

    [self handleScrollPhase];
    return [self trackpadMonitor_deltaY];
}

- (void)handleScrollPhase {
    switch (self.phase) {
        case NSEventPhaseBegan:
            [self handleScrollStart];
            break;
        case NSEventPhaseEnded:
            [self handleScrollEnd];
            break;
        default:
            break;
    }
}

- (void)handleScrollStart {
    if ([self shouldTriggerCallback:TrackpadMonitor.lastScrollStartDate]) {
        if (TrackpadMonitor.scrollStartCallback) {
            TrackpadMonitor.scrollStartCallback();
        }
        TrackpadMonitor.lastScrollStartDate = [NSDate date];
        TrackpadMonitor.isScrolling = YES;
    }
}

- (void)handleScrollEnd {
    if (TrackpadMonitor.isScrolling && [self shouldTriggerCallback:TrackpadMonitor.lastScrollStopDate]) {
        if (TrackpadMonitor.scrollStopCallback) {
            TrackpadMonitor.scrollStopCallback();
        }
        TrackpadMonitor.lastScrollStopDate = [NSDate date];
        TrackpadMonitor.isScrolling = NO;
    }
}

- (BOOL)shouldTriggerCallback:(NSDate *)lastDate {
    return !lastDate || [lastDate timeIntervalSinceNow] < -0.002;
}

@end

@implementation NSWindow (TrackpadMonitor)

- (void)trackpadMonitor_sendEvent:(NSEvent *)event {
    if (event.type == NSEventTypePressure && event.pressureBehavior == NSPressureBehaviorPrimaryDeepClick) {
        [self handleForceClick:event];
    }
    [self trackpadMonitor_sendEvent:event];
}

- (void)handleForceClick:(NSEvent *)event {
    if (TrackpadMonitor.lastPressureStage == 1 && event.stage == 2 && TrackpadMonitor.forceClickCallback) {
        TrackpadMonitor.forceClickCallback();
    }
    TrackpadMonitor.lastPressureStage = event.stage;
}

@end

void trackpad_monitor_initialize(void) {
    [TrackpadMonitor class];
}

void trackpad_monitor_set_scroll_start_callback(TrackpadCallback callback) {
    TrackpadMonitor.scrollStartCallback = callback;
}

void trackpad_monitor_set_scroll_stop_callback(TrackpadCallback callback) {
    TrackpadMonitor.scrollStopCallback = callback;
}

void trackpad_monitor_set_force_click_callback(TrackpadCallback callback) {
    TrackpadMonitor.forceClickCallback = callback;
}
