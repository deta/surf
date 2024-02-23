pub mod db;
pub mod models;

use crate::backend::{message::WorkerMessage, tunnel::WorkerTunnel};
use neon::prelude::*;

const _MODULE_PREFIX: &'static str = "store";

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    cx.export_function("js__store_read_resource", js_read_resource)?;
    cx.export_function("js__store_create_resource", js_create_resource)?;

    Ok(())
}

fn js_create_resource(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_str = cx.argument::<JsString>(1)?.value(&mut cx);

    let resource: models::Resource = match serde_json::from_str(&resource_str) {
        Ok(resource) => resource,
        Err(err) => cx.throw_error(format!(
            "failed to deserialize resource: {}",
            err.to_string()
        ))?,
    };
    let (deferred, promise) = cx.promise();
    tunnel
        .tx
        .send(WorkerMessage::CreateResource(resource, deferred))
        .expect("unbound channel send failed");

    Ok(promise)
}

fn js_read_resource(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel
        .tx
        .send(WorkerMessage::GetResource(resource_id, deferred))
        .expect("unbound channel send failed");

    Ok(promise)
}
