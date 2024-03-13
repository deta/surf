use super::{message::*, tunnel::WorkerTunnel};
use crate::{
    embeddings::model::EmbeddingModel, store::db::CompositeResource, store::models,
    vision::vision::Vision, BackendResult,
};

pub struct AI {
    pub embedding_model: EmbeddingModel,
    pub vision: Vision,
}

impl AI {
    pub fn new(vision_api_key: &str, vision_api_endpoint: &str) -> Self {
        Self {
            embedding_model: EmbeddingModel::new_remote().unwrap(),
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
                            ResourceMessage::CreateResourceTextContent {
                                resource_id: composite_resource.resource.id.to_string(),
                                content: tag.name.to_string(),
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
                                ResourceMessage::CreateResourceTextContent {
                                    resource_id: composite_resource.resource.id.to_string(),
                                    content: caption.text.to_string(),
                                },
                            ),
                            None,
                        );
                        embeddable_sentences.push(caption.text.to_string());
                    });
            }

            let embeddings = self
                .embedding_model
                .encode(&embeddable_sentences)
                .map_err(|e| eprintln!("failed to generate embeddings: {e:#?}"))
                .ok();

            if let Some(embeddings) = embeddings {
                tunnel.worker_send_rust(
                    WorkerMessage::ResourceMessage(ResourceMessage::InsertEmbeddings {
                        resource_id: composite_resource.resource.id.to_string(),
                        embedding_type: "image_tags_captions".to_string(),
                        embeddings,
                    }),
                    None,
                );
            }
        }

        Ok(())
    }

    fn process_embeddable_message(
        &self,
        tunnel: &WorkerTunnel,
        embeddable: impl models::EmbeddableContent,
    ) -> BackendResult<()> {
        let embeddigns = self
            .embedding_model
            .get_embeddings(&embeddable)
            .map_err(|e| eprintln!("failed to generate embeddings: {e:#?}"))
            .ok();

        if let Some(embeddings) = embeddigns {
            tunnel.worker_send_rust(
                WorkerMessage::ResourceMessage(ResourceMessage::UpsertEmbeddings {
                    resource_id: embeddable.get_resource_id(),
                    embedding_type: embeddable.get_embedding_type(),
                    embeddings,
                }),
                None,
            );
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
            // TODO: implement
            AIMessage::GenerateMetadataEmbeddings(resource_metadata) => {
                let _ = ai.process_embeddable_message(&tunnel, resource_metadata);
            }
            AIMessage::GenerateTextContentEmbeddings(resource_content) => {
                let _ = ai.process_embeddable_message(&tunnel, resource_content);
            }
            AIMessage::DescribeImage(composite_resource) => {
                let _ = ai.process_vision_message(&tunnel, &composite_resource);
            }
        }
    }
}
