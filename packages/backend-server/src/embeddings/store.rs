use crate::{BackendError, BackendResult};
use serde::{Deserialize, Serialize};
use tracing::{error, instrument, warn};
use usearch::{Index, IndexOptions, MetricKind, ScalarKind};

#[derive(Debug, Serialize, Deserialize)]
pub struct DocsSimilarity {
    pub index: u64,
    pub similarity: f32,
}

fn new_index(embeddings_dim: &usize) -> BackendResult<Index> {
    let options = IndexOptions {
        dimensions: *embeddings_dim,
        metric: MetricKind::Cos,
        quantization: ScalarKind::F32,
        ..Default::default()
    };

    Index::new(&options).map_err(|e| e.into())
}

pub struct EmbeddingsStore {
    embedding_dim: usize,
    index_path: String,
    index: Index,
}

impl EmbeddingsStore {
    pub fn new(index_path: &str, embeddings_dim: &usize) -> BackendResult<Self> {
        let index = new_index(embeddings_dim)?;

        if let Err(e) = index.load(index_path) {
            warn!("Index not found, creating new one: {}", e);
            index.save(index_path)?;
        }

        Ok(Self {
            embedding_dim: *embeddings_dim,
            index,
            index_path: index_path.to_string(),
        })
    }

    fn reload(&self) -> BackendResult<()> {
        self.index.load(&self.index_path).map_err(|e| e.into())
    }

    pub fn add(&self, id: u64, embedding: &[f32]) -> BackendResult<()> {
        self.index.reserve(self.index.size() + 1)?;
        self.index.add(id, embedding)?;
        self.index.save(&self.index_path)?;
        Ok(())
    }

    #[instrument(level = "debug", skip(self, embeddings), fields(count = ids.len()))]
    pub fn batch_add(&self, ids: Vec<u64>, embeddings: &[Vec<f32>]) -> BackendResult<()> {
        self.validate_inputs(&ids, embeddings)?;

        match self.execute_batch_add(&ids, embeddings) {
            Ok(_) => {
                self.index.save(&self.index_path)?;
                Ok(())
            }
            Err(e) => {
                error!("Batch add failed, rolling back: {}", e);
                self.reload()?;
                Err(e)
            }
        }
    }

    fn validate_inputs(&self, ids: &[u64], embeddings: &[Vec<f32>]) -> BackendResult<()> {
        if ids.is_empty() || embeddings.is_empty() {
            return Ok(());
        }

        if ids.len() != embeddings.len() {
            return Err(BackendError::GenericError(format!(
                "Mismatched lengths: ids={}, embeddings={}",
                ids.len(),
                embeddings.len()
            )));
        }

        if embeddings.iter().any(|e| e.len() != self.embedding_dim) {
            return Err(BackendError::GenericError(
                "All embeddings must match the index dimension".to_string(),
            ));
        }

        Ok(())
    }

    fn execute_batch_add(&self, ids: &[u64], embeddings: &[Vec<f32>]) -> BackendResult<()> {
        for id in ids {
            self.index.remove(*id)?;
        }

        let new_size = self.index.size() + ids.len();
        self.index.reserve(new_size)?;

        for (id, embedding) in ids.iter().zip(embeddings.iter()) {
            self.index.add(*id, embedding)?;
        }

        Ok(())
    }

    pub fn remove(&self, id: u64) -> BackendResult<()> {
        self.index.remove(id)?;
        self.index.save(&self.index_path)?;
        Ok(())
    }

    #[instrument(level = "debug", skip(self), fields(count = ids.len()))]
    pub fn batch_remove(&self, ids: Vec<u64>) -> BackendResult<()> {
        for id in ids.iter() {
            self.index.remove(*id)?;
        }
        self.index.save(&self.index_path)?;
        Ok(())
    }

    #[instrument(level = "debug", skip(self, embedding, filter_keys), fields(num_docs, filter_count = filter_keys.len()))]
    pub fn filtered_search(
        &self,
        embedding: &[f32],
        num_docs: usize,
        filter_keys: &[u64],
        threshold: &Option<f32>,
    ) -> BackendResult<Vec<u64>> {
        let prefiltered_results = self
            .index
            .filtered_search(embedding, num_docs, |key| filter_keys.contains(&key))?;

        let mut results = vec![];
        for (key, distance) in prefiltered_results
            .keys
            .iter()
            .zip(prefiltered_results.distances.iter())
        {
            if threshold.is_none_or(|t| distance <= &t) {
                results.push((*key, *distance));
            }
        }

        results.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
        Ok(results.iter().map(|(key, _)| *key).collect())
    }

