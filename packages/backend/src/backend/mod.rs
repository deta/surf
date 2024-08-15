pub mod ai;
pub mod handlers;
pub mod message;
pub mod migrator;
pub mod processor;
pub mod tunnel;
pub mod worker;

use crate::backend::message::{MiscMessage, WorkerMessage};
use neon::prelude::*;

const _MODULE_PREFIX: &'static str = "backend";

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    cx.export_function("js__backend_tunnel_init", js_tunnel_init)?;
    cx.export_function("js__backend_run_migration", js_run_migration)?;
    Ok(())
}

fn js_tunnel_init(mut cx: FunctionContext) -> JsResult<JsBox<tunnel::WorkerTunnel>> {
    let backend_root_path = cx.argument::<JsString>(0)?.value(&mut cx);
    let app_path = cx.argument::<JsString>(1)?.value(&mut cx);
    let vision_api_key = cx.argument::<JsString>(2)?.value(&mut cx);
    let vision_api_endpoint = cx.argument::<JsString>(3)?.value(&mut cx);
    let openai_api_key = cx.argument::<JsString>(4)?.value(&mut cx);
    let openai_api_endpoint = cx.argument::<JsString>(5)?.value(&mut cx);
    let local_ai_mode = cx.argument::<JsBoolean>(6)?.value(&mut cx);
    let language_setting = cx.argument::<JsString>(7)?.value(&mut cx);
    let tunnel = tunnel::WorkerTunnel::new(
        &mut cx,
        backend_root_path,
        app_path,
        vision_api_key,
        vision_api_endpoint,
        openai_api_key,
        openai_api_endpoint,
        local_ai_mode,
        language_setting,
    );

    Ok(cx.boxed(tunnel))
}

fn js_run_migration(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<tunnel::WorkerTunnel>>(0)?;

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::RunMigration),
        deferred,
    );
    Ok(promise)
}
