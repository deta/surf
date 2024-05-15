pub mod ai;

use crate::backend::{message::*, tunnel::WorkerTunnel};
use neon::prelude::*;

const _MODULE_PREFIX: &'static str = "ai";

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    cx.export_function("js__ai_send_chat_message", js_send_chat_message)?;

    Ok(())
}

fn js_send_chat_message(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let query = cx.argument::<JsString>(1)?.value(&mut cx);
    let session_id = cx.argument::<JsString>(2)?.value(&mut cx);
    let number_documents = cx.argument::<JsNumber>(3)?.value(&mut cx) as i32;
    let model = cx.argument::<JsString>(4)?.value(&mut cx);
    let callback = cx.argument::<JsFunction>(5)?.root(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::ChatQuery {
            query,
            session_id,
            number_documents,
            model,
            callback,
        }),
        deferred,
    );

    Ok(promise)
}
