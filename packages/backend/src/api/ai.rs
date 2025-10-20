use crate::{
    ai::llm::{client::Model, models::Message},
    api::message::*,
    worker::tunnel::WorkerTunnel,
};
use neon::prelude::*;
use serde::{Deserialize, Serialize};

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    cx.export_function("js__ai_create_chat_completion", js_create_chat_completion)?;
    cx.export_function("js__ai_send_chat_message", js_send_chat_message)?;
    cx.export_function("js__ai_send_note_message", js_send_note_message)?;
    cx.export_function("js__ai_create_app", js_create_app)?;
    cx.export_function("js__ai_query_sffs_resources", js_query_sffs_resources)?;
    cx.export_function("js__ai_get_chat_data_source", js_get_ai_chat_data_source)?;
    cx.export_function("js__ai_get_docs_similarity", js_get_ai_docs_similarity)?;
    cx.export_function("js__ai_get_youtube_transcript", js_get_youtube_transcript)?;
    cx.export_function("js__ai_search_chat_resources", js_search_chat_resources)?;
    Ok(())
}

fn js_get_ai_chat_data_source(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let source_uid = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::GetAIChatDataSource(source_uid)),
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

fn js_query_sffs_resources(mut cx: FunctionContext) -> JsResult<JsPromise> {
    #[derive(Serialize, Deserialize, Debug)]
    struct QueryResourcesOptions {
        pub query: String,
        pub model: Model,
        pub custom_key: Option<String>,
        pub sql_query: Option<String>,
        pub embedding_query: Option<String>,
        pub embedding_distance_threshold: Option<f32>,
    }

    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let json_opt = cx.argument::<JsString>(1)?.value(&mut cx);
    let mut opts: QueryResourcesOptions = match serde_json::from_str(&json_opt) {
        Ok(opts) => opts,
        Err(err) => return cx.throw_error(format!("failed to parse options: {err}")),
    };
    opts.custom_key = opts.custom_key.filter(|k| !k.is_empty());

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::QuerySFFSResources(
            opts.query,
            opts.model,
            opts.custom_key,
            opts.sql_query,
            opts.embedding_query,
            opts.embedding_distance_threshold,
        )),
        deferred,
    );

    Ok(promise)
}

fn js_create_app(mut cx: FunctionContext) -> JsResult<JsPromise> {
    #[derive(Serialize, Deserialize, Debug)]
    struct CreateAppOptions {
        pub query: String,
        pub model: Model,
        pub custom_key: Option<String>,
        pub inline_images: Option<Vec<String>>,
    }

    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let json_opt = cx.argument::<JsString>(1)?.value(&mut cx);
    let mut opts: CreateAppOptions = match serde_json::from_str(&json_opt) {
        Ok(opts) => opts,
        Err(err) => return cx.throw_error(format!("failed to parse options: {err}")),
    };
    opts.custom_key = opts.custom_key.filter(|k| !k.is_empty());

    let chunk_callback = cx.argument::<JsFunction>(2)?.root(&mut cx);
    let done_callback = cx.argument::<JsFunction>(3)?.root(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::CreateAppQuery {
            chunk_callback,
            done_callback,
            query: opts.query,
            model: opts.model,
            custom_key: opts.custom_key,
            inline_images: opts.inline_images,
        }),
        deferred,
    );
    Ok(promise)
}

fn js_create_chat_completion(mut cx: FunctionContext) -> JsResult<JsPromise> {
    #[derive(Serialize, Deserialize, Debug)]
    struct Options {
        messages: Vec<Message>,
        model: Model,
        custom_key: Option<String>,
        response_format: Option<String>,
    }

    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let json_opt = cx.argument::<JsString>(1)?.value(&mut cx);
    let mut opts: Options = match serde_json::from_str(&json_opt) {
        Ok(opts) => opts,
        Err(err) => return cx.throw_error(format!("failed to parse options: {err}")),
    };
    opts.custom_key = opts.custom_key.filter(|k| !k.is_empty());

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::CreateChatCompletion {
            messages: opts.messages,
            model: opts.model,
            custom_key: opts.custom_key,
            response_format: opts.response_format,
        }),
        deferred,
    );

    Ok(promise)
}

