use rust_bert::pipelines::sentence_embeddings::{self, SentenceEmbeddingsModelType};
use text_splitter::{Characters, TextSplitter};

use crate::store::models;
use crate::BackendResult;

// TODO: find a better chunking strategy
pub struct EmbeddingModel {
    max_characters: usize,
    splitter: text_splitter::TextSplitter<Characters>,
    model: sentence_embeddings::SentenceEmbeddingsModel,
}

impl EmbeddingModel {
    // TODO: how to get local?
    pub fn new_remote() -> BackendResult<Self> {
        let max_characters = 1000;
        let splitter = TextSplitter::default().with_trim_chunks(true);
        let model = sentence_embeddings::SentenceEmbeddingsBuilder::remote(
            SentenceEmbeddingsModelType::AllMiniLmL12V2,
        )
        .create_model()?;
        Ok(Self {
            max_characters,
            splitter,
            model,
        })
    }

    pub fn get_embedding_dim(&self) -> BackendResult<i64> {
        Ok(self.model.get_embedding_dim()?)
    }

    pub fn encode(&self, sentences: &Vec<String>) -> BackendResult<Vec<Vec<f32>>> {
        let mut embeddings: Vec<Vec<f32>> = vec![];
        for sentence in sentences {
            let chunks = self
                .splitter
                .chunks(sentence, self.max_characters)
                .collect::<Vec<_>>();
            embeddings.append(&mut self.model.encode(&chunks)?);
        }
        Ok(embeddings)
    }

    pub fn encode_single(&self, sentence: &str) -> BackendResult<Vec<f32>> {
        let embeddings = self.model.encode(&vec![sentence.to_string()])?;
        Ok(embeddings[0].clone())
    }

    pub fn get_embeddings(
        &self,
        embeddable: &impl models::EmbeddableContent,
    ) -> BackendResult<Vec<Vec<f32>>> {
        let sentences = embeddable.get_embeddable_content();
        if sentences.is_empty() {
            return Ok(vec![]);
        }
        let embeddings = self.model.encode(&sentences)?;
        Ok(embeddings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::db;
    use crate::store::models;

    struct NeedsCleanup;

    const TEST_DB: &str = "_embeddings_search_test.db";

    impl Drop for NeedsCleanup {
        fn drop(&mut self) {
            std::fs::remove_file(TEST_DB).unwrap();
        }
    }

    #[test]
    fn test_sanity_encode() {
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

    #[test]
    fn test_sanity_chunking() {
        let model = EmbeddingModel::new_remote().unwrap();
        let num_chunks = 2;
        let sentence = "a".repeat(num_chunks * model.max_characters);
        let chunks = model
            .splitter
            .chunks(&sentence, model.max_characters)
            .collect::<Vec<_>>();
        assert_eq!(chunks.len(), num_chunks);
    }

    // This test should be an integration test
    // but since we are using cdylib, we can't import our crate into integration tests without
    // building two libarires
    // see: https://github.com/rust-lang/cargo/issues/6659
    #[test]
    fn test_sanity_embeddings_search() {
        let _cleanup = NeedsCleanup;
        let mut store = db::Database::new(TEST_DB).unwrap();
        let model = EmbeddingModel::new_remote().unwrap();

        let sentences = vec![
            "Apple is a fruit.".to_string(),
            "Banana is a fruit.".to_string(),
            "Dog is an animal.".to_string(),
            "Cat is an animal.".to_string(),
        ];

        let embeddings = model.encode(&sentences).unwrap();

        let mut tx = store.begin().unwrap();
        embeddings.iter().enumerate().for_each(|(i, e)| {
            let mut embedding = models::Embedding::new(&e);
            embedding.rowid = Some(i as i64);
            db::Database::create_embedding_tx(&mut tx, &embedding).unwrap();
        });
        tx.commit().unwrap();

        let queries = vec!["fruit".to_string(), "animal".to_string()];
        let expected_results = vec![vec![0, 1], vec![2, 3]];
        let query_embeddings = model.encode(&queries).unwrap();

        query_embeddings.iter().enumerate().for_each(|(i, e)| {
            let embedding = models::Embedding::new(&e);
            let results = store
                .vector_search_embeddings(&embedding, f32::MAX, 2)
                .unwrap();
            assert_eq!(results.len(), 2);
            results.iter().for_each(|r| {
                assert!(expected_results[i].contains(&r.rowid));
            });
        });
    }
}
