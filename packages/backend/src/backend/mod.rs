pub mod ai;
pub mod handlers;
pub mod message;
pub mod processor;
pub mod tunnel;
pub mod worker;

use neon::prelude::*;

const _MODULE_PREFIX: &'static str = "backend";

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    cx.export_function("js__backend_tunnel_init", js_tunnel_init)?;

    Ok(())
}

fn js_tunnel_init(mut cx: FunctionContext) -> JsResult<JsBox<tunnel::WorkerTunnel>> {
    let backend_root_path = cx.argument::<JsString>(0)?.value(&mut cx);
    let app_path = cx.argument::<JsString>(1)?.value(&mut cx);
    let vision_api_key = cx.argument::<JsString>(2)?.value(&mut cx);
    let vision_api_endpoint = cx.argument::<JsString>(3)?.value(&mut cx);
    let tunnel = tunnel::WorkerTunnel::new(
        &mut cx,
        backend_root_path,
        app_path,
        vision_api_key,
        vision_api_endpoint,
    );

    Ok(cx.boxed(tunnel))
}
