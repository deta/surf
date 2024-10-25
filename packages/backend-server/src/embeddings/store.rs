use crate::{BackendError, BackendResult};
use serde::{Deserialize, Serialize};
use usearch::{Index, IndexOptions, MetricKind, ScalarKind};

#[derive(Debug, Serialize, Deserialize)]
pub struct DocsSimilarity {
    pub index: u64,
    pub similarity: f32,
}

fn new_index(embeddings_dim: &usize) -> BackendResult<Index> {
    let mut options = IndexOptions::default();
    options.dimensions = *embeddings_dim;
    options.metric = MetricKind::Cos;
    options.quantization = ScalarKind::F32;

    let index = Index::new(&options)?;
    Ok(index)
}

pub struct EmbeddingsStore {
    embedding_dim: usize,
    index_path: String,
    index: Index,
}

// TODO: how often should we save the index to disk? does it cause a performance hit?
// how large can the index get?
impl EmbeddingsStore {
    pub fn new(index_path: &str, embeddings_dim: &usize) -> BackendResult<Self> {
        let index = new_index(embeddings_dim)?;
        match index.load(index_path) {
            Ok(_) => {}
            Err(_) => {
                index.save(index_path)?;
            }
        }
        Ok(Self {
            embedding_dim: *embeddings_dim,
            index,
            index_path: index_path.to_string(),
        })
    }

    pub fn add(&self, id: u64, embedding: &[f32]) -> BackendResult<()> {
        self.index.reserve(self.index.size() + 1)?;
        self.index.add(id, embedding)?;
        self.index.save(&self.index_path)?;
        Ok(())
    }

    pub fn batch_add(&self, ids: Vec<u64>, embeddings: &Vec<Vec<f32>>) -> BackendResult<()> {
        if ids.len() != embeddings.len() {
            return Err(BackendError::GenericError(
                "ids and embeddings must have the same length".to_string(),
            ));
        }
        println!("reserving space for {} embeddings", embeddings.len());
        self.index.reserve(self.index.size() + embeddings.len())?;
        println!("reserved capacity");
        for (id, embedding) in ids.iter().zip(embeddings.iter()) {
            self.index.add(*id, embedding)?;
        }

        self.index.save(&self.index_path)?;
        Ok(())
    }

    pub fn remove(&self, id: u64) -> BackendResult<()> {
        self.index.remove(id)?;
        self.index.save(&self.index_path)?;
        Ok(())
    }

    pub fn batch_remove(&self, ids: Vec<u64>) -> BackendResult<()> {
        for id in ids.iter() {
            self.index.remove(*id)?;
        }
        self.index.save(&self.index_path)?;
        Ok(())
    }

    pub fn filtered_search(
        &self,
        embedding: &[f32],
        num_docs: usize,
        filter_keys: &Vec<u64>,
        threshold: &Option<f32>,
    ) -> BackendResult<Vec<u64>> {
        let mut results = vec![];
        let prefiltered_results = self
            .index
            .filtered_search(embedding, num_docs, |key| filter_keys.contains(&key))?;

        for (key, distance) in prefiltered_results
            .keys
            .iter()
            .zip(prefiltered_results.distances.iter())
        {
            if let Some(threshold) = threshold {
                if distance <= threshold {
                    results.push((*key, *distance));
                }
            } else {
                results.push((*key, *distance));
            }
        }
        results.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
        Ok(results.iter().map(|(key, _)| *key).collect())
    }

    pub fn search(&self, embedding: &[f32], num_docs: usize) -> BackendResult<Vec<u64>> {
        let results = self.index.search(embedding, num_docs)?;
        Ok(results.keys)
    }

    // TODO: should threshold be optional?
    pub fn get_docs_similarity(
        &self,
        query: &[f32],
        embeddings: &Vec<Vec<f32>>,
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
        index.reset()?;
        let mut docs_similarity = vec![];
        for (key, similarity) in results.keys.iter().zip(results.distances.iter()) {
            if *similarity <= *threshold {
                docs_similarity.push(DocsSimilarity {
                    index: *key,
                    similarity: similarity.clone(),
                });
            }
        }
        Ok(docs_similarity)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct NeedsCleanup;

    const TEST_DB: &str = ".test_index.usearch";

    impl Drop for NeedsCleanup {
        fn drop(&mut self) {
            std::fs::remove_file(TEST_DB).unwrap();
        }
    }

    #[test]
    fn test_sanity_docs_similarity() {
        let store = EmbeddingsStore::new(TEST_DB, &2).unwrap();
        let _cleanup = NeedsCleanup;
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
}
