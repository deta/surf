use neon::{
    prelude::Context,
    types::{Deferred, Finalize},
};
use std::sync::mpsc;

use super::{message::WorkerMessage, worker::worker_entry_point};
use crate::BackendResult;

pub enum TunnelOneshot {
    Javascript(Deferred),
    Rust(mpsc::Sender<BackendResult<String>>),
}
pub struct TunnelMessage(pub WorkerMessage, pub TunnelOneshot);

pub struct WorkerTunnel {
    pub tx: mpsc::Sender<TunnelMessage>,
}

impl WorkerTunnel {
    pub fn new<'a, C>(cx: &mut C, backend_root_path: String) -> Self
    where
        C: Context<'a>,
    {
        let (tx, rx) = mpsc::channel::<TunnelMessage>();
        let libuv_ch = cx.channel();
        std::thread::spawn(move || worker_entry_point(rx, libuv_ch, backend_root_path));
        Self { tx }
    }

    pub fn send_js(&self, message: WorkerMessage, deferred: Deferred) {
        self.tx
            .send(TunnelMessage(message, TunnelOneshot::Javascript(deferred)))
            .expect("unbound channel send failed")
    }

    pub fn send_rust(&self, message: WorkerMessage, oneshot: mpsc::Sender<BackendResult<String>>) {
        self.tx
            .send(TunnelMessage(message, TunnelOneshot::Rust(oneshot)))
            .expect("unbound channel send failed")
    }
}

impl Finalize for WorkerTunnel {}
