pub mod db;
pub mod models;

use crate::backend::{message::*, tunnel::WorkerTunnel};
use neon::prelude::*;
use neon::types::JsDate;

const _MODULE_PREFIX: &'static str = "store";

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    cx.export_function("js__store_list_horizons", js_list_horizons)?;
    cx.export_function("js__store_create_horizon", js_create_horizon)?;
    cx.export_function("js__store_update_horizon", js_update_horizon)?;
    cx.export_function("js__store_remove_horizon", js_remove_horizon)?;

    cx.export_function("js__store_list_cards_in_horizon", js_list_cards_in_horizon)?;
    cx.export_function("js__store_get_card", js_get_card)?;
    cx.export_function("js__store_create_card", js_create_card)?;
    cx.export_function(
        "js__store_update_card_resource_id",
        js_update_card_resource_id,
    )?;
    cx.export_function("js__store_update_card_data", js_update_card_data)?;
    cx.export_function(
        "js__store_update_card_dimensions",
        js_update_card_dimensions,
    )?;
    cx.export_function(
        "js__store_update_card_stacking_order",
        js_update_card_stacking_order,
    )?;
    cx.export_function("js__store_remove_card", js_remove_card)?;
    cx.export_function(
        "js__store_list_cards_by_resource_id",
        js_list_cards_by_resource_id,
    )?;

    cx.export_function("js__store_create_userdata", js_create_userdata)?;
    cx.export_function(
        "js__store_get_userdata_by_user_id",
        js_get_userdata_by_user_id,
    )?;
    cx.export_function("js__store_remove_userdata", js_remove_userdata)?;

    cx.export_function("js__store_create_resource", js_create_resource)?;
    cx.export_function("js__store_get_resource", js_get_resource)?;
    // cx.export_function("js__store_update_resource", js_update_resource)?;
    cx.export_function("js__store_remove_resource", js_remove_resource)?;
    cx.export_function("js__store_recover_resource", js_recover_resource)?;
    cx.export_function(
        "js__store_proximity_search_resources",
        js_proximity_search_resources,
    )?;
    cx.export_function("js__store_search_resources", js_search_resources)?;
    cx.export_function(
        "js__store_list_resources_by_tags",
        js_list_resources_by_tags,
    )?;
    cx.export_function(
        "js__store_list_resources_by_tags_no_space",
        js_list_resources_by_tags_no_space,
    )?;
    cx.export_function("js__store_resource_post_process", js_resource_post_process)?;
    cx.export_function(
        "js__store_update_resource",
        js_update_resource,
    )?;
    cx.export_function(
        "js__store_update_resource_metadata",
        js_update_resource_metadata,
    )?;
    cx.export_function("js__store_create_resource_tag", js_create_resource_tag)?;
    cx.export_function(
        "js__store_remove_resource_tag_by_id",
        js_remove_resource_tag_by_id,
    )?;
    cx.export_function(
        "js__store_remove_resource_tag_by_name",
        js_remove_resource_tag_by_name,
    )?;
    cx.export_function(
        "js__store_update_resource_tag_by_name",
        js_update_resource_tag_by_name,
    )?;

    cx.export_function("js__store_create_history_entry", js_create_history_entry)?;
    cx.export_function("js__store_get_history_entry", js_get_history_entry)?;
    cx.export_function("js__store_update_history_entry", js_update_history_entry)?;
    cx.export_function("js__store_remove_history_entry", js_remove_history_entry)?;
    cx.export_function(
        "js__store_get_all_history_entries",
        js_get_all_history_entries,
    )?;
    cx.export_function(
        "js__store_search_history_entries_by_hostname_prefix",
        js_search_history_entries_by_hostname_prefix,
    )?;
    cx.export_function(
        "js__store_search_history_entries_by_url_and_title",
        js_search_history_entries_by_url_and_title,
    )?;

    cx.export_function("js__store_create_ai_chat", js_create_ai_chat)?;
    cx.export_function("js__store_get_ai_chat", js_get_ai_chat)?;
    cx.export_function("js__store_remove_ai_chat", js_remove_ai_chat)?;

    cx.export_function("js__store_create_space", js_create_space)?;
    cx.export_function("js__store_get_space", js_get_space)?;
    cx.export_function("js__store_list_spaces", js_list_spaces)?;
    cx.export_function("js__store_update_space", js_update_space)?;
    cx.export_function("js__store_delete_space", js_delete_space)?;
    cx.export_function("js__store_create_space_entries", js_create_space_entries)?;
    cx.export_function("js__store_get_space_entries", js_get_space_entries)?;
    cx.export_function("js__store_delete_space_entries", js_delete_space_entries)?;

    cx.export_function("js__store_upsert_resource_hash", js_upsert_resource_hash)?;
    cx.export_function("js__store_get_resource_hash", js_get_resource_hash)?;
    cx.export_function("js__store_delete_resource_hash", js_delete_resource_hash)?;

    Ok(())
}

