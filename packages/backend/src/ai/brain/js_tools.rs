use neon::{
    event::Channel,
    handle::Root,
    prelude::*,
    types::{
        extract::{Json, TryFromJs, TryIntoJs},
        JsFunction, JsValue,
    },
};
use serde::Deserialize;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::{Arc, Mutex, RwLock};

use crate::{BackendError, BackendResult};

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub enum ToolName {
    SearchAPI,
    SearchDoneCallback,
    SurfletDoneCallback,
    ScrapeURL,
}

impl FromStr for ToolName {
    type Err = BackendError;
    fn from_str(s: &str) -> BackendResult<Self> {
        match s {
            "web_search_api" => Ok(ToolName::SearchAPI),
            "web_search_done_callback" => Ok(ToolName::SearchDoneCallback),
            "scrape_url" => Ok(ToolName::ScrapeURL),
            "surflet_done_callback" => Ok(ToolName::SurfletDoneCallback),
            _ => Err(BackendError::GenericError(format!(
                "Unexpected tool name: {}",
                s
            ))),
        }
    }
}

pub struct ToolEntry {
    callback: Arc<Mutex<Root<JsFunction>>>,
    channel: Channel,
}

#[derive(Clone)]
pub struct JSToolRegistry {
    tools: Arc<RwLock<HashMap<ToolName, ToolEntry>>>,
}

impl Default for JSToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl JSToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn add_tool(
        &self,
        tool_name: ToolName,
        js_function: Root<JsFunction>,
        channel: Channel,
    ) -> BackendResult<()> {
        let mut tools = self.tools.write().map_err(|_| {
            BackendError::GenericError("Failed to acquire write lock on tool registry".to_string())
        })?;

        let tool_entry = ToolEntry {
            callback: Arc::new(Mutex::new(js_function)),
            channel,
        };

        tools.insert(tool_name, tool_entry);
        Ok(())
    }

    pub fn remove_tool(&self, tool_name: &ToolName) -> BackendResult<bool> {
        let mut tools = self.tools.write().map_err(|_| {
            BackendError::GenericError("Failed to acquire write lock on tool registry".to_string())
        })?;

        Ok(tools.remove(tool_name).is_some())
    }

    pub fn execute_tool<T, R>(&self, tool_name: &ToolName, args: Option<Vec<T>>) -> BackendResult<R>
    where
        T: Send + 'static,
        for<'cx> T: TryIntoJs<'cx>,
        R: for<'de> Deserialize<'de> + Send + 'static,
    {
        let (callback_arc, channel) = {
            let tools = self.tools.read().map_err(|_| {
                BackendError::GenericError(
                    "Failed to acquire read lock on tool registry".to_string(),
                )
            })?;

            match tools.get(tool_name) {
                Some(entry) => (Arc::clone(&entry.callback), entry.channel.clone()),
                None => {
                    return Err(BackendError::GenericError(format!(
                        "Tool {:?} not found",
                        tool_name
                    )))
                }
            }
        };

        let (tx, rx) = std::sync::mpsc::channel::<BackendResult<R>>();

        channel.send(move |mut cx| {
            let callback_root = {
                let guard = match callback_arc.lock() {
                    Ok(guard) => guard,
                    Err(_) => {
                        let _ = tx.send(Err(BackendError::GenericError(
                            "Failed to lock callback mutex, tool execution cancelled".to_string(),
                        )));
                        return Ok(());
                    }
                };
                guard.clone(&mut cx)
            };

            let callback = callback_root.into_inner(&mut cx);
            let mut bind_options = callback.bind(&mut cx);

            if let Some(args) = args {
                for arg in args {
                    match bind_options.arg(arg) {
                        Ok(_) => {}
                        Err(_) => {
                            let _ = tx.send(Err(BackendError::GenericError(
                                "Failed to bind argument to callback".to_string(),
                            )));
                            return Ok(());
                        }
                    }
                }
            }

            let result: Handle<JsValue> = match bind_options.call() {
                Ok(result) => result,
                Err(_) => {
                    let _ = tx.send(Err(BackendError::GenericError(
                        "JavaScript callback threw an exception".to_string(),
                    )));
                    return Ok(());
                }
            };

            if result.is_a::<JsPromise, _>(&mut cx) {
                let promise = result.downcast::<JsPromise, _>(&mut cx).unwrap();
                let tx_clone = tx.clone();

                let _future = match promise.to_future(&mut cx, move |mut cx, promise_result| {
                    match promise_result {
                        Ok(resolved_value) => {
                            let json_string = resolved_value
                                .downcast_or_throw::<JsString, _>(&mut cx)
                                .map(|js_string| js_string.value(&mut cx))?;

                            match serde_json::from_str::<R>(&json_string) {
                                Ok(extracted) => {
                                    let _ = tx_clone.send(Ok(extracted));
                                }
                                Err(extraction_error) => {
                                    let error_msg = format!(
                                        "Failed to deserialize JSON return value from promise: {}",
                                        extraction_error
                                    );
                                    let _ =
                                        tx_clone.send(Err(BackendError::GenericError(error_msg)));
                                }
                            }
                        }
                        Err(js_error) => {
                            let error_string = format!("Promise rejected: {:?}", js_error);
                            let _ = tx_clone.send(Err(BackendError::GenericError(error_string)));
                        }
                    }
                    Ok(())
                }) {
                    Ok(future) => future,
                    Err(_) => {
                        let _ = tx.send(Err(BackendError::GenericError(
                            "Failed to create promise future".to_string(),
                        )));
                        return Ok(());
                    }
                };
            } else {
                match Json::<R>::try_from_js(&mut cx, result) {
                    Ok(Ok(Json(extracted))) => {
                        let _ = tx.send(Ok(extracted));
                    }
                    Ok(Err(extraction_error)) => {
                        let error_msg = format!(
                            "Failed to deserialize JSON return value: {}",
                            extraction_error
                        );
                        let _ = tx.send(Err(BackendError::GenericError(error_msg)));
                    }
                    Err(_) => {
                        let _ = tx.send(Err(BackendError::GenericError(
                            "JavaScript exception during JSON deserialization".to_string(),
                        )));
                    }
                }
            }
            Ok(())
        });

        match rx.recv() {
            Ok(result) => result,
            Err(_) => Err(BackendError::GenericError(
                "Tool execution was cancelled or failed".to_string(),
            )),
        }
    }

    pub fn has_tool(&self, tool_name: &ToolName) -> bool {
        if let Ok(tools) = self.tools.read() {
            tools.contains_key(tool_name)
        } else {
            false
        }
    }
}
