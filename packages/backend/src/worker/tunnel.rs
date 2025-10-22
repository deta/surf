use super::{
    processor::processor_thread_entry_point, worker_thread_entry_point, AIConfig, ChannelConfig,
    PathConfig, WorkerConfig,
};
use crate::{
    api::message::{
        AIMessage, ProcessorMessage, ResourceMessage, TunnelMessage, TunnelOneshot, WorkerMessage,
    },
    BackendResult,
};
use crossbeam_channel as crossbeam;
use neon::{
    handle::Root,
    prelude::Context,
    types::{Deferred, Finalize, JsFunction},
};
use std::panic;

const NUM_WORKER_THREADS: usize = 12;
const NUM_PROCESSOR_THREADS: usize = 12;
use std::sync::{Arc, Condvar, Mutex};

#[derive(Clone)]
pub struct WorkerTunnel {
    pub worker_tx: crossbeam::Sender<TunnelMessage>,
    pub tqueue_rx: crossbeam::Receiver<ProcessorMessage>,
    pub aiqueue_rx: crossbeam::Receiver<AIMessage>,
    pub event_bus_rx_callback: Arc<Root<JsFunction>>,
    pub surf_backend_health: SurfBackendHealth,
}

pub struct SurfBackendHealth(Arc<(Mutex<bool>, Condvar)>);

impl SurfBackendHealth {
    pub fn new(initial_state: Option<bool>) -> Self {
        Self(Arc::new((
            Mutex::new(initial_state.unwrap_or_default()),
            Condvar::new(),
        )))
    }

    pub fn wait_until_healthy(&self) {
        let (lock, cvar) = &*self.0;
        let mut healthy = lock.lock().unwrap();
        if *healthy {
            return;
        }
        while !*healthy {
            tracing::warn!("surf-backend server isn't healthy, sleeping the processor thread");
            healthy = cvar.wait(healthy).unwrap();
        }
        tracing::info!("surf-backend server is healthy again, resuming processor thread");
    }

    pub fn set_health(&self, healthy: bool) {
        let (lock, cvar) = &*self.0;
        let mut status = lock.lock().unwrap();
        *status = healthy;
        if healthy {
            cvar.notify_all();
        }
    }
}

impl Clone for SurfBackendHealth {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

#[derive(Clone, Debug)]
pub struct TunnelConfig {
    pub backend_root_path: String,
    pub app_path: String,
    pub local_ai_mode: bool,
    pub language_setting: String,
    pub num_worker_threads: Option<usize>,
    pub num_processor_threads: Option<usize>,
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
        let surf_backend_health = SurfBackendHealth::new(Some(false));
        let event_bus_rx_callback = Arc::new(event_bus_rx_callback);
        let tunnel = Self {
            worker_tx,
            tqueue_rx,
            aiqueue_rx,
            event_bus_rx_callback: event_bus_rx_callback.clone(),
            surf_backend_health: surf_backend_health.clone(),
        };

        Self::spawn_threads(cx, config, worker_rx, tqueue_tx, aiqueue_tx, &tunnel);

        tunnel.initiate_worker_startup_jobs();
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
            tunnel.surf_backend_health.clone(),
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
        surf_backend_health: SurfBackendHealth,
    ) where
        C: Context<'a>,
    {
        let mut run_migrations: i32 = 1;
        let libuv_ch = neon::event::Channel::new(cx);

        let num_worker_threads = config.num_worker_threads.unwrap_or(NUM_WORKER_THREADS);
        for n in 0..num_worker_threads {
            let worker_rx = worker_rx.clone();
            let tqueue_tx = tqueue_tx.clone();
            let aiqueue_tx = aiqueue_tx.clone();
            let callback = Arc::clone(&event_bus_rx_callback);
            let surf_backend_health = surf_backend_health.clone();
            let libuv_ch = libuv_ch.clone();
            let thread_name = format!("W{n}");

            let _run_migrations = run_migrations > 0;
            run_migrations = run_migrations.saturating_sub(1);

            let app_path = config.app_path.clone();
            let backend_root_path = config.backend_root_path.clone();
            let local_ai_mode = config.local_ai_mode;
            let language_setting = config.language_setting.clone();

            std::thread::Builder::new()
            .name(thread_name.clone())
            .spawn(move || loop {
                let result = panic::catch_unwind(panic::AssertUnwindSafe(|| {
                    let path_config = PathConfig::new(
                        app_path.clone(),
                        backend_root_path.clone(),
                    );

                    let ai_config = AIConfig::new(
                        local_ai_mode,
                    );

                    let channel_config = ChannelConfig {
                        tqueue_tx: tqueue_tx.clone(),
                        aiqueue_tx: aiqueue_tx.clone(),
                        channel: libuv_ch.clone(),
                        event_bus_rx: callback.clone(),
                    };

                    let worker_config = WorkerConfig {
                        path_config,
                        ai_config,
                        channel_config,
                        language_setting: language_setting.clone(),
                        run_migrations: _run_migrations,
                        surf_backend_health: surf_backend_health.clone(),
                    };

                    worker_thread_entry_point(worker_rx.clone(), worker_config)
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
        let num_processor_threads = config
            .num_processor_threads
            .unwrap_or(NUM_PROCESSOR_THREADS);

        for n in 0..num_processor_threads {
            let tunnel = tunnel.clone();
            let config = config.clone();
            let language = language.clone();
            let thread_name = format!("P{n}");

            std::thread::Builder::new()
                .name(thread_name.clone())
                .spawn(move || loop {
                    let result = panic::catch_unwind(panic::AssertUnwindSafe(|| {
                        processor_thread_entry_point(
                            tunnel.clone(),
                            config.app_path.clone(),
                            language.clone(),
                        )
                    }));

                    if let Err(e) = result {
                        tracing::error!(thread=%thread_name, "processor thread panicked: {:?}, restarting", e);
                    }
                })
                .expect("failed to spawn processor thread");
        }
    }

    fn initiate_worker_startup_jobs(&self) {
        let (tx, rx) = crossbeam_channel::bounded(1);

        self.worker_send_rust(
            WorkerMessage::ResourceMessage(ResourceMessage::FailActivePostProcessingJobs),
            Some(tx),
        );

        rx.recv()
            .map_err(|e| tracing::error!("failed to initiate worker jobs: {e}"))
            .ok();
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
            .send(TunnelMessage(message, oneshot.map(TunnelOneshot::Rust)))
            .expect("unbound channel send failed on worker queue");
    }
}
