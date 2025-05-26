pub mod message;

mod ai;
mod store;
mod worker;

use neon::prelude::*;

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    ai::register_exported_functions(cx)?;
    worker::register_exported_functions(cx)?;
    store::register_exported_functions(cx)?;
    Ok(())
}