fn js_create_space(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let name = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::SpaceMessage(SpaceMessage::CreateSpace { name }),
        deferred,
    );

    Ok(promise)
}

fn js_get_space(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let space_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::SpaceMessage(SpaceMessage::GetSpace(space_id)),
        deferred,
    );

    Ok(promise)
}

fn js_list_spaces(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::SpaceMessage(SpaceMessage::ListSpaces),
        deferred,
    );

    Ok(promise)
}

fn js_update_space(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let space_id = cx.argument::<JsString>(1)?.value(&mut cx);
    let name = cx.argument::<JsString>(2)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::SpaceMessage(SpaceMessage::UpdateSpace { space_id, name }),
        deferred,
    );

    Ok(promise)
}

fn js_delete_space(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let space_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::SpaceMessage(SpaceMessage::DeleteSpace(space_id)),
        deferred,
    );

    Ok(promise)
}

fn js_create_space_entries(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let space_id = cx.argument::<JsString>(1)?.value(&mut cx);
    let entries = cx.argument::<JsArray>(2)?.to_vec(&mut cx)?;

    let entries = entries
        .iter()
        .map(|entry| {
            let obj = entry.downcast_or_throw::<JsObject, FunctionContext>(&mut cx)?;
            let resource_id = obj
                .get_value::<FunctionContext, &str>(&mut cx, "resource_id")?
                .downcast_or_throw::<JsString, FunctionContext>(&mut cx)?
                .value(&mut cx);
            let manually_added = obj
                .get_value::<FunctionContext, &str>(&mut cx, "manually_added")?
                .downcast_or_throw::<JsNumber, FunctionContext>(&mut cx)?
                .value(&mut cx) as i32;
            Ok(CreateSpaceEntryInput {
                resource_id,
                manually_added,
            })
        })
        .collect::<NeonResult<Vec<CreateSpaceEntryInput>>>()?;

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::SpaceMessage(SpaceMessage::CreateSpaceEntries { space_id, entries }),
        deferred,
    );

    Ok(promise)
}

fn js_get_space_entries(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let space_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::SpaceMessage(SpaceMessage::GetSpaceEntries { space_id }),
        deferred,
    );

    Ok(promise)
}

fn js_delete_space_entries(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let entry_ids = cx.argument::<JsArray>(1)?.to_vec(&mut cx)?;

    let entry_ids = entry_ids
        .iter()
        .map(|value| {
            Ok(value
                .downcast_or_throw::<JsString, FunctionContext>(&mut cx)?
                .value(&mut cx))
        })
        .collect::<NeonResult<Vec<String>>>()?;

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::SpaceMessage(SpaceMessage::DeleteSpaceEntries(entry_ids)),
        deferred,
    );

    Ok(promise)
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
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::CreateResource {
            resource_type,
            resource_tags,
            resource_metadata,
        }),
        deferred,
    );

    Ok(promise)
}

fn js_get_resource(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_id = cx.argument::<JsString>(1)?.value(&mut cx);
    let include_annotations = cx.argument::<JsBoolean>(2)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::GetResource(
            resource_id,
            include_annotations,
        )),
        deferred,
    );

    Ok(promise)
}

fn js_remove_resource(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::RemoveResource(resource_id)),
        deferred,
    );

    Ok(promise)
}

fn js_recover_resource(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::RecoverResource(resource_id)),
        deferred,
    );

    Ok(promise)
}

fn js_list_horizons(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HorizonMessage(HorizonMessage::ListHorizons),
        deferred,
    );

    Ok(promise)
}

fn js_create_horizon(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let horizon_name = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HorizonMessage(HorizonMessage::CreateHorizon(horizon_name)),
        deferred,
    );

    Ok(promise)
}

