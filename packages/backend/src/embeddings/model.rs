use rust_bert::pipelines::sentence_embeddings::{self, SentenceEmbeddingsModelType};

use crate::BackendResult;

pub struct EmbeddingModel {
    model: sentence_embeddings::SentenceEmbeddingsModel,
}

impl EmbeddingModel {
    pub fn new_remote() -> BackendResult<Self> {
        let model = sentence_embeddings::SentenceEmbeddingsBuilder::remote(
            SentenceEmbeddingsModelType::AllMiniLmL12V2,
        )
        .create_model()?;
        Ok(Self { model })
    }

    pub fn get_embedding_dim(&self) -> BackendResult<i64> {
        Ok(self.model.get_embedding_dim()?)
    }

    pub fn encode(&self, sentences: &Vec<String>) -> BackendResult<Vec<Vec<f32>>> {
        let embeddings = self.model.encode(&sentences)?;
        Ok(embeddings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_sanity() {
        let model = EmbeddingModel::new_remote().unwrap();
        let sentences = vec![
            "This is a sentence.".to_string(),
            "This is another sentence.".to_string(),
        ];
        let embeddings = model.encode(&sentences).unwrap();
        assert_eq!(embeddings.len(), sentences.len());
        embeddings.iter().for_each(|e| {
            assert_eq!(e.len(), model.get_embedding_dim().unwrap() as usize);
        });
    }
}
