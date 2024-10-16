use super::{
    message::{AIMessage, ProcessorMessage, TunnelMessage, TunnelOneshot, WorkerMessage},
    processor::processor_thread_entry_point,
    worker::worker_thread_entry_point,
};
use crate::BackendResult;
use crossbeam_channel as crossbeam;
use neon::{
    handle::Root,
    prelude::Context,
    types::{Deferred, Finalize, JsFunction},
};
use std::sync::Arc;

#[derive(Clone)]
pub struct WorkerTunnel {
    pub worker_tx: crossbeam::Sender<TunnelMessage>,
    pub tqueue_rx: crossbeam::Receiver<ProcessorMessage>,
    pub aiqueue_rx: crossbeam::Receiver<AIMessage>,
    pub event_bus_rx_callback: Arc<Root<JsFunction>>,
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
        language_setting: String,
        event_bus_rx_callback: Root<JsFunction>,
    ) -> Self
    where
        C: Context<'a>,
    {
        let (worker_tx, worker_rx) = crossbeam::unbounded();
        let (tqueue_tx, tqueue_rx) = crossbeam::unbounded();
        let (aiqueue_tx, aiqueue_rx) = crossbeam::unbounded();
        let event_bus_rx_callback = Arc::new(event_bus_rx_callback);
        let tunnel = Self {
            worker_tx,
            tqueue_rx,
            aiqueue_rx,
            event_bus_rx_callback: event_bus_rx_callback.clone(),
        };

        // spawn N worker threads
        (0..8).for_each(|n| {
            let app_path_clone = app_path.clone();
            let backend_root_path_clone = backend_root_path.clone();

            let libuv_ch = neon::event::Channel::new(cx);
            let worker_rx_clone = worker_rx.clone();
            let tqueue_tx_clone = tqueue_tx.clone();
            let aiqueue_tx_clone = aiqueue_tx.clone();
            let openai_api_key_clone = openai_api_key.clone();
            let openai_api_endpoint_clone = openai_api_endpoint.clone();
            let language_setting_clone = language_setting.clone();
            let local_ai_mode_copy = local_ai_mode;
            let event_bus_rx_callback_clone = event_bus_rx_callback.clone();

            std::thread::Builder::new()
                .name(format!("W{n}"))
                .spawn(move || {
                    worker_thread_entry_point(
                        worker_rx_clone,
                        tqueue_tx_clone,
                        aiqueue_tx_clone,
                        libuv_ch,
                        event_bus_rx_callback_clone,
                        app_path_clone,
                        backend_root_path_clone,
                        openai_api_key_clone,
                        openai_api_endpoint_clone,
                        local_ai_mode_copy,
                        language_setting_clone,
                    )
                })
                .unwrap();
        });

        // TODO: the ytranscript library expects language to be `Some`.
        // Switch to another library and don't force the English language.
        let language = Some("en".to_owned());
        // spawn N processor threads
        (0..8).for_each(|n| {
            let tunnel_clone = tunnel.clone();
            let app_path_clone = app_path.clone();
            let language_clone = language.clone();
            let vision_api_key = vision_api_key.clone();
            let vision_api_endpoint = vision_api_endpoint.clone();
            std::thread::Builder::new()
                .name(format!("P{n}"))
                .spawn(move || {
                    processor_thread_entry_point(
                        tunnel_clone,
                        app_path_clone,
                        language_clone,
                        vision_api_key,
                        vision_api_endpoint,
                    );
                })
                .unwrap();
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
        oneshot: Option<crossbeam::Sender<BackendResult<String>>>,
    ) {
        let oneshot = oneshot.map(|oneshot| TunnelOneshot::Rust(oneshot));
        self.worker_tx
            .send(TunnelMessage(message, oneshot))
            .expect("unbound channel send failed on worker queue")
    }
}

impl Finalize for WorkerTunnel {}
