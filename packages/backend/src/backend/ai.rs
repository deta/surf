use super::{message::*, tunnel::WorkerTunnel};
use crate::{
    store::{
        db::CompositeResource,
        models::{self, ResourceTextContentMetadata},
    },
    vision::vision::Vision,
    BackendResult,
};

// TODO: use a single AI struct/abstraction in the codebase
pub struct AI {
    pub vision: Vision,
}

impl AI {
    pub fn new(vision_api_key: &str, vision_api_endpoint: &str) -> Self {
        Self {
            vision: Vision::new(vision_api_key.to_string(), vision_api_endpoint.to_string()),
        }
    }

    fn process_vision_message(
        &self,
        tunnel: &WorkerTunnel,
        composite_resource: &CompositeResource,
    ) -> BackendResult<()> {
        if !composite_resource
            .resource
            .resource_type
            .starts_with("image")
        {
            return Ok(());
        }

        let resource_path = composite_resource.resource.resource_path.clone();
        let image = std::fs::read(resource_path)
            .map_err(|e| eprintln!("failed to read image: {e:#?}"))
            .ok();

        if let Some(image) = image {
            let output = self
                .vision
                .describe_image(image)
                .map_err(|e| eprintln!("failed to describe image: {e:#?}"))
                .ok();

            let mut embeddable_sentences: Vec<String> = vec![];
            if let Some(output) = output {
                output.tags_result.values.iter().for_each(|tag| {
                    tunnel.worker_send_rust(
                        WorkerMessage::ResourceMessage(
                            ResourceMessage::UpsertResourceTextContent {
                                resource_id: composite_resource.resource.id.to_string(),
                                content: tag.name.to_string(),
                                content_type: models::ResourceTextContentType::ImageTags,
                                metadata: ResourceTextContentMetadata {
                                    timestamp: None,
                                    url: None,
                                },
                            },
                        ),
                        None,
                    );
                    embeddable_sentences.push(tag.name.to_string());
                });

                output
                    .dense_captions_result
                    .values
                    .iter()
                    .for_each(|caption| {
                        tunnel.worker_send_rust(
                            WorkerMessage::ResourceMessage(
                                ResourceMessage::UpsertResourceTextContent {
                                    resource_id: composite_resource.resource.id.to_string(),
                                    content: caption.text.to_string(),
                                    content_type: models::ResourceTextContentType::ImageCaptions,
                                    metadata: ResourceTextContentMetadata {
                                        timestamp: None,
                                        url: None,
                                    },
                                },
                            ),
                            None,
                        );
                        embeddable_sentences.push(caption.text.to_string());
                    });
            }
        }
        Ok(())
    }
}

pub fn ai_thread_entry_point(
    tunnel: WorkerTunnel,
    vision_api_key: String,
    vision_api_endpoint: String,
) {
    let ai = AI::new(&vision_api_key, &vision_api_endpoint);
    while let Ok(message) = tunnel.aiqueue_rx.recv() {
        match message {
            AIMessage::DescribeImage(composite_resource) => {
                let _ = ai.process_vision_message(&tunnel, &composite_resource);
            }
        }
    }
}
