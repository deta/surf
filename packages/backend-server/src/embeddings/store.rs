use crate::{BackendError, BackendResult};
use serde::{Deserialize, Serialize};
use tracing::{debug, error, info, instrument, warn};
use usearch::{Index, IndexOptions, MetricKind, ScalarKind};

#[derive(Debug, Serialize, Deserialize)]
pub struct DocsSimilarity {
    pub index: u64,
    pub similarity: f32,
}

#[instrument(level = "trace", skip(embeddings_dim))]
fn new_index(embeddings_dim: &usize) -> BackendResult<Index> {
    debug!("Creating new index with dimensions: {}", embeddings_dim);
    let options = IndexOptions {
        dimensions: *embeddings_dim,
        metric: MetricKind::Cos,
        quantization: ScalarKind::F32,
        ..Default::default()
    };

    match Index::new(&options) {
        Ok(index) => {
            info!("Successfully created new index");
            Ok(index)
        }
        Err(e) => {
            error!("Failed to create index: {}", e);
            Err(e.into())
        }
    }
}

pub struct EmbeddingsStore {
    embedding_dim: usize,
    index_path: String,
    index: Index,
}

impl EmbeddingsStore {
    #[instrument(level = "trace", skip(embeddings_dim))]
    pub fn new(index_path: &str, embeddings_dim: &usize) -> BackendResult<Self> {
        info!("Initializing EmbeddingsStore with path: {}", index_path);
        let index = new_index(embeddings_dim)?;

        match index.load(index_path) {
            Ok(_) => {
                info!("Successfully loaded existing index from: {}", index_path);
            }
            Err(e) => {
                warn!("Failed to load index, creating new one: {}", e);
                index.save(index_path)?;
                info!("Created and saved new index to: {}", index_path);
            }
        }

        Ok(Self {
            embedding_dim: *embeddings_dim,
            index,
            index_path: index_path.to_string(),
        })
    }

    #[instrument(level = "trace", skip(self))]
    fn reload(&self) -> BackendResult<()> {
        match self.index.load(&self.index_path) {
            Ok(_) => {
                debug!("Reloaded index from: {}", self.index_path);
            }
            Err(e) => {
                error!("Failed to reload index: {}", e);
                return Err(e.into());
            }
        }
        Ok(())
    }

    #[instrument(level = "trace", skip(self, embedding))]
    pub fn add(&self, id: u64, embedding: &[f32]) -> BackendResult<()> {
        debug!("Adding embedding for id: {}", id);

        match self.index.reserve(self.index.size() + 1) {
            Ok(_) => debug!("Successfully reserved space for new embedding"),
            Err(e) => {
                error!("Failed to reserve space: {}", e);
                return Err(e.into());
            }
        }

        if let Err(e) = self.index.add(id, embedding) {
            error!("Failed to add embedding: {}", e);
            return Err(e.into());
        }

        if let Err(e) = self.index.save(&self.index_path) {
            error!("Failed to save index: {}", e);
            return Err(e.into());
        }

        debug!("Successfully added and saved embedding for id: {}", id);
        Ok(())
    }

