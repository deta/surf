use crate::{
    api::message::{MiscMessage, WorkerMessage},
    worker::tunnel,
};
use neon::prelude::*;
use tracing::level_filters::LevelFilter;
use tracing_subscriber::{fmt::format::FmtSpan, EnvFilter};

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    cx.export_function("js__backend_tunnel_init", js_tunnel_init)?;
    cx.export_function("js__backend_run_migration", js_run_migration)?;
    cx.export_function(
        "js__backend_set_surf_backend_health",
        js_set_surf_backend_health,
    )?;
    Ok(())
}

fn js_tunnel_init(mut cx: FunctionContext) -> JsResult<JsBox<tunnel::WorkerTunnel>> {
    tracing_subscriber::fmt()
        .compact()
        .with_target(false)
        .with_line_number(true)
        .with_thread_names(true)
        .with_span_events(FmtSpan::CLOSE | FmtSpan::ENTER)
        .with_env_filter(
            EnvFilter::builder()
                .with_default_directive(LevelFilter::INFO.into())
                .from_env_lossy(),
        )
        .try_init()
        .map_err(|err| eprintln!("failed to init tracing: {:?}", err))
        .ok();

    let backend_root_path = cx.argument::<JsString>(0)?.value(&mut cx);
    let app_path = cx.argument::<JsString>(1)?.value(&mut cx);
    let local_ai_mode = cx.argument::<JsBoolean>(2)?.value(&mut cx);
    let language_setting = cx.argument::<JsString>(3)?.value(&mut cx);
    let num_worker_threads = cx.argument_opt(4).and_then(|arg| {
        arg.downcast::<JsNumber, _>(&mut cx)
            .ok()
            .map(|n| n.value(&mut cx) as usize)
    });
    let num_processor_threads = cx.argument_opt(5).and_then(|arg| {
        arg.downcast::<JsNumber, _>(&mut cx)
            .ok()
            .map(|n| n.value(&mut cx) as usize)
    });
    let event_bus_rx_callback = cx.argument::<JsFunction>(6)?.root(&mut cx);

    match std::fs::create_dir_all(&backend_root_path) {
        Ok(_) => {}
        Err(e) => match e.kind() {
            std::io::ErrorKind::AlreadyExists => {}
            _ => {
                tracing::error!("failed to create backend root path: {:#?}", e);
                return cx.throw_error("failed to create backend root path");
            }
        },
    }
    let config = tunnel::TunnelConfig {
        backend_root_path,
        app_path,
        local_ai_mode,
        language_setting,
        num_worker_threads,
        num_processor_threads,
    };
    let tunnel = tunnel::WorkerTunnel::new(&mut cx, config, event_bus_rx_callback);

    tracing::info!("rust<->node tunnel bridge initialized");
    Ok(cx.boxed(tunnel))
}

fn js_set_surf_backend_health(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<tunnel::WorkerTunnel>>(0)?;
    let surf_backend_state = cx.argument::<JsBoolean>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::SetSurfBackendHealth(surf_backend_state)),
        deferred,
    );
    Ok(promise)
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
