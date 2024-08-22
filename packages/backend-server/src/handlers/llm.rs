use crate::handlers::{try_stream_write_all, try_stream_write_all_bytes};
use crate::llm::{llama::llama::Llama, models::Message};
#[cfg(not(target_os = "windows"))]
use std::os::unix::net::UnixStream;
#[cfg(target_os = "windows")]
use uds_windows::UnixStream;

pub fn handle_llm_chat_completion(model: &Llama, stream: &UnixStream, client_message: &str) {
    let chat_messages = match serde_json::from_str::<Vec<Message>>(&client_message) {
        Ok(chat_messages) => chat_messages,
        Err(e) => {
            try_stream_write_all(
                stream,
                &format!("error: failed to parse messages: {:#?}", e),
            );
            return;
        }
    };
    let handle = match model.create_chat_completion(chat_messages) {
        Ok(handle) => handle,
        Err(e) => {
            try_stream_write_all(
                stream,
                &format!("error: failed to create chat completion: {:#?}", e),
            );
            return;
        }
    };
    for content in handle.into_bytes() {
        try_stream_write_all_bytes(stream, &content);
    }
}