    #[instrument(level = "trace", skip(self, embeddings))]
    pub fn batch_add(&self, ids: Vec<u64>, embeddings: &Vec<Vec<f32>>) -> BackendResult<()> {
        debug!("Starting batch add for {} embeddings", ids.len());
        self.validate_inputs(&ids, embeddings)?;

        match self.execute_batch_add(&ids, embeddings) {
            Ok(_) => {
                self.index.save(&self.index_path).map_err(|e| {
                    error!("Failed to save changes to disk: {}", e);
                    e
                })?;
                debug!(
                    "Successfully completed batch add of {} embeddings",
                    ids.len()
                );
                Ok(())
            }
            Err(e) => {
                error!("Batch add failed, rolling back to last saved state: {}", e);
                self.reload().map_err(|load_err| {
                    error!("Failed to rollback to last saved state: {}", load_err);
                    load_err
                })?;
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
        self.index.reserve(new_size).map_err(|e| {
            error!("Failed to reserve space: {}", e);
            e
        })?;

        for (id, embedding) in ids.iter().zip(embeddings.iter()) {
            self.index.add(*id, embedding).map_err(|e| {
                error!("Failed to add embedding for id {}: {}", id, e);
                e
            })?;
        }

        Ok(())
    }

    #[instrument(level = "trace", skip(self))]
    pub fn remove(&self, id: u64) -> BackendResult<()> {
        debug!("Removing embedding for id: {}", id);

        if let Err(e) = self.index.remove(id) {
            error!("Failed to remove embedding for id {}: {}", id, e);
            return Err(e.into());
        }

        if let Err(e) = self.index.save(&self.index_path) {
            error!("Failed to save index after removal: {}", e);
            return Err(e.into());
        }

        info!("Successfully removed embedding for id: {}", id);
        Ok(())
    }

    #[instrument(level = "trace", skip(self))]
    pub fn batch_remove(&self, ids: Vec<u64>) -> BackendResult<()> {
        debug!("Starting batch remove for {} ids", ids.len());

        for id in ids.iter() {
            debug!("Removing embedding for id {}", id);
            if let Err(e) = self.index.remove(*id) {
                error!("Failed to remove embedding for id {}: {}", id, e);
                return Err(e.into());
            }
        }

        if let Err(e) = self.index.save(&self.index_path) {
            error!("Failed to save index after batch removal: {}", e);
            return Err(e.into());
        }

        debug!(
            "Successfully completed batch remove of {} embeddings",
            ids.len()
        );
        Ok(())
    }

    #[instrument(level = "trace", skip(self, embedding, filter_keys))]
    pub fn filtered_search(
        &self,
        embedding: &[f32],
        num_docs: usize,
        filter_keys: &Vec<u64>,
        threshold: &Option<f32>,
    ) -> BackendResult<Vec<u64>> {
        debug!(
            "Performing filtered search for {} docs with {} filter keys",
            num_docs,
            filter_keys.len()
        );

        let mut results = vec![];
        let prefiltered_results = match self
            .index
            .filtered_search(embedding, num_docs, |key| filter_keys.contains(&key))
        {
            Ok(r) => r,
            Err(e) => {
                error!("Failed to perform filtered search: {}", e);
                return Err(e.into());
            }
        };

        for (key, distance) in prefiltered_results
            .keys
            .iter()
            .zip(prefiltered_results.distances.iter())
        {
            if let Some(threshold) = threshold {
                if distance <= threshold {
                    debug!("Found match: key={}, distance={}", key, distance);
                    results.push((*key, *distance));
                }
            } else {
                results.push((*key, *distance));
            }
        }

        results.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
        let final_results: Vec<u64> = results.iter().map(|(key, _)| *key).collect();

        debug!("Found {} matching documents", final_results.len());
        Ok(final_results)
    }

    #[instrument(level = "trace", skip(self, embedding))]
    pub fn search(&self, embedding: &[f32], num_docs: usize) -> BackendResult<Vec<u64>> {
        debug!("Performing search for {} docs", num_docs);

        match self.index.search(embedding, num_docs) {
            Ok(results) => {
                info!("Found {} matching documents", results.keys.len());
                Ok(results.keys)
            }
            Err(e) => {
                error!("Failed to perform search: {}", e);
                Err(e.into())
            }
        }
    }

    #[instrument(level = "trace", skip(self, query, embeddings))]
    pub fn get_docs_similarity(
        &self,
        query: &[f32],
        embeddings: &Vec<Vec<f32>>,
        threshold: &f32,
        num_docs: &usize,
    ) -> BackendResult<Vec<DocsSimilarity>> {
        debug!(
            "Getting document similarity for {} embeddings with threshold {}",
            embeddings.len(),
            threshold
        );

        let index = new_index(&self.embedding_dim)?;
        let index_size = embeddings.len();

        if let Err(e) = index.reserve(index_size) {
            error!("Failed to reserve space for temporary index: {}", e);
            return Err(e.into());
        }

        for (i, e) in embeddings.iter().enumerate() {
            if let Err(e) = index.add(i as u64, e) {
                error!("Failed to add embedding to temporary index: {}", e);
                return Err(e.into());
            }
        }

        let results = match index.search(query, *num_docs) {
            Ok(r) => r,
            Err(e) => {
                error!("Failed to search temporary index: {}", e);
                return Err(e.into());
            }
        };

        if let Err(e) = index.reset() {
            warn!("Failed to reset temporary index: {}", e);
        }

        let mut docs_similarity = vec![];
        for (key, similarity) in results.keys.iter().zip(results.distances.iter()) {
            if *similarity <= *threshold {
                docs_similarity.push(DocsSimilarity {
                    index: *key,
                    similarity: similarity.clone(),
                });
            }
        }

        debug!(
            "Found {} similar documents within threshold",
            docs_similarity.len()
        );
        Ok(docs_similarity)
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
