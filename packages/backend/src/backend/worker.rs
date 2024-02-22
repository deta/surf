use super::message::WorkerMessage;

use neon::prelude::*;
use std::sync::mpsc;

pub fn worker_entry_point(rx: mpsc::Receiver<WorkerMessage>, channel: Channel) {
    while let Ok(message) = rx.recv() {
        match message {
            WorkerMessage::Print(content, deferred) => {
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
}
