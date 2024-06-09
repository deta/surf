pub mod ai;

use crate::backend::{message::*, tunnel::WorkerTunnel};
use neon::prelude::*;

const _MODULE_PREFIX: &'static str = "ai";

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    cx.export_function("js__ai_send_chat_message", js_send_chat_message)?;
    cx.export_function("js__ai_generate_space_sql", js_generate_space_sql)?;

    Ok(())
}

fn js_generate_space_sql(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let prompt = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::GenerateSpaceQuerySql(prompt)),
        deferred,
    );

    Ok(promise)
}

fn js_send_chat_message(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let query = cx.argument::<JsString>(1)?.value(&mut cx);
    let session_id = cx.argument::<JsString>(2)?.value(&mut cx);
    let callback = cx.argument::<JsFunction>(3)?.root(&mut cx);
    let number_documents = cx.argument::<JsNumber>(4)?.value(&mut cx) as i32;
    let model = cx.argument::<JsString>(5)?.value(&mut cx);
    let resource_ids = match cx.argument_opt(6).filter(|arg| {
        !(arg.is_a::<JsUndefined, FunctionContext>(&mut cx)
            || arg.is_a::<JsNull, FunctionContext>(&mut cx))
    }) {
        Some(arg) => Some(
            arg.downcast_or_throw::<JsArray, FunctionContext>(&mut cx)?
                .to_vec(&mut cx)?
                .iter()
                .map(|value| {
                    value
                        .downcast_or_throw::<JsString, FunctionContext>(&mut cx)
                        .map(|js_str| js_str.value(&mut cx))
                })
                .collect::<NeonResult<Vec<String>>>()?,
        ),
        None => None,
    };

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::ChatQuery {
            query,
            session_id,
            number_documents,
            model,
            callback,
            resource_ids,
        }),
        deferred,
    );

    Ok(promise)
}
