pub mod message;
pub mod tunnel;
pub mod worker;
pub mod handlers;

use neon::prelude::*;

const _MODULE_PREFIX: &'static str = "backend";

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    cx.export_function("js__backend_tunnel_init", js_tunnel_init)?;

    Ok(())
}

fn js_tunnel_init(mut cx: FunctionContext) -> JsResult<JsBox<tunnel::WorkerTunnel>> {
    let backend_root_path = cx.argument::<JsString>(0)?.value(&mut cx);
    let tunnel = tunnel::WorkerTunnel::new(&mut cx, backend_root_path);

    Ok(cx.boxed(tunnel))
}
