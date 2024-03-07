use crate::{
    backend::{
        message::MiscMessage,
        worker::{send_worker_response, Worker},
    },
    BackendResult,
};
use neon::{prelude::Channel, types::Deferred};

impl Worker {
    pub fn print(&mut self, content: String) -> BackendResult<String> {
        println!("print: {}", content);
        Ok("ok".to_owned())
    }
}

pub fn handle_misc_message(
    worker: &mut Worker,
    channel: &mut Channel,
    deferred: Deferred,
    message: MiscMessage,
) {
    match message {
        MiscMessage::Print(content) => {
            send_worker_response(channel, deferred, worker.print(content))
        }
    }
}
