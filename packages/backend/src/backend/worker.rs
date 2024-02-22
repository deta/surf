use super::message::WorkerMessage;
use crate::store::Store;

use neon::prelude::*;
use std::sync::mpsc;

struct Worker {
    store: Store,
}

impl Worker {
    fn new() -> Self {
        Self {
            // TODO: proper error-handling at project level
            store: Store::new("./database.sqlite").unwrap(),
        }
    }

    // This is simply an example task that the worker is able
    // to handle. It accepts a string to print out to `stdout`
    // and returns back a string to the Javascript world.
    pub fn print_job(&mut self, content: String) -> String {
        println!("print_job: {}", content);
        return String::from("ok");
    }
}

pub fn worker_entry_point(rx: mpsc::Receiver<WorkerMessage>, channel: Channel) {
    let mut worker = Worker::new();

    while let Ok(message) = rx.recv() {
        match message {
            WorkerMessage::Print(content, deferred) => {
                // let the worker execute the print job
                // and then resolve the deferred promise
                // to the output of the task.
                let result = worker.print_job(content);
                channel.send(move |mut cx| {
                    let result = cx.string(result);
                    deferred.resolve(&mut cx, result);
                    Ok(())
                });
            }
        }
    }
}
