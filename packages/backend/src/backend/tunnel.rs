use crossbeam_channel as crossbeam;
use neon::{
    prelude::Context,
    types::{Deferred, Finalize},
};
use std::sync::mpsc;

use super::{
    ai::ai_thread_entry_point,
    message::{AIMessage, ProcessorMessage, TunnelMessage, TunnelOneshot, WorkerMessage},
    processor::processor_thread_entry_point,
    worker::worker_thread_entry_point,
};
use crate::BackendResult;

#[derive(Clone)]
pub struct WorkerTunnel {
    pub worker_tx: mpsc::Sender<TunnelMessage>,
    pub tqueue_rx: crossbeam::Receiver<ProcessorMessage>,
    pub aiqueue_rx: crossbeam::Receiver<AIMessage>,
}

impl WorkerTunnel {
    pub fn new<'a, C>(cx: &mut C, backend_root_path: String) -> Self
    where
        C: Context<'a>,
    {
        let (worker_tx, worker_rx) = mpsc::channel::<TunnelMessage>();
        let (tqueue_tx, tqueue_rx) = crossbeam::unbounded();
        let (aiqueue_tx, aiqueue_rx) = crossbeam::unbounded();
        let libuv_ch = cx.channel();
        let tunnel = Self {
            worker_tx,
            tqueue_rx,
            aiqueue_rx,
        };

        // spawn the main SFFS thread
        std::thread::spawn(move || {
            worker_thread_entry_point(
                worker_rx,
                tqueue_tx,
                aiqueue_tx,
                libuv_ch,
                backend_root_path,
            )
        });

        // spawn N worker threads
        (0..8).for_each(|_| {
            let tunnel_clone = tunnel.clone();
            std::thread::spawn(move || {
                processor_thread_entry_point(tunnel_clone);
            });
        });

        // spawn AI threads
        (0..2).for_each(|_| {
            let tunnel_clone = tunnel.clone();
            std::thread::spawn(move || {
                ai_thread_entry_point(tunnel_clone);
            });
        });

        tunnel
    }

    pub fn worker_send_js(&self, message: WorkerMessage, deferred: Deferred) {
        self.worker_tx
            .send(TunnelMessage(
                message,
                Some(TunnelOneshot::Javascript(deferred)),
            ))
            .expect("unbound channel send failed")
    }

    pub fn worker_send_rust(
        &self,
        message: WorkerMessage,
        oneshot: Option<mpsc::Sender<BackendResult<String>>>,
    ) {
        let oneshot = oneshot.map(|oneshot| TunnelOneshot::Rust(oneshot));
        self.worker_tx
            .send(TunnelMessage(message, oneshot))
            .expect("unbound channel send failed")
    }
}

impl Finalize for WorkerTunnel {}
