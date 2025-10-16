use crate::embeddings::chunking::ContentChunker;
use crate::{BackendError, BackendResult};
use fastembed::{InitOptions, TextEmbedding};
use std::path::Path;
use std::string::ToString;
use strum_macros::{Display, EnumString};
use tracing::{error, instrument, warn};

#[derive(Display, Debug, EnumString)]
#[strum(serialize_all = "snake_case")]
pub enum EmbeddingModelMode {
    Default,
    EnglishSmall,
    EnglishLarge,
    MultilingualSmall,
    MultilingualLarge,
}

impl From<EmbeddingModelMode> for fastembed::EmbeddingModel {
    fn from(mode: EmbeddingModelMode) -> Self {
        match mode {
            EmbeddingModelMode::Default => fastembed::EmbeddingModel::BGESmallENV15Q,
            EmbeddingModelMode::EnglishSmall => fastembed::EmbeddingModel::BGESmallENV15Q,
            EmbeddingModelMode::EnglishLarge => fastembed::EmbeddingModel::MxbaiEmbedLargeV1Q,
            EmbeddingModelMode::MultilingualSmall => fastembed::EmbeddingModel::MultilingualE5Small,
            EmbeddingModelMode::MultilingualLarge => fastembed::EmbeddingModel::MultilingualE5Large,
        }
    }
}

pub struct EmbeddingModel {
    model_name: fastembed::EmbeddingModel,
    model: TextEmbedding,
    chunker: ContentChunker,
}

fn new_fastembed_model(
    cache_dir: &Path,
    model_name: fastembed::EmbeddingModel,
    show_download_progress: bool,
) -> BackendResult<TextEmbedding> {
    let options = InitOptions {
        model_name,
        show_download_progress,
        cache_dir: cache_dir.to_path_buf(),
        ..Default::default()
    };

    TextEmbedding::try_new(options).map_err(|e| BackendError::GenericError(e.to_string()))
}

impl EmbeddingModel {
    pub fn new_remote(cache_dir: &Path, mode: EmbeddingModelMode) -> BackendResult<Self> {
        let model_name: fastembed::EmbeddingModel = mode.into();
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

    #[instrument(level = "debug", skip(self, sentences), fields(count = sentences.len()))]
    pub fn encode(&self, sentences: &[String]) -> BackendResult<Vec<Vec<f32>>> {
        self.model.embed(sentences.to_vec(), Some(1)).map_err(|e| {
            error!("Failed to encode {} sentences: {}", sentences.len(), e);
            BackendError::GenericError(format!("Error encoding sentences: {}", e))
        })
    }

    pub fn encode_single(&self, sentence: &str) -> BackendResult<Vec<f32>> {
        self.encode(&[sentence.to_string()])
            .map(|embeddings| embeddings[0].clone())
    }

    pub fn chunk_content(&self, content: &str) -> Vec<String> {
        self.chunker.chunk(content)
    }
}
