pub mod ai;
pub mod handlers;
pub mod message;
pub mod migrator;
pub mod processor;
pub mod tunnel;
pub mod worker;

use crate::backend::message::{MiscMessage, WorkerMessage};
use neon::prelude::*;
use tracing_subscriber::fmt::format::FmtSpan;

const _MODULE_PREFIX: &'static str = "backend";

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    cx.export_function("js__backend_tunnel_init", js_tunnel_init)?;
    cx.export_function("js__backend_run_migration", js_run_migration)?;
    cx.export_function("js__backend_set_vision_tagging_flag", js_set_vision_tagging_flag)?;
    Ok(())
}

fn js_tunnel_init(mut cx: FunctionContext) -> JsResult<JsBox<tunnel::WorkerTunnel>> {
    tracing_subscriber::fmt()
        .compact()
        .with_target(false)
        .with_line_number(true)
        .with_thread_names(true)
        .with_span_events(FmtSpan::CLOSE | FmtSpan::ENTER)
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init()
        .map_err(|err| eprintln!("failed to init tracing: {:?}", err))
        .ok();

    let backend_root_path = cx.argument::<JsString>(0)?.value(&mut cx);
    let app_path = cx.argument::<JsString>(1)?.value(&mut cx);
    let api_base = cx.argument::<JsString>(2)?.value(&mut cx);
    let api_key = cx.argument::<JsString>(3)?.value(&mut cx);
    let local_ai_mode = cx.argument::<JsBoolean>(4)?.value(&mut cx);
    let language_setting = cx.argument::<JsString>(5)?.value(&mut cx);
    let event_bus_rx_callback = cx.argument::<JsFunction>(6)?.root(&mut cx);

    let config = tunnel::TunnelConfig {
        backend_root_path,
        app_path,
        api_base,
        api_key,
        local_ai_mode,
        language_setting,
    };
    let tunnel = tunnel::WorkerTunnel::new(&mut cx, config, event_bus_rx_callback);

    tracing::info!("rust<->node tunnel bridge initialized");
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

fn js_set_vision_tagging_flag(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<tunnel::WorkerTunnel>>(0)?;
    let flag = cx.argument::<JsBoolean>(1)?.value(&mut cx);
    let (deferred, promise) = cx.promise();

    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::SetVisionTaggingFlag(flag)),
        deferred,
    );
    Ok(promise)
}
