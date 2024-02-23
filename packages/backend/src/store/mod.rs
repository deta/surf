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

    let resource_type = cx.argument::<JsString>(1)?.value(&mut cx);
    let resource_tags_json = cx
        .argument_opt(2)
        .and_then(|arg| arg.downcast::<JsString, FunctionContext>(&mut cx).ok())
        .map(|js_string| js_string.value(&mut cx));
    let resource_metadata_json = cx
        .argument_opt(3)
        .and_then(|arg| arg.downcast::<JsString, FunctionContext>(&mut cx).ok())
        .map(|js_string| js_string.value(&mut cx));

    let resource_tags: Option<Vec<models::ResourceTag>> =
        resource_tags_json.and_then(|json_str| serde_json::from_str(&json_str).ok());
    let resource_metadata: Option<models::ResourceMetadata> =
        resource_metadata_json.and_then(|json_str| serde_json::from_str(&json_str).ok());

    let (deferred, promise) = cx.promise();
    tunnel
        .tx
        .send(WorkerMessage::CreateResource {
            resource_type,
            resource_tags,
            resource_metadata,
            deferred,
        })
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