fn js_remove_horizon(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let horizon_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HorizonMessage(HorizonMessage::RemoveHorizon(horizon_id)),
        deferred,
    );

    Ok(promise)
}

fn js_list_cards_in_horizon(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let horizon_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::CardMessage(CardMessage::ListCardsInHorizon(horizon_id)),
        deferred,
    );

    Ok(promise)
}

fn js_list_cards_by_resource_id(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::CardMessage(CardMessage::ListCardsbyResourceID(resource_id)),
        deferred,
    );

    Ok(promise)
}

fn js_get_card(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let card_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::CardMessage(CardMessage::GetCard(card_id)),
        deferred,
    );

    Ok(promise)
}

fn js_create_card(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let card_json = cx.argument::<JsString>(1)?.value(&mut cx);

    let card: models::Card = match serde_json::from_str(&card_json) {
        Ok(card) => card,
        Err(err) => return cx.throw_error(&err.to_string()),
    };

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::CardMessage(CardMessage::CreateCard(card)),
        deferred,
    );

    Ok(promise)
}

fn js_update_card_data(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let card_id = cx.argument::<JsString>(1)?.value(&mut cx);
    let data = cx
        .argument::<JsString>(2)?
        .value(&mut cx)
        .as_bytes()
        .to_vec();

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::CardMessage(CardMessage::UpdateCardData(card_id, data)),
        deferred,
    );

    Ok(promise)
}

fn js_update_card_resource_id(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let card_id = cx.argument::<JsString>(1)?.value(&mut cx);
    let resource_id = cx.argument::<JsString>(2)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::CardMessage(CardMessage::UpdateCardResourceID(card_id, resource_id)),
        deferred,
    );

    Ok(promise)
}

fn js_proximity_search_resources(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let resource_id = cx.argument::<JsString>(1)?.value(&mut cx);
    let proximity_distance_threshold = cx.argument_opt(2).and_then(|arg| {
        arg.downcast::<JsNumber, FunctionContext>(&mut cx)
            .ok()
            .map(|js_number| js_number.value(&mut cx) as f32)
    });
    let proximity_limit = cx.argument_opt(3).and_then(|arg| {
        arg.downcast::<JsNumber, FunctionContext>(&mut cx)
            .ok()
            .map(|js_number| js_number.value(&mut cx) as i64)
    });

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::ProximitySearchResources {
            resource_id,
            proximity_distance_threshold,
            proximity_limit,
        }),
        deferred,
    );

    Ok(promise)
}

fn js_list_resources_by_tags(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let resource_tags_json = cx
        .argument_opt(1)
        .and_then(|arg| arg.downcast::<JsString, FunctionContext>(&mut cx).ok())
        .map(|js_string| js_string.value(&mut cx));
    let resource_tags: Vec<models::ResourceTagFilter> = match resource_tags_json
        .map(|json_str| serde_json::from_str(&json_str))
        .transpose()
    {
        Ok(Some(tags)) => tags,
        Ok(None) => return cx.throw_error("Resource tags must be provided"),
        Err(err) => return cx.throw_error(&err.to_string()),
    };

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::ListResourcesByTags(
            resource_tags
        )),
        deferred,
    );

    Ok(promise)
}

