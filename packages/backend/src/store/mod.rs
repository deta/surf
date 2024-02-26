pub mod db;
pub mod models;

use crate::backend::{message::WorkerMessage, tunnel::WorkerTunnel};
use neon::prelude::*;

const _MODULE_PREFIX: &'static str = "store";

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    cx.export_function("js__store_create_resource", js_create_resource)?;
    cx.export_function("js__store_list_horizons", js_list_horizons)?;
    cx.export_function("js__store_create_horizon", js_create_horizon)?;
    cx.export_function("js__store_update_horizon_name", js_create_horizon)?;
    cx.export_function("js__store_remove_horizon", js_remove_horizon)?;
    cx.export_function("js__store_list_cards_in_horizon", js_list_cards_in_horizon)?;
    cx.export_function("js__store_get_card", js_get_card)?;
    cx.export_function(
        "js__store_update_card_resource_id",
        js_update_card_resource_id,
    )?;
    cx.export_function(
        "js__store_update_card_dimensions",
        js_update_card_dimensions,
    )?;
    cx.export_function(
        "js__store_update_card_stacking_order",
        js_update_card_stacking_order,
    )?;
    cx.export_function("js__store_remove_card", js_remove_card)?;
    cx.export_function("js__store_create_userdata", js_create_userdata)?;
    cx.export_function(
        "js__store_get_userdata_by_user_id",
        js_get_userdata_by_user_id,
    )?;
    cx.export_function("js__store_remove_userdata", js_remove_userdata)?;
    cx.export_function("js__store_read_resource", js_read_resource)?;
    // cx.export_function("js__store_update_resource", js_update_resource)?;
    cx.export_function("js__store_delete_resource", js_delete_resource)?;
    cx.export_function("js__store_recover_resource", js_recover_resource)?;
    cx.export_function("js__store_search_resource", js_search_resources)?;
    Ok(())
}

fn js_create_resource(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let resource_type = cx.argument::<JsString>(1)?.value(&mut cx);
    let resource_tags_json = cx
        .argument_opt(2)
        .and_then(|arg| arg.downcast::<JsString, FunctionContext>(&mut cx).ok())
        .map(|js_string| js_string.value(&mut cx));
    let resource_metadata_json = cx
        .argument_opt(3)
        .and_then(|arg| arg.downcast::<JsString, FunctionContext>(&mut cx).ok())
        .map(|js_string| js_string.value(&mut cx));

    let resource_tags: Option<Vec<models::ResourceTag>> = match resource_tags_json
        .map(|json_str| serde_json::from_str(&json_str))
        .transpose()
    {
        Ok(tags) => tags,
        Err(err) => return cx.throw_error(&err.to_string()),
    };
    let resource_metadata: Option<models::ResourceMetadata> = match resource_metadata_json
        .map(|json_str| serde_json::from_str(&json_str))
        .transpose()
    {
        Ok(meta) => meta,
        Err(err) => return cx.throw_error(&err.to_string()),
    };

    let (deferred, promise) = cx.promise();
    tunnel.send(
        WorkerMessage::CreateResource {
            resource_type,
            resource_tags,
            resource_metadata,
        },
        deferred,
    );

    Ok(promise)
}

fn js_read_resource(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.send(WorkerMessage::ReadResource(resource_id), deferred);

    Ok(promise)
}

// fn js_update_resource(mut cx: FunctionContext) -> JsResult<JsPromise> {}

fn js_delete_resource(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.send(WorkerMessage::DeleteResource(resource_id), deferred);

    Ok(promise)
}

fn js_recover_resource(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.send(WorkerMessage::RecoverResource(resource_id), deferred);

    Ok(promise)
}

fn js_list_horizons(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let (deferred, promise) = cx.promise();
    tunnel.send(WorkerMessage::ListHorizons(), deferred);

    Ok(promise)
}

fn js_create_horizon(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let horizon_name = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.send(WorkerMessage::CreateHorizon(horizon_name), deferred);

    Ok(promise)
}

fn js_remove_horizon(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let horizon_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.send(WorkerMessage::RemoveHorizon(horizon_id), deferred);

    Ok(promise)
}

fn js_list_cards_in_horizon(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let horizon_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.send(WorkerMessage::ListCardsInHorizon(horizon_id), deferred);

    Ok(promise)
}

fn js_get_card(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let card_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.send(WorkerMessage::GetCard(card_id), deferred);

    Ok(promise)
}

fn js_update_card_resource_id(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let card_id = cx.argument::<JsString>(1)?.value(&mut cx);
    let resource_id = cx.argument::<JsString>(2)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.send(
        WorkerMessage::UpdateCardResourceID(card_id, resource_id),
        deferred,
    );

    Ok(promise)
}

fn js_search_resources(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let query = cx.argument::<JsString>(1)?.value(&mut cx);
    let resource_tags_json = cx
        .argument_opt(2)
        .and_then(|arg| arg.downcast::<JsString, FunctionContext>(&mut cx).ok())
        .map(|js_string| js_string.value(&mut cx));
    let resource_tags: Option<Vec<models::ResourceTag>> = match resource_tags_json
        .map(|json_str| serde_json::from_str(&json_str))
        .transpose()
    {
        Ok(tags) => tags,
        Err(err) => return cx.throw_error(&err.to_string()),
    };

    let (deferred, promise) = cx.promise();
    tunnel.send(
        WorkerMessage::SearchResources {
            query,
            resource_tags,
        },
        deferred,
    );

    Ok(promise)
}

fn js_update_card_dimensions(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let card_id = cx.argument::<JsString>(1)?.value(&mut cx);
    let position_x = cx.argument::<JsNumber>(2)?.value(&mut cx) as i64;
    let position_y = cx.argument::<JsNumber>(3)?.value(&mut cx) as i64;
    let width = cx.argument::<JsNumber>(4)?.value(&mut cx) as i32;
    let height = cx.argument::<JsNumber>(5)?.value(&mut cx) as i32;

    let (deferred, promise) = cx.promise();
    tunnel.send(
        WorkerMessage::UpdateCardDimensions(card_id, position_x, position_y, width, height),
        deferred,
    );

    Ok(promise)
}

fn js_update_card_stacking_order(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let card_id = cx.argument::<JsString>(1)?.value(&mut cx);
    let stacking_order = cx.argument::<JsString>(2)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.send(
        WorkerMessage::UpdateCardStackingOrder(card_id, stacking_order),
        deferred,
    );

    Ok(promise)
}

fn js_remove_card(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let card_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.send(WorkerMessage::RemoveCard(card_id), deferred);

    Ok(promise)
}

fn js_create_userdata(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let user_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.send(WorkerMessage::CreateUserdata(user_id), deferred);

    Ok(promise)
}

fn js_get_userdata_by_user_id(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let user_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.send(WorkerMessage::GetUserdataByUserId(user_id), deferred);

    Ok(promise)
}

fn js_remove_userdata(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let user_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.send(WorkerMessage::RemoveUserdata(user_id), deferred);

    Ok(promise)
}
