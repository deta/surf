use crate::embeddings::chunking::ContentChunker;
use crate::{BackendError, BackendResult};
use fastembed::{InitOptions, TextEmbedding};
use std::path::PathBuf;
use std::string::ToString;
use strum_macros::{Display, EnumString};
use tracing::{debug, error, info, instrument, warn};

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
        debug!(
            "Converting EmbeddingModelMode::{:?} to fastembed model",
            mode
        );
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

#[instrument(level = "trace", skip(cache_dir))]
fn new_fastembed_model(
    cache_dir: &PathBuf,
    model_name: fastembed::EmbeddingModel,
    show_download_progress: bool,
) -> BackendResult<TextEmbedding> {
    info!(
        "Initializing fastembed model: {:?}, cache_dir: {:?}",
        model_name, cache_dir
    );

    let options = InitOptions {
        model_name,
        show_download_progress,
        cache_dir: cache_dir.to_path_buf(),
        ..Default::default()
    };

    match TextEmbedding::try_new(options) {
        Ok(model) => {
            info!("Successfully initialized fastembed model");
            Ok(model)
        }
        Err(e) => {
            error!("Failed to initialize fastembed model: {}", e);
            Err(BackendError::GenericError(e.to_string()))
        }
    }
}

impl EmbeddingModel {
    #[instrument(level = "trace", skip(cache_dir))]
    pub fn new_remote(cache_dir: &PathBuf, mode: EmbeddingModelMode) -> BackendResult<Self> {
        info!("Creating new remote embedding model with mode: {:?}", mode);

        let model_name: fastembed::EmbeddingModel = mode.into();
        debug!("Converted mode to model_name: {:?}", model_name);

        let model = match new_fastembed_model(cache_dir, model_name.clone(), false) {
            Ok(m) => m,
            Err(e) => {
                error!("Failed to create fastembed model: {}", e);
                return Err(e);
            }
        };

        let chunker = ContentChunker::new(2000, 1);
        debug!("Initialized content chunker with max_length: 2000, overlap: 1");

        info!("Successfully created remote embedding model");
        Ok(Self {
            model_name,
            model,
            chunker,
        })
    }

    #[instrument(level = "trace", skip(self))]
    pub fn get_embedding_dim(&self) -> usize {
        let dim = TextEmbedding::get_model_info(&self.model_name).dim;
        debug!("Retrieved embedding dimension: {}", dim);
        dim
    }

    #[instrument(level = "trace", skip(self, sentences), fields(num_sentences = sentences.len()))]
    pub fn encode(&self, sentences: &Vec<String>) -> BackendResult<Vec<Vec<f32>>> {
        debug!("Encoding {} sentences", sentences.len());

        match self.model.embed(sentences.to_vec(), Some(1)) {
            Ok(embeddings) => {
                debug!(
                    "Successfully created embeddings. First embedding size: {}",
                    embeddings.first().map_or(0, |v| v.len())
                );
                Ok(embeddings)
            }
            Err(e) => {
                error!("Failed to encode sentences: {}", e);
                Err(BackendError::GenericError(format!(
                    "Error encoding sentences: {}",
                    e
                )))
            }
        }
    }

    #[instrument(level= "trace", skip(self, sentence), fields(sentence_length = sentence.len()))]
    pub fn encode_single(&self, sentence: &str) -> BackendResult<Vec<f32>> {
        debug!("Encoding single sentence of length {}", sentence.len());

        match self.encode(&vec![sentence.to_string()]) {
            Ok(embeddings) => {
                let embedding = embeddings[0].clone();
                debug!(
                    "Successfully encoded single sentence. Embedding size: {}",
                    embedding.len()
                );
                Ok(embedding)
            }
            Err(e) => {
                error!("Failed to encode single sentence: {}", e);
                Err(e)
            }
        }
    }

    #[instrument(level = "trace", skip(self, content), fields(content_length = content.len()))]
    pub fn chunk_content(&self, content: &str) -> Vec<String> {
        debug!("Chunking content of length {}", content.len());
        let chunks = self.chunker.chunk(content);
        debug!("Content chunked into {} pieces", chunks.len());
        chunks
    }
}
