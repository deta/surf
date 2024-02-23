#![allow(unused)]

mod backend;
mod store;

use neon::prelude::*;
use serde_json::de;
use std::sync::mpsc;
use std::thread;

use backend::{message::WorkerMessage, worker::worker_entry_point};
use store::{db::Database, models::*};

struct WorkerTunnel {
    pub tx: mpsc::Sender<WorkerMessage>,
}

impl WorkerTunnel {
    fn new<'a, C>(cx: &mut C) -> Self
    where
        C: Context<'a>,
    {
        let (tx, rx) = mpsc::channel::<WorkerMessage>();
        let libuv_ch = cx.channel();
        thread::spawn(move || worker_entry_point(rx, libuv_ch));
        Self { tx }
    }
}

impl Finalize for WorkerTunnel {}

fn js_init(mut cx: FunctionContext) -> JsResult<JsBox<WorkerTunnel>> {
    let tunnel = WorkerTunnel::new(&mut cx);
    Ok(cx.boxed(tunnel))
}

fn js_create_resource(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_str = cx.argument::<JsString>(1)?.value(&mut cx);
    let (deferred, promise) = cx.promise();

    // TODO: not unwrap
    let resource: Resource = serde_json::from_str(&resource_str).unwrap();
    tunnel
        .tx
        .send(WorkerMessage::CreateResource(resource, deferred))
        .expect("unbound channel send failed");

    Ok(promise)
}

fn js_send(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let target = cx.argument::<JsString>(1)?.value(&mut cx);
    let string = cx.argument::<JsString>(2)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    let message = match target.as_str() {
        "print" => WorkerMessage::Print(string, deferred),
        "get_resource" => WorkerMessage::GetResource(string, deferred),
        _ => unreachable!(),
    };

    tunnel
        .tx
        .send(message)
        .expect("unbound channel send failed");

    Ok(promise)
}

fn js_new_tmp_store(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let db_path_handle = cx.argument::<JsString>(0)?;
    let db_path = db_path_handle.value(&mut cx);
    Database::new(&db_path).unwrap();
    Ok(cx.undefined())
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("init", js_init)?;
    cx.export_function("send", js_send)?;
    cx.export_function("newTmpStore", js_new_tmp_store)?;
    cx.export_function("createResource", js_create_resource)?;
    Ok(())
}
