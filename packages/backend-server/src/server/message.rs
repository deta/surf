use crate::{embeddings::store::DocsSimilarity, BackendResult};
use std::sync::mpsc::Sender;

#[derive(Debug)]
pub enum Message {
    AddEmbedding(Sender<BackendResult<()>>, u64, Vec<f32>),
    RemoveEmbedding(Sender<BackendResult<()>>, u64),
    BatchAddEmbeddings(Sender<BackendResult<()>>, Vec<u64>, Vec<Vec<f32>>, usize),
    BatchRemoveEmbeddings(Sender<BackendResult<()>>, Vec<u64>),
    FilteredSearch(
        Sender<BackendResult<Vec<u64>>>,
        Vec<f32>,
        usize,
        Vec<u64>,
        Option<f32>,
    ),
    GetDocsSimilarity(
        Sender<BackendResult<Vec<DocsSimilarity>>>,
        Vec<f32>,
        Vec<Vec<f32>>,
        f32,
        usize,
    ),
}
