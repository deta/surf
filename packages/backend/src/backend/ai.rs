use super::{message::*, tunnel::WorkerTunnel};
use crate::{
    ai::ai::{DataSource, DataSourceMetadata, DataSourceType, AI as AIClient},
    embeddings::model::EmbeddingModel,
    store::{db::CompositeResource, models},
    vision::vision::Vision,
    BackendResult,
};

pub struct AI {
    pub embedding_model: EmbeddingModel,
    pub ai_client: AIClient,
    pub vision: Vision,
}

impl AI {
    pub fn new(
        vision_api_key: &str,
        vision_api_endpoint: &str,
        ai_backend_api_endpoint: &str,
    ) -> Self {
        Self {
            embedding_model: EmbeddingModel::new_remote().unwrap(),
            ai_client: AIClient::new(ai_backend_api_endpoint.to_string()),
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

            /*
            embeddable_sentences.iter().for_each(|sentence| {
                let url = match &composite_resource.metadata {
                    Some(metadata) => Some(metadata.source_uri.clone()),
                    None => None,
                };

                let rag_metadata = DataSourceMetadata {
                    resource_id: composite_resource.resource.id.to_string(),
                    resource_type: "image_tags_captions".to_string(),
                    url,
                };

                let ds = DataSource {
                    data_type: DataSourceType::Text.to_string(),
                    data_value: sentence.to_string(),
                    metadata: serde_json::to_string(&rag_metadata).unwrap(),
                    env_variables: "".to_string(),
                };
                let _ = self
                    .ai_client
                    .add_data_source(&ds)
                    .map_err(|e| eprintln!("failed to add data source for rag: {e:#?}"));
            });
            */

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

    fn should_add_general_data_source(
        embeddable: &impl models::EmbeddableContent,
        resource_type: Option<String>,
    ) -> bool {
        /*
        dbg!(embeddable.get_resource_id());
        dbg!(embeddable.get_embedding_type());
        dbg!(embeddable.get_embeddable_content());
        dbg!(resource_type.clone());
        */
        if embeddable.get_embedding_type() == "metadata" {
            return false;
        }
        if embeddable.get_embeddable_content().is_empty() {
            return false;
        }
        match resource_type {
            Some(resource_type) => {
                // TODO: use enums for resource types
                // we already save articles as "web_page" data source
                // and the text content of the article is also not complete if the article is long
                // just let the embedchain backend handle the article embeddings
                if resource_type.starts_with("application/vnd.space.article") {
                    return false;
                }
                if resource_type.starts_with("application/vnd.space.link") {
                    return false;
                }
                // we also already save youtube videos as different data source
                if resource_type.starts_with("application/vnd.space.post.youtube") {
                    return false;
                }
                true
            }
            None => false,
        }
    }

    fn process_embeddable_message(
        &self,
        tunnel: &WorkerTunnel,
        embeddable: impl models::EmbeddableContent,
        resource_type: Option<String>,
        ignore: bool,
    ) -> BackendResult<()> {
        if Self::should_add_general_data_source(&embeddable, resource_type) {
            let rag_metadata = DataSourceMetadata {
                ignore,
                resource_id: embeddable.get_resource_id(),
                resource_type: embeddable.get_embedding_type(),
                url: None,
            };

            let ds = DataSource {
                data_type: DataSourceType::Text.to_string(),
                data_value: embeddable.get_embeddable_content().join(""),
                metadata: serde_json::to_string(&rag_metadata).unwrap(),
                env_variables: "".to_string(),
            };
            let _ = self
                .ai_client
                .add_data_source(&ds)
                .map_err(|e| eprintln!("failed to add data source for rag: {e:#?}"));
        }

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

    fn process_embeddable_webpage_message(
        &self,
        resource_metadata: models::ResourceMetadata,
        ignore: bool,
    ) -> BackendResult<()> {
        let rag_metadata = DataSourceMetadata {
            ignore,
            resource_id: resource_metadata.resource_id,
            resource_type: DataSourceType::Webpage.to_string(),
            url: Some(resource_metadata.source_uri.clone()),
        };

        let ds = DataSource {
            data_type: DataSourceType::Webpage.to_string(),
            data_value: resource_metadata.source_uri,
            metadata: serde_json::to_string(&rag_metadata).unwrap(),
            env_variables: "".to_string(),
        };
        let _ = self
            .ai_client
            .add_data_source(&ds)
            .map_err(|e| eprintln!("failed to add data source for rag: {e:#?}"));
        Ok(())
    }

    fn process_embeddable_youtube_video_message(
        &self,
        resource_metadata: models::ResourceMetadata,
        ignore: bool,
    ) -> BackendResult<()> {
        let rag_metadata = DataSourceMetadata {
            ignore,
            resource_id: resource_metadata.resource_id,
            resource_type: DataSourceType::YoutubeVideo.to_string(),
            url: Some(resource_metadata.source_uri.clone()),
        };

        let ds = DataSource {
            data_type: DataSourceType::YoutubeVideo.to_string(),
            data_value: resource_metadata.source_uri,
            // TODO: don't unwrap
            metadata: serde_json::to_string(&rag_metadata).unwrap(),
            env_variables: "".to_string(),
        };
        let _ = self
            .ai_client
            .add_data_source(&ds)
            .map_err(|e| eprintln!("failed to add data source for rag: {e:#?}"));
        Ok(())
    }
}

pub fn ai_thread_entry_point(
    tunnel: WorkerTunnel,
    vision_api_key: String,
    vision_api_endpoint: String,
    ai_backend_api_endpoint: String,
) {
    let ai = AI::new(
        &vision_api_key,
        &vision_api_endpoint,
        &ai_backend_api_endpoint,
    );
    while let Ok(message) = tunnel.aiqueue_rx.recv() {
        match message {
            // TODO: implement
            AIMessage::GenerateMetadataEmbeddings(resource_metadata, ignore) => {
                let _ = ai.process_embeddable_message(&tunnel, resource_metadata, None, ignore);
            }
            AIMessage::GenerateTextContentEmbeddings(resource_content, resource_type, ignore) => {
                let _ =
                    ai.process_embeddable_message(&tunnel, resource_content, Some(resource_type), ignore);
            }
            AIMessage::DescribeImage(composite_resource) => {
                let _ = ai.process_vision_message(&tunnel, &composite_resource);
            }
            AIMessage::GenerateWebpageEmbeddings(resource_metadata, ignore) => {
                let _ = ai.process_embeddable_webpage_message(resource_metadata, ignore);
            }
            AIMessage::GenerateYoutubeVideoEmbeddings(resource_metadata, ignore) => {
                let _ = ai.process_embeddable_youtube_video_message(resource_metadata, ignore);
            }
        }
    }
}
