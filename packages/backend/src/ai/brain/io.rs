use super::agents::io::AgentIO;
use neon::prelude::*;
use neon::{event::Channel, handle::Root, types::JsFunction};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use std::{fs, thread};

use crate::ai::brain::agents::io::StatusMessage;
use crate::{BackendError, BackendResult};

pub struct NoteIO {
    id: String,
    resources_path: PathBuf,
    stream_callback: Arc<Root<JsFunction>>,
    status_callback: Arc<Root<JsFunction>>,
    channel: Channel,
    max_chunk_size: Option<usize>,
}

impl NoteIO {
    pub fn new(
        resources_path: &str,
        id: String,
        stream_callback: Root<JsFunction>,
        status_callback: Root<JsFunction>,
        channel: Channel,
        max_chunk_size: Option<usize>,
    ) -> BackendResult<Self> {
        Ok(Self {
            id,
            resources_path: Path::new(resources_path).to_path_buf(),
            stream_callback: Arc::new(stream_callback),
            status_callback: Arc::new(status_callback),
            channel,
            max_chunk_size,
        })
    }

    fn call_stream_callback(&self, content: String) -> BackendResult<()> {
        let stream_callback = Arc::clone(&self.stream_callback);
        self.channel
            .send(move |mut cx| {
                let cb = stream_callback.to_inner(&mut cx);
                let this = cx.undefined();
                let args = vec![cx.string(content).upcast::<JsValue>()];
                cb.call(&mut cx, this, args)?;
                Ok(())
            })
            .join()
            .map_err(|err| BackendError::GenericError(err.to_string()))?;
        Ok(())
    }
}

impl AgentIO for NoteIO {
    fn get_id(&self) -> String {
        self.id.clone()
    }

    fn write(&self, content: &str) -> BackendResult<()> {
        if self.max_chunk_size.is_none() {
            return self.call_stream_callback(content.to_string());
        }

        let max_chunk_size = self.max_chunk_size.unwrap();
        let chunks: Vec<String> = content
            .chars()
            .collect::<Vec<char>>()
            .chunks(max_chunk_size)
            .map(|chunk| chunk.iter().collect())
            .collect();
        for chunk in chunks {
            self.call_stream_callback(chunk)?;
        }

        Ok(())
    }

    fn write_status(&self, status: StatusMessage) -> BackendResult<()> {
        let status = serde_json::to_string(&status).map_err(|e| {
            BackendError::GenericError(format!("failed to serialize status: {}", e))
        })?;
        let status_callback = Arc::clone(&self.status_callback);

        self.channel
            .send(move |mut cx| {
                let cb = status_callback.to_inner(&mut cx);
                let this = cx.undefined();
                let args = vec![cx.string(status).upcast::<JsValue>()];
                cb.call(&mut cx, this, args)?;
                Ok(())
            })
            .join()
            .map_err(|err| BackendError::GenericError(err.to_string()))?;
        Ok(())
    }

    fn read(&self) -> BackendResult<String> {
        let content = fs::read_to_string(Path::join(&self.resources_path, &self.id))?;
        Ok(content)
    }

    fn clear(&self) -> BackendResult<()> {
        unimplemented!()
    }
}
