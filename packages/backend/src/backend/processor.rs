use super::{message::*, tunnel::WorkerTunnel};
use crate::store::db::CompositeResource;

pub fn processor_thread_entry_point(tunnel: WorkerTunnel) {
    while let Ok(message) = tunnel.tqueue_rx.recv() {
        match message {
            ProcessorMessage::ProcessResource(resource) => {
                handle_process_resource(&tunnel, resource)
            }
        }
    }
}

fn handle_process_resource(tunnel: &WorkerTunnel, resource: CompositeResource) {
    let resource_data = std::fs::read_to_string(&resource.resource.resource_path).unwrap();

    let output = match resource.resource.resource_type.as_str() {
        "application/vnd.space.document.space-note" => {
            let mut output = String::new();
            let mut in_tag = false;

            for c in resource_data.chars() {
                match (in_tag, c) {
                    (true, '>') => in_tag = false,
                    (false, '<') => {
                        in_tag = true;
                        output.push(' ');
                    }
                    (false, _) => output.push(c),
                    _ => (),
                }
            }

            Some(output)
        }
        _ => None,
    };

    if let Some(output) = output {
        let output = output
            .chars()
            .take(256 * 3)
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");

        tunnel.worker_send_rust(
            WorkerMessage::ResourceMessage(ResourceMessage::UpsertResourceTextContent {
                resource_id: resource.resource.id,
                content: output,
            }),
            None,
        );
    }
}