fn js_list_resources_by_tags_no_space(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let resource_tags_json = cx
        .argument_opt(1)
        .and_then(|arg| arg.downcast::<JsString, FunctionContext>(&mut cx).ok())
        .map(|js_string| js_string.value(&mut cx));
    let resource_tags: Vec<models::ResourceTagFilter> = match resource_tags_json
        .map(|json_str| serde_json::from_str(&json_str))
        .transpose()
    {
        Ok(Some(tags)) => tags,
        Ok(None) => return cx.throw_error("Resource tags must be provided"),
        Err(err) => return cx.throw_error(&err.to_string()),
    };

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::ListResourcesByTagsNoSpace(
            resource_tags
        )),
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
    let resource_tag_filters: Option<Vec<models::ResourceTagFilter>> = match resource_tags_json
        .map(|json_str| serde_json::from_str(&json_str))
        .transpose()
    {
        Ok(tags) => tags,
        Err(err) => return cx.throw_error(&err.to_string()),
    };
    let semantic_search_enabled = cx.argument_opt(3).and_then(|arg| {
        arg.downcast::<JsBoolean, FunctionContext>(&mut cx)
            .ok()
            .map(|js_boolean| js_boolean.value(&mut cx) as bool)
    });

    let embeddings_distance_threshold = cx.argument_opt(4).and_then(|arg| {
        arg.downcast::<JsNumber, FunctionContext>(&mut cx)
            .ok()
            .map(|js_number| js_number.value(&mut cx) as f32)
    });
    let embeddings_limit = cx.argument_opt(5).and_then(|arg| {
        arg.downcast::<JsNumber, FunctionContext>(&mut cx)
            .ok()
            .map(|js_number| js_number.value(&mut cx) as i64)
    });
    let include_annotations = cx.argument_opt(6).and_then(|arg| {
        arg.downcast::<JsBoolean, FunctionContext>(&mut cx)
            .ok()
            .map(|js_boolean| js_boolean.value(&mut cx))
    });
    let space_id = cx.argument_opt(7).and_then(|arg| {
        arg.downcast::<JsString, FunctionContext>(&mut cx)
            .ok()
            .map(|js_string| js_string.value(&mut cx))
    });

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::SearchResources {
            query,
            resource_tag_filters,
            semantic_search_enabled,
            embeddings_distance_threshold,
            embeddings_limit,
            include_annotations,
            space_id,
        }),
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
    tunnel.worker_send_js(
        WorkerMessage::CardMessage(CardMessage::UpdateCardDimensions(
            card_id, position_x, position_y, width, height,
        )),
        deferred,
    );

    Ok(promise)
}

fn js_update_card_stacking_order(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let card_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::CardMessage(CardMessage::UpdateCardStackingOrder(card_id)),
        deferred,
    );

    Ok(promise)
}

fn js_remove_card(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let card_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::CardMessage(CardMessage::RemoveCard(card_id)),
        deferred,
    );

    Ok(promise)
}

fn js_create_userdata(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let user_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::UserdataMessage(UserdataMessage::CreateUserdata(user_id)),
        deferred,
    );

    Ok(promise)
}

fn js_get_userdata_by_user_id(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let user_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::UserdataMessage(UserdataMessage::GetUserdataByUserId(user_id)),
        deferred,
    );

    Ok(promise)
}

fn js_remove_userdata(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let user_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::UserdataMessage(UserdataMessage::RemoveUserdata(user_id)),
        deferred,
    );

    Ok(promise)
}

fn js_resource_post_process(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::PostProcessJob(resource_id)),
        deferred,
    );

    Ok(promise)
}

fn js_update_horizon(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let horizon_json = cx.argument::<JsString>(1)?.value(&mut cx);

    let horizon: models::Horizon = match serde_json::from_str(&horizon_json) {
        Ok(horizon) => horizon,
        Err(err) => return cx.throw_error(&err.to_string()),
    };

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HorizonMessage(HorizonMessage::UpdateHorizon(horizon)),
        deferred,
    );

    Ok(promise)
}

fn js_create_history_entry(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let entry_json = cx.argument::<JsString>(1)?.value(&mut cx);

    let entry: models::HistoryEntry = match serde_json::from_str(&entry_json) {
        Ok(entry) => entry,
        Err(err) => return cx.throw_error(&err.to_string()),
    };

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HistoryMessage(HistoryMessage::CreateHistoryEntry(entry)),
        deferred,
    );

    Ok(promise)
}

fn js_get_history_entry(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let entry_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HistoryMessage(HistoryMessage::GetHistoryEntry(entry_id)),
        deferred,
    );

    Ok(promise)
}

fn js_update_history_entry(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let entry_json = cx.argument::<JsString>(1)?.value(&mut cx);

    let entry: models::HistoryEntry = match serde_json::from_str(&entry_json) {
        Ok(entry) => entry,
        Err(err) => return cx.throw_error(&err.to_string()),
    };

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HistoryMessage(HistoryMessage::UpdateHistoryEntry(entry)),
        deferred,
    );

    Ok(promise)
}

fn js_remove_history_entry(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let entry_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HistoryMessage(HistoryMessage::RemoveHistoryEntry(entry_id)),
        deferred,
    );

    Ok(promise)
}

fn js_get_all_history_entries(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HistoryMessage(HistoryMessage::GetAllHistoryEntries),
        deferred,
    );

    Ok(promise)
}

