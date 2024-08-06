use crate::embeddings::chunking::ContentChunker;

use fastembed::{InitOptions, TextEmbedding};

use crate::{BackendError, BackendResult};

use std::path::PathBuf;

// TODO: find a better chunking strategy
pub struct EmbeddingModel {
    model_name: fastembed::EmbeddingModel,
    model: TextEmbedding,
    chunker: ContentChunker,
}

fn new_fastembed_model(
    cache_dir: &PathBuf,
    model_name: fastembed::EmbeddingModel,
    show_download_progress: bool,
) -> BackendResult<TextEmbedding> {
    let model = TextEmbedding::try_new(InitOptions {
        model_name,
        show_download_progress,
        cache_dir: cache_dir.to_path_buf(),
        ..Default::default()
    })
    .map_err(|e| BackendError::GenericError(e.to_string()))?;
    Ok(model)
}

impl EmbeddingModel {
    pub fn new_remote(cache_dir: &PathBuf) -> BackendResult<Self> {
        let model_name = fastembed::EmbeddingModel::BGESmallENV15Q;
        let model = new_fastembed_model(cache_dir, model_name.clone(), false)?;
        let chunker = ContentChunker::new(2000, 1);
        Ok(Self {
            model_name,
            model,
            chunker,
        })
    }

    pub fn get_embedding_dim(&self) -> usize {
        TextEmbedding::get_model_info(&self.model_name).dim
    }

    // assumes sentences are already chunked
    pub fn encode(&self, sentences: &Vec<String>) -> BackendResult<Vec<Vec<f32>>> {
        dbg!(sentences.len());
        let embeddings = self.model.embed(sentences.to_vec(), None).map_err(|e| {
            BackendError::GenericError(format!("Error encoding sentences: {}", e.to_string()))
        })?;
        dbg!(embeddings.len());
        Ok(embeddings)
    }

    pub fn encode_single(&self, sentence: &str) -> BackendResult<Vec<f32>> {
        let embeddings = self.encode(&vec![sentence.to_string()])?;
        Ok(embeddings[0].clone())
    }

    pub fn chunk_content(&self, content: &str) -> Vec<String> {
        self.chunker.chunk(content)
    }
}
