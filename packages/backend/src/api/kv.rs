use crate::worker::tunnel;
use neon::prelude::*;

use super::message::{KVStoreMessage, WorkerMessage};

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    cx.export_function("js__kv_create_table", js_kv_create_table)?;
    cx.export_function("js__kv_list", js_kv_list)?;
    cx.export_function("js__kv_get", js_kv_get)?;
    cx.export_function("js__kv_put", js_kv_put)?;
    cx.export_function("js__kv_delete", js_kv_delete)?;
    cx.export_function("js__kv_update", js_kv_update)?;
    Ok(())
}

fn js_kv_create_table(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<tunnel::WorkerTunnel>>(0)?;
    let table_name = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::KVStoreMessage(KVStoreMessage::CreateTable(table_name)),
        deferred,
    );
    Ok(promise)
}

fn js_kv_list(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<tunnel::WorkerTunnel>>(0)?;
    let table_name = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::KVStoreMessage(KVStoreMessage::List(table_name)),
        deferred,
    );
    Ok(promise)
}

fn js_kv_get(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<tunnel::WorkerTunnel>>(0)?;
    let table_name = cx.argument::<JsString>(1)?.value(&mut cx);
    let key = cx.argument::<JsString>(2)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::KVStoreMessage(KVStoreMessage::Get(table_name, key)),
        deferred,
    );
    Ok(promise)
}

fn js_kv_put(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<tunnel::WorkerTunnel>>(0)?;
    let table_name = cx.argument::<JsString>(1)?.value(&mut cx);
    let key = cx.argument::<JsString>(2)?.value(&mut cx);
    let value = cx.argument::<JsString>(3)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::KVStoreMessage(KVStoreMessage::Put(table_name, key, value)),
        deferred,
    );
    Ok(promise)
}

fn js_kv_delete(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<tunnel::WorkerTunnel>>(0)?;
    let table_name = cx.argument::<JsString>(1)?.value(&mut cx);
    let key = cx.argument::<JsString>(2)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::KVStoreMessage(KVStoreMessage::Delete(table_name, key)),
        deferred,
    );
    Ok(promise)
}

fn js_kv_update(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<tunnel::WorkerTunnel>>(0)?;
    let table_name = cx.argument::<JsString>(1)?.value(&mut cx);
    let key = cx.argument::<JsString>(2)?.value(&mut cx);
    let changes = cx.argument::<JsString>(3)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::KVStoreMessage(KVStoreMessage::Update(table_name, key, changes)),
        deferred,
    );
    Ok(promise)
}