fn js_send_note_message(mut cx: FunctionContext) -> JsResult<JsPromise> {
    fn default_limit() -> i32 {
        20
    }
    // TODO: why separate struct from ChatInput?
    #[derive(Serialize, Deserialize, Debug)]
    struct NoteMessageOptions {
        pub query: String,
        pub note_resource_id: String,
        pub model: Model,
        pub custom_key: Option<String>,
        pub resource_ids: Option<Vec<String>>,
        pub inline_images: Option<Vec<String>>,
        #[serde(default = "default_limit")]
        pub limit: i32,
        #[serde(default)]
        pub general: bool,
        #[serde(default)]
        pub websearch: bool,
        #[serde(default)]
        pub surflet: bool,
    }

    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let json_opt = cx.argument::<JsString>(1)?.value(&mut cx);
    let callback = cx.argument::<JsFunction>(2)?.root(&mut cx);
    let mut opts: NoteMessageOptions = match serde_json::from_str(&json_opt) {
        Ok(opts) => opts,
        Err(err) => return cx.throw_error(format!("failed to parse options: {err}")),
    };
    opts.custom_key = opts.custom_key.filter(|k| !k.is_empty());

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::NoteQuery {
            callback,
            query: opts.query,
            note_resource_id: opts.note_resource_id,
            model: opts.model,
            custom_key: opts.custom_key,
            resource_ids: opts.resource_ids.unwrap_or_default(),
            inline_images: opts.inline_images,
            number_documents: opts.limit,
            general: opts.general,
            websearch: opts.websearch,
            surflet: opts.surflet,
        }),
        deferred,
    );

    Ok(promise)
}

fn js_send_chat_message(mut cx: FunctionContext) -> JsResult<JsPromise> {
    fn default_limit() -> i32 {
        20
    }
    // TODO: why separate struct from ChatInput?
    #[derive(Serialize, Deserialize, Debug)]
    struct ChatMessageOptions {
        pub query: String,
        pub chat_id: String,
        pub model: Model,
        pub custom_key: Option<String>,
        pub resource_ids: Option<Vec<String>>,
        pub inline_images: Option<Vec<String>>,
        #[serde(default = "default_limit")]
        pub limit: i32,
        #[serde(default)]
        pub rag_only: bool,
        #[serde(default)]
        pub general: bool,
        #[serde(default)]
        pub app_creation: bool,
    }

    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let json_opt = cx.argument::<JsString>(1)?.value(&mut cx);
    let callback = cx.argument::<JsFunction>(2)?.root(&mut cx);
    let mut opts: ChatMessageOptions = match serde_json::from_str(&json_opt) {
        Ok(opts) => opts,
        Err(err) => return cx.throw_error(format!("failed to parse options: {err}")),
    };
    opts.custom_key = opts.custom_key.filter(|k| !k.is_empty());

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::ChatQuery {
            callback,
            query: opts.query,
            session_id: opts.chat_id,
            model: opts.model,
            custom_key: opts.custom_key,
            resource_ids: opts.resource_ids.unwrap_or_default(),
            inline_images: opts.inline_images,
            number_documents: opts.limit,
            search_only: opts.rag_only,
            general: opts.general,
            app_creation: opts.app_creation,
        }),
        deferred,
    );

    Ok(promise)
}

fn js_search_chat_resources(mut cx: FunctionContext) -> JsResult<JsPromise> {
    fn default_limit() -> i32 {
        20
    }

    #[derive(Serialize, Deserialize, Debug)]
    struct SearchResourcesOptions {
        pub query: String,
        pub model: Model,
        pub custom_key: Option<String>,
        #[serde(default = "default_limit")]
        pub number_documents: i32,
        pub resource_ids: Option<Vec<String>>,
    }

    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let json_opt = cx.argument::<JsString>(1)?.value(&mut cx);
    let mut opts: SearchResourcesOptions = match serde_json::from_str(&json_opt) {
        Ok(opts) => opts,
        Err(err) => return cx.throw_error(format!("failed to parse options: {err}")),
    };
    opts.custom_key = opts.custom_key.filter(|k| !k.is_empty());

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::SearchChatResources {
            query: opts.query,
            model: opts.model,
            custom_key: opts.custom_key,
            number_documents: opts.number_documents,
            resource_ids: opts.resource_ids,
        }),
        deferred,
    );

    Ok(promise)
}