fn js_search_history_entries_by_hostname_prefix(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let prefix = cx.argument::<JsString>(1)?.value(&mut cx);
    let since = cx.argument_opt(2).and_then(|arg| {
        arg.downcast::<JsDate, FunctionContext>(&mut cx)
            .ok()
            .map(|js_date| js_date.value(&mut cx) as f64)
    });

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HistoryMessage(HistoryMessage::SearchHistoryEntriesByHostnamePrefix(
            prefix, since,
        )),
        deferred,
    );

    Ok(promise)
}

fn js_search_history_entries_by_url_and_title(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let query = cx.argument::<JsString>(1)?.value(&mut cx);
    let since = cx.argument_opt(2).and_then(|arg| {
        arg.downcast::<JsDate, FunctionContext>(&mut cx)
            .ok()
            .map(|js_date| js_date.value(&mut cx) as f64)
    });

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HistoryMessage(HistoryMessage::SearchHistoryEntriesByUrlAndTitle(
            query, since,
        )),
        deferred,
    );

    Ok(promise)
}

fn js_update_resource(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_json = cx.argument::<JsString>(1)?.value(&mut cx);

    let resource: models::Resource = match serde_json::from_str(&resource_json) {
        Ok(resource) => resource,
        Err(err) => return cx.throw_error(&err.to_string()),
    };

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::UpdateResource(resource)),
        deferred,
    );

    Ok(promise)
}

fn js_update_resource_metadata(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let metadata_json = cx.argument::<JsString>(1)?.value(&mut cx);

    let metadata: models::ResourceMetadata = match serde_json::from_str(&metadata_json) {
        Ok(metadata) => metadata,
        Err(err) => return cx.throw_error(&err.to_string()),
    };

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::UpdateResourceMetadata(metadata)),
        deferred,
    );

    Ok(promise)
}

fn js_create_resource_tag(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let tag_json = cx.argument::<JsString>(1)?.value(&mut cx);

    let tag: models::ResourceTag = match serde_json::from_str(&tag_json) {
        Ok(tag) => tag,
        Err(err) => return cx.throw_error(&err.to_string()),
    };

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceTagMessage(ResourceTagMessage::CreateResourceTag(tag)),
        deferred,
    );

    Ok(promise)
}

fn js_remove_resource_tag_by_id(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let tag_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceTagMessage(ResourceTagMessage::RemoveResourceTag(tag_id)),
        deferred,
    );

    Ok(promise)
}

fn js_remove_resource_tag_by_name(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_id = cx.argument::<JsString>(1)?.value(&mut cx);
    let tag_name = cx.argument::<JsString>(2)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceTagMessage(ResourceTagMessage::RemoveResourceTagByName {
            resource_id,
            tag_name,
        }),
        deferred,
    );

    Ok(promise)
}

fn js_update_resource_tag_by_name(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let tag_json = cx.argument::<JsString>(1)?.value(&mut cx);

    let tag: models::ResourceTag = match serde_json::from_str(&tag_json) {
        Ok(tag) => tag,
        Err(err) => return cx.throw_error(&err.to_string()),
    };

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceTagMessage(ResourceTagMessage::UpdateResourceTag(tag)),
        deferred,
    );

    Ok(promise)
}

fn js_create_ai_chat(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let system_prompt = cx.argument_opt(1).and_then(|arg| {
        arg.downcast::<JsString, FunctionContext>(&mut cx)
            .ok()
            .map(|js_string| js_string.value(&mut cx))
    });

    let system_prompt = match system_prompt {
        Some(prompt) => prompt,
        None => "".to_string(),
    };

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::CreateAIChatMessage(system_prompt)),
        deferred,
    );
    Ok(promise)
}

fn js_remove_ai_chat(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let session_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::DeleteAIChatMessage(session_id)),
        deferred,
    );
    Ok(promise)
}

fn js_get_ai_chat(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let session_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::GetAIChatMessage(session_id)),
        deferred,
    );
    Ok(promise)
}

fn js_upsert_resource_hash(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_id = cx.argument::<JsString>(1)?.value(&mut cx);
    let hash = cx.argument::<JsString>(2)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::UpsertResourceHash { resource_id, hash }),
        deferred,
    );

    Ok(promise)
}

fn js_get_resource_hash(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::GetResourceHash(resource_id)),
        deferred,
    );

    Ok(promise)
}

fn js_delete_resource_hash(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::DeleteResourceHash(resource_id)),
        deferred,
    );

    Ok(promise)
}
