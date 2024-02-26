use neon::{
    prelude::Context,
    types::{Deferred, Finalize},
};
use std::sync::mpsc;

use super::{message::WorkerMessage, worker::worker_entry_point};

pub struct TunnelMessage(pub WorkerMessage, pub Deferred);

pub struct WorkerTunnel {
    pub tx: mpsc::Sender<TunnelMessage>,
}

impl WorkerTunnel {
    pub fn new<'a, C>(cx: &mut C, resource_path: String) -> Self
    where
        C: Context<'a>,
    {
        let (tx, rx) = mpsc::channel::<TunnelMessage>();
        let libuv_ch = cx.channel();
        std::thread::spawn(move || worker_entry_point(rx, libuv_ch, resource_path));
        Self { tx }
    }

    pub fn send(&self, message: WorkerMessage, deferred: Deferred) {
        self.tx
            .send(TunnelMessage(message, deferred))
            .expect("unbound channel send failed")
    }
}

impl Finalize for WorkerTunnel {}
