pub mod message;

mod ai;
mod kv;
mod store;
mod worker;

use neon::prelude::*;

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    ai::register_exported_functions(cx)?;
    worker::register_exported_functions(cx)?;
    store::register_exported_functions(cx)?;
    kv::register_exported_functions(cx)?;
    Ok(())
}

pub fn parse_json_argument<T: serde::de::DeserializeOwned>(
    cx: &mut FunctionContext,
    arg_index: usize,
    arg_name: &str,
) -> Result<T, String> {
    let json_string = cx
        .argument_opt(arg_index)
        .and_then(|arg| arg.downcast::<JsString, FunctionContext>(cx).ok())
        .map(|js_string| js_string.value(cx));

    match json_string
        .map(|json_str| serde_json::from_str(&json_str))
        .transpose()
    {
        Ok(Some(value)) => Ok(value),
        Ok(None) => Err(format!("{} must be provided", arg_name)),
        Err(err) => Err(err.to_string()),
    }
}