    pub fn search(&self, embedding: &[f32], num_docs: usize) -> BackendResult<Vec<u64>> {
        self.index
            .search(embedding, num_docs)
            .map(|results| results.keys)
            .map_err(|e| e.into())
    }

    pub fn get_docs_similarity(
        &self,
        query: &[f32],
        embeddings: &[Vec<f32>],
        threshold: &f32,
        num_docs: &usize,
    ) -> BackendResult<Vec<DocsSimilarity>> {
        let index = new_index(&self.embedding_dim)?;
        let index_size = embeddings.len();

        index.reserve(index_size)?;

        for (i, e) in embeddings.iter().enumerate() {
            index.add(i as u64, e)?;
        }

        let results = index.search(query, *num_docs)?;

        if let Err(e) = index.reset() {
            warn!("Failed to reset temporary index: {}", e);
        }

        Ok(results
            .keys
            .iter()
            .zip(results.distances.iter())
            .filter(|(_, similarity)| *similarity <= threshold)
            .map(|(key, similarity)| DocsSimilarity {
                index: *key,
                similarity: *similarity,
            })
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;
    use std::collections::HashMap;

    struct NeedsCleanup {
        index_path: String,
    }

    impl NeedsCleanup {
        // must be called before the store is created
        fn new(index_path: &str) -> Self {
            if let Err(error) = std::fs::remove_file(index_path) {
                if error.kind() != std::io::ErrorKind::NotFound {
                    panic!("Failed to remove existing test index");
                }
            }
            Self {
                index_path: index_path.to_string(),
            }
        }
    }

    impl Drop for NeedsCleanup {
        fn drop(&mut self) {
            std::fs::remove_file(&self.index_path).expect("Failed to remove test index");
        }
    }

    #[test]
    #[serial]
    fn test_sanity_docs_similarity() {
        let test_db = ".test_sanity_docs_similarity.usearch";
        // must be called before the store is created
        let _cleanup = NeedsCleanup::new(test_db);
        let store = EmbeddingsStore::new(test_db, &2).unwrap();
        let query = vec![0.1, 0.1];
        let docs = vec![
            vec![0.1, 0.1],
            vec![0.2, 0.2],
            vec![0.3, 0.3],
            vec![0.4, 0.4],
            vec![0.5, 0.5],
        ];
        let results = store.get_docs_similarity(&query, &docs, &0.5, &2).unwrap();
        assert_eq!(results.len(), 2);
        for r in results.iter() {
            assert!(r.similarity <= 0.5);
        }
    }

    #[test]
    #[serial]
    fn test_reload() {
        let test_db = ".test_rollback.usearch";
        // must be called before the store is created
        let _cleanup = NeedsCleanup::new(test_db);
        let store = EmbeddingsStore::new(test_db, &1).unwrap();

        let old_state: HashMap<u64, Vec<f32>> = HashMap::from([(1, vec![1.0]), (2, vec![2.0])]);
        let new_state: HashMap<u64, Vec<f32>> = HashMap::from([(3, vec![3.0]), (4, vec![4.0])]);

        for (key, value) in old_state.clone() {
            store
                .index
                .reserve(store.index.size() + 1)
                .expect("Failed to reserve space");
            store
                .index
                .add(key, &value)
                .expect("Failed to add to index");
            assert!(store.index.contains(key));
        }
        store.index.save(test_db).expect("Failed to save index");

        for (key, value) in new_state.clone() {
            store
                .index
                .reserve(store.index.size() + 1)
                .expect("Failed to reserve space");
            store
                .index
                .add(key, &value)
                .expect("Failed to add to index");
            assert!(store.index.contains(key));
        }

        store.reload().expect("Failed to reload index");

        for (key, _) in old_state {
            assert!(store.index.contains(key));
        }

        // since we reloaded the index, the new state should not be present
        for (key, _) in new_state {
            assert!(!store.index.contains(key));
        }
    }
}
