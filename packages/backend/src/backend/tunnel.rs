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
    pub fn new<'a, C>(
        cx: &mut C,
        backend_root_path: String,
        app_path: String,
        vision_api_key: String,
        vision_api_endpoint: String,
        openai_api_key: String,
        openai_api_endpoint: String,
        local_ai_mode: bool,
    ) -> Self
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
        let app_path_clone = app_path.clone();
        let openai_api_key_clone = openai_api_key.clone();
        std::thread::spawn(move || {
            worker_thread_entry_point(
                worker_rx,
                tqueue_tx,
                aiqueue_tx,
                libuv_ch,
                app_path_clone,
                backend_root_path,
                openai_api_key_clone,
                openai_api_endpoint,
                local_ai_mode,
            )
        });

        // spawn N worker threads
        (0..8).for_each(|_| {
            let tunnel_clone = tunnel.clone();
            let app_path_clone = app_path.clone();
            std::thread::spawn(move || {
                processor_thread_entry_point(tunnel_clone, app_path_clone);
            });
        });

        // spawn AI threads
        (0..2).for_each(|_| {
            let tunnel_clone = tunnel.clone();
            let vision_api_key = vision_api_key.clone();
            let vision_api_endpoint = vision_api_endpoint.clone();
            std::thread::spawn(move || {
                ai_thread_entry_point(tunnel_clone, vision_api_key, vision_api_endpoint);
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
            .expect("unbound channel send failed on worker queue")
    }
}

impl Finalize for WorkerTunnel {}
