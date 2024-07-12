pub mod ai;

use crate::backend::{message::*, tunnel::WorkerTunnel};
use neon::prelude::*;

const _MODULE_PREFIX: &'static str = "ai";

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    cx.export_function("js__ai_send_chat_message", js_send_chat_message)?;
    cx.export_function("js__ai_create_app", js_create_app)?;
    cx.export_function("js__ai_query_sffs_resources", js_query_sffs_resources)?;
    cx.export_function("js__ai_get_chat_data_source", js_get_ai_chat_data_source)?;
    cx.export_function("js__ai_get_docs_similarity", js_get_ai_docs_similarity)?;
    cx.export_function("js__ai_get_youtube_transcript", js_get_youtube_transcript)?;
    Ok(())
}

fn js_get_ai_chat_data_source(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let source_hash = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::GetAIChatDataSource(source_hash)),
        deferred,
    );

    Ok(promise)
}

fn js_get_ai_docs_similarity(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let query = cx.argument::<JsString>(1)?.value(&mut cx);
    let docs = cx.argument::<JsArray>(2)?.to_vec(&mut cx)?;
    let docs = docs
        .iter()
        .map(|value| {
            Ok(value
                .downcast_or_throw::<JsString, FunctionContext>(&mut cx)?
                .value(&mut cx))
        })
        .collect::<NeonResult<Vec<String>>>()?;

    let threshold = cx.argument_opt(3).and_then(|arg| {
        arg.downcast::<JsNumber, FunctionContext>(&mut cx)
            .ok()
            .map(|js_number| js_number.value(&mut cx) as f32)
    });

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::GetAIDocsSimilarity {
            query,
            docs,
            threshold,
        }),
        deferred,
    );

    Ok(promise)
}

fn js_query_sffs_resources(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let prompt = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::QuerySFFSResources(prompt)),
        deferred,
    );

    Ok(promise)
}

fn js_get_youtube_transcript(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let video_url = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::GetYoutubeTranscript(video_url)),
        deferred,
    );

    Ok(promise)
}

fn js_create_app(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let prompt = cx.argument::<JsString>(1)?.value(&mut cx);
    let session_id = cx.argument::<JsString>(2)?.value(&mut cx);
    let contexts = match cx.argument_opt(3).filter(|arg| {
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
        WorkerMessage::MiscMessage(MiscMessage::CreateApp {
            prompt,
            session_id,
            contexts,
        }),
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
    let rag_only = cx.argument::<JsBoolean>(6)?.value(&mut cx);
    let api_endpoint = cx
        .argument_opt(7)
        .and_then(|arg| arg.downcast::<JsString, FunctionContext>(&mut cx).ok())
        .map(|api_endpoint| api_endpoint.value(&mut cx));
    let resource_ids = match cx.argument_opt(8).filter(|arg| {
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
            rag_only,
            api_endpoint,
            resource_ids,
        }),
        deferred,
    );

    Ok(promise)
}
