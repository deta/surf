use neon::{prelude::Context, types::Finalize};
use std::sync::mpsc;

use super::{message::WorkerMessage, worker::worker_entry_point};

pub struct WorkerTunnel {
    pub tx: mpsc::Sender<WorkerMessage>,
}

impl WorkerTunnel {
    pub fn new<'a, C>(cx: &mut C) -> Self
    where
        C: Context<'a>,
    {
        let (tx, rx) = mpsc::channel::<WorkerMessage>();
        let libuv_ch = cx.channel();
        std::thread::spawn(move || worker_entry_point(rx, libuv_ch));
        Self { tx }
    }
}

impl Finalize for WorkerTunnel {}
