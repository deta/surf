use super::{message::*, tunnel::WorkerTunnel};
use crate::{embeddings::model::EmbeddingModel, store::models, BackendResult};

pub struct AI {
    pub embedding_model: EmbeddingModel,
}

impl AI {
    pub fn new() -> Self {
        Self {
            embedding_model: EmbeddingModel::new_remote().unwrap(),
        }
    }

    fn process_message(
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

pub fn ai_thread_entry_point(tunnel: WorkerTunnel) {
    let ai = AI::new();
    while let Ok(message) = tunnel.aiqueue_rx.recv() {
        match message {
            // TODO: implement
            AIMessage::GenerateMetadataEmbeddings(resource_metadata) => {
                let _ = ai.process_message(&tunnel, resource_metadata);
            }
            AIMessage::GenerateTextContentEmbeddings(resource_content) => {
                let _ = ai.process_message(&tunnel, resource_content);
            }
        }
    }
}
