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
use std::{panic, sync::{atomic::AtomicBool, Arc}};

const NUM_WORKER_THREADS: usize = 8;
const NUM_PROCESSOR_THREADS: usize = 8;

#[derive(Clone)]
pub struct WorkerTunnel {
    pub worker_tx: crossbeam::Sender<TunnelMessage>,
    pub tqueue_rx: crossbeam::Receiver<ProcessorMessage>,
    pub aiqueue_rx: crossbeam::Receiver<AIMessage>,
    pub event_bus_rx_callback: Arc<Root<JsFunction>>,
}

#[derive(Clone, Debug)]
pub struct TunnelConfig {
    pub backend_root_path: String,
    pub app_path: String,
    pub api_base: String,
    pub api_key: String,
    pub local_ai_mode: bool,
    pub language_setting: String,
}

impl Finalize for WorkerTunnel {}

impl WorkerTunnel {
    pub fn new<'a, C>(
        cx: &mut C,
        config: TunnelConfig,
        event_bus_rx_callback: Root<JsFunction>,
    ) -> Self
    where
        C: Context<'a>,
    {
        let (worker_tx, worker_rx) = crossbeam::unbounded();
        let (tqueue_tx, tqueue_rx) = crossbeam::unbounded();
        let (aiqueue_tx, aiqueue_rx) = crossbeam::unbounded();

        let tunnel = Self {
            worker_tx,
            tqueue_rx,
            aiqueue_rx,
            event_bus_rx_callback: Arc::new(event_bus_rx_callback),
        };

        Self::spawn_threads(cx, config, worker_rx, tqueue_tx, aiqueue_tx, &tunnel);
        tunnel
    }

    fn spawn_threads<'a, C>(
        cx: &mut C,
        config: TunnelConfig,
        worker_rx: crossbeam::Receiver<TunnelMessage>,
        tqueue_tx: crossbeam::Sender<ProcessorMessage>,
        aiqueue_tx: crossbeam::Sender<AIMessage>,
        tunnel: &WorkerTunnel,
    ) where
        C: Context<'a>,
    {
        Self::spawn_worker_threads(
            cx,
            &config,
            worker_rx,
            tqueue_tx,
            aiqueue_tx,
            Arc::clone(&tunnel.event_bus_rx_callback),
        );
        Self::spawn_processor_threads(tunnel, &config);
    }

    fn spawn_worker_threads<'a, C>(
        cx: &mut C,
        config: &TunnelConfig,
        worker_rx: crossbeam::Receiver<TunnelMessage>,
        tqueue_tx: crossbeam::Sender<ProcessorMessage>,
        aiqueue_tx: crossbeam::Sender<AIMessage>,
        event_bus_rx_callback: Arc<Root<JsFunction>>,
    ) where
        C: Context<'a>,
    {
        for n in 0..NUM_WORKER_THREADS {
            let config = config.clone();
            let worker_rx = worker_rx.clone();
            let tqueue_tx = tqueue_tx.clone();
            let aiqueue_tx = aiqueue_tx.clone();
            let callback = Arc::clone(&event_bus_rx_callback);
            let libuv_ch = neon::event::Channel::new(cx);
            let thread_name = format!("W{n}");

            std::thread::Builder::new()
                .name(thread_name.clone())
                .spawn(move || loop {
                    let result = panic::catch_unwind(panic::AssertUnwindSafe(|| {
                        worker_thread_entry_point(
                            worker_rx.clone(),
                            tqueue_tx.clone(),
                            aiqueue_tx.clone(),
                            libuv_ch.clone(),
                            callback.clone(),
                            config.app_path.clone(),
                            config.backend_root_path.clone(),
                            config.api_base.clone(),
                            config.api_key.clone(),
                            config.local_ai_mode,
                            config.language_setting.clone(),
                        )
                    }));

                    if let Err(e) = result {
                        tracing::error!(thread=%thread_name, "worker thread panicked: {:?}, restarting", e);
                    }
                })
                .expect("failed to spawn worker thread");
        }
    }

    fn spawn_processor_threads(tunnel: &WorkerTunnel, config: &TunnelConfig) {
        let language = Some(config.language_setting.clone()).filter(|lang| lang == "en");

        for n in 0..NUM_PROCESSOR_THREADS {
            let tunnel = tunnel.clone();
            let config = config.clone();
            let language = language.clone();
            let thread_name = format!("P{n}");
            let vision_tagging_flag = Arc::new(AtomicBool::new(false));

            std::thread::Builder::new()
                .name(thread_name.clone())
                .spawn(move || loop {
                    let vision_tagging_flag = vision_tagging_flag.clone();
                    let result = panic::catch_unwind(panic::AssertUnwindSafe(|| {
                        processor_thread_entry_point(
                            tunnel.clone(),
                            config.app_path.clone(),
                            language.clone(),
                            config.api_key.clone(),
                            config.api_base.clone(),
                            vision_tagging_flag,
                        )
                    }));

                    if let Err(e) = result {
                        tracing::error!(thread=%thread_name, "processor thread panicked: {:?}, restarting", e);
                    }
                })
                .expect("failed to spawn processor thread");
        }
    }

    pub fn worker_send_js(&self, message: WorkerMessage, deferred: Deferred) {
        self.worker_tx
            .send(TunnelMessage(
                message,
                Some(TunnelOneshot::Javascript(deferred)),
            ))
            .expect("unbound channel send failed");
    }

    pub fn worker_send_rust(
        &self,
        message: WorkerMessage,
        oneshot: Option<crossbeam::Sender<BackendResult<String>>>,
    ) {
        self.worker_tx
            .send(TunnelMessage(
                message,
                oneshot.map(|oneshot| TunnelOneshot::Rust(oneshot)),
            ))
            .expect("unbound channel send failed on worker queue");
    }
}
