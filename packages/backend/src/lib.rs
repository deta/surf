#![allow(unused)]

mod models;
mod store;

use neon::{prelude::*, types::Deferred};
use std::sync::mpsc;
use std::thread;
use store::Store;

enum BackendMesasge {
    Print(String, Deferred),
}

struct Backend {
    tx: mpsc::Sender<BackendMesasge>,
}

impl Backend {
    fn new<'a, C>(cx: &mut C) -> Self
    where
        C: Context<'a>,
    {
        let (tx, rx) = mpsc::channel::<BackendMesasge>();
        let channel = cx.channel();

        thread::spawn(move || {
            while let Ok(message) = rx.recv() {
                match message {
                    BackendMesasge::Print(content, deferred) => {
                        println!("{}", content);
                        let result = "ok";

                        channel.send(move |mut cx| {
                            let result = cx.string(result);
                            deferred.resolve(&mut cx, result);
                            Ok(())
                        });
                    }
                }
            }
        });

        Self { tx }
    }

    fn send(&self, message: String, deferred: Deferred) {
        self.tx
            .send(BackendMesasge::Print(message, deferred))
            .expect("failed to send task");
    }
}

impl Finalize for Backend {}

fn init(mut cx: FunctionContext) -> JsResult<JsBox<Backend>> {
    let backend = Backend::new(&mut cx);
    Ok(cx.boxed(backend))
}

fn new_tmp_store(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let db_path_handle = cx.argument::<JsString>(0)?;
    let db_path = db_path_handle.value(&mut cx);
    Store::new(&db_path).unwrap();
    Ok(cx.undefined())
}

fn send(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let backend = cx.argument::<JsBox<Backend>>(0)?;
    let message = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    backend.send(message, deferred);

    Ok(promise)
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("init", init)?;
    cx.export_function("newTmpStore", new_tmp_store)?;
    cx.export_function("send", send)?;
    Ok(())
}
