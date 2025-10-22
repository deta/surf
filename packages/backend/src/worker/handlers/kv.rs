use crate::{
    api::message::{KVStoreMessage, TunnelOneshot},
    worker::{send_serialized_worker_response, send_worker_response, Worker},
};

#[tracing::instrument(level = "trace", skip(worker, oneshot))]
pub fn handle_kv_store_message(
    worker: &mut Worker,
    oneshot: Option<TunnelOneshot>,
    message: KVStoreMessage,
) {
    match message {
        KVStoreMessage::CreateTable(table_name) => {
            let result = worker.kv.new_table(&table_name);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        KVStoreMessage::List(table_name) => {
            let result = worker
                .kv
                .list(&table_name)
                .map(|value| "[".to_string() + &value.join(",") + "]");

            send_serialized_worker_response(&mut worker.channel, oneshot, result);
        }
        KVStoreMessage::Get(table_name, key) => {
            let result = worker
                .kv
                .get(&table_name, &key)
                .map(|value| value.unwrap_or_else(|| "null".to_string()));

            send_serialized_worker_response(&mut worker.channel, oneshot, result);
        }
        KVStoreMessage::Put(table_name, key, value) => {
            let result = worker.kv.put(&table_name, &key, &value);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        KVStoreMessage::Update(table_name, key, changes) => {
            let result = worker.kv.update(&table_name, &key, &changes);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        KVStoreMessage::Delete(table_name, key) => {
            let result = worker.kv.delete(&table_name, &key);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
    }
}
