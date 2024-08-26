#[cfg(target_os = "macos")]
mod macos;
pub mod trackpad;

use neon::prelude::*;
use std::sync::Arc;

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    trackpad::initialize_trackpad_monitor();

    cx.export_function("setScrollStartCallback", set_scroll_start_callback)?;
    cx.export_function("setScrollStopCallback", set_scroll_stop_callback)?;
    cx.export_function("setForceClickCallback", set_force_click_callback)?;

    Ok(())
}

fn set_scroll_start_callback(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let callback = Arc::new(cx.argument::<JsFunction>(0)?.root(&mut cx));
    let channel = cx.channel();

    trackpad::set_scroll_start_callback(move || {
        let callback = callback.clone();
        channel.send(move |mut cx| {
            let this = cx.undefined();
            let callback = callback.to_inner(&mut cx);
            let _ = callback.call(&mut cx, this, &[]);
            Ok(())
        });
    });

    Ok(cx.undefined())
}

fn set_scroll_stop_callback(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let callback = Arc::new(cx.argument::<JsFunction>(0)?.root(&mut cx));
    let channel = cx.channel();

    trackpad::set_scroll_stop_callback(move || {
        let callback = callback.clone();
        channel.send(move |mut cx| {
            let this = cx.undefined();
            let callback = callback.to_inner(&mut cx);
            let _ = callback.call(&mut cx, this, &[]);
            Ok(())
        });
    });

    Ok(cx.undefined())
}

fn set_force_click_callback(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let callback = Arc::new(cx.argument::<JsFunction>(0)?.root(&mut cx));
    let channel = cx.channel();

    trackpad::set_force_click_callback(move || {
        let callback = callback.clone();
        channel.send(move |mut cx| {
            let this = cx.undefined();
            let callback = callback.to_inner(&mut cx);
            let _ = callback.call(&mut cx, this, &[]);
            Ok(())
        });
    });

    Ok(cx.undefined())
}
