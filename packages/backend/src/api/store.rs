use super::{message::*, parse_json_argument};
use crate::{store::models, worker::tunnel::WorkerTunnel};
use neon::prelude::*;
use neon::types::JsDate;

pub fn register_exported_functions(cx: &mut ModuleContext) -> NeonResult<()> {
    cx.export_function("js__store_create_resource", js_create_resource)?;
    cx.export_function("js__store_get_resource", js_get_resource)?;
    // cx.export_function("js__store_update_resource", js_update_resource)?;
    cx.export_function("js__store_remove_resources", js_remove_resources)?;
    cx.export_function(
        "js__store_remove_resources_by_tags",
        js_remove_resources_by_tags,
    )?;
    cx.export_function("js__store_recover_resource", js_recover_resource)?;
    cx.export_function("js__store_search_resources", js_search_resources)?;
    cx.export_function(
        "js__store_list_resources_by_tags",
        js_list_resources_by_tags,
    )?;
    cx.export_function(
        "js__store_list_all_resources_and_spaces",
        js_list_all_resources_and_spaces,
    )?;
    cx.export_function("js__store_resource_post_process", js_resource_post_process)?;
    cx.export_function("js__store_update_resource", js_update_resource)?;
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
        "js__store_remove_all_history_entries",
        js_remove_all_history_entries,
    )?;
    cx.export_function(
        "js__store_get_all_history_entries",
        js_get_all_history_entries,
    )?;
    cx.export_function(
        "js__store_search_history_entries_by_hostname_prefix",
        js_search_history_entries_by_hostname_prefix,
    )?;
    cx.export_function(
        "js__store_search_history_entries_by_hostname",
        js_search_history_entries_by_hostname,
    )?;
    cx.export_function(
        "js__store_search_history_entries_by_url_and_title",
        js_search_history_entries_by_url_and_title,
    )?;
    cx.export_function(
        "js__store_import_browser_history",
        js_import_browser_history,
    )?;
    cx.export_function(
        "js__store_import_browser_bookmarks",
        js_import_browser_bookmarks,
    )?;

    cx.export_function("js__store_create_ai_chat", js_create_ai_chat)?;
    cx.export_function("js__store_update_ai_chat", js_update_ai_chat)?;
    cx.export_function("js__store_list_ai_chats", js_list_ai_chats)?;
    cx.export_function("js__store_search_ai_chats", js_search_ai_chats)?;
    cx.export_function("js__store_get_ai_chat", js_get_ai_chat)?;
    cx.export_function("js__store_remove_ai_chat", js_remove_ai_chat)?;

    cx.export_function("js__store_create_space", js_create_space)?;
    cx.export_function("js__store_get_space", js_get_space)?;
    cx.export_function("js__store_list_spaces", js_list_spaces)?;
    cx.export_function("js__store_search_spaces", js_search_spaces)?;
    cx.export_function("js__store_update_space", js_update_space)?;
    cx.export_function("js__store_delete_space", js_delete_space)?;
    cx.export_function("js__store_create_space_entries", js_create_space_entries)?;
    cx.export_function("js__store_get_space_entries", js_get_space_entries)?;
    cx.export_function("js__store_delete_space_entries", js_delete_space_entries)?;
    cx.export_function(
        "js__store_delete_entries_in_space_by_entry_ids",
        js_delete_entries_in_space_by_entry_ids,
    )?;
    cx.export_function("js__store_move_space", js_move_space)?;

    cx.export_function("js__store_upsert_resource_hash", js_upsert_resource_hash)?;
    cx.export_function("js__store_get_resource_hash", js_get_resource_hash)?;
    cx.export_function("js__store_delete_resource_hash", js_delete_resource_hash)?;

    cx.export_function("js__store_create_app", js_create_app)?;
    cx.export_function("js__store_delete_app", js_delete_app)?;
    cx.export_function("js__store_list_apps", js_list_apps)?;
    cx.export_function("js__store_update_app_content", js_update_app_content)?;

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

fn js_search_spaces(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let query = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::SpaceMessage(SpaceMessage::SearchSpace { query }),
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
            let entry_id = obj
                .get_value::<FunctionContext, &str>(&mut cx, "entry_id")?
                .downcast_or_throw::<JsString, FunctionContext>(&mut cx)?
                .value(&mut cx);
            let entry_type = obj
                .get_value::<FunctionContext, &str>(&mut cx, "entry_type")?
                .downcast_or_throw::<JsString, FunctionContext>(&mut cx)?
                .value(&mut cx);
            let entry_type = match entry_type.parse::<models::SpaceEntryType>() {
                Ok(entry_type) => entry_type,
                Err(err) => return cx.throw_error(err.to_string()),
            };

            let manually_added = obj
                .get_value::<FunctionContext, &str>(&mut cx, "manually_added")?
                .downcast_or_throw::<JsNumber, FunctionContext>(&mut cx)?
                .value(&mut cx) as i32;
            Ok(SpaceEntryInput {
                entry_id,
                entry_type,
                manually_added,
            })
        })
        .collect::<NeonResult<Vec<SpaceEntryInput>>>()?;

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
    let sort_by = cx.argument_opt(2).and_then(|arg| {
        arg.downcast::<JsString, FunctionContext>(&mut cx)
            .ok()
            .map(|js_string| js_string.value(&mut cx))
    });
    let order_by = cx.argument_opt(3).and_then(|arg| {
        arg.downcast::<JsString, FunctionContext>(&mut cx)
            .ok()
            .map(|js_string| js_string.value(&mut cx))
    });
    let limit = cx.argument_opt(4).and_then(|arg| {
        arg.downcast::<JsNumber, FunctionContext>(&mut cx)
            .ok()
            .map(|js_number| js_number.value(&mut cx) as usize)
    });

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::SpaceMessage(SpaceMessage::GetSpaceEntries {
            space_id,
            sort_by,
            order_by,
            limit,
        }),
        deferred,
    );

    Ok(promise)
}

fn js_delete_space_entries(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let entries = cx.argument::<JsArray>(2)?.to_vec(&mut cx)?;
    let entries = entries
        .iter()
        .map(|entry| {
            let obj = entry.downcast_or_throw::<JsObject, FunctionContext>(&mut cx)?;
            let id = obj
                .get_value::<FunctionContext, &str>(&mut cx, "id")?
                .downcast_or_throw::<JsString, FunctionContext>(&mut cx)?
                .value(&mut cx);
            let entry_type = obj
                .get_value::<FunctionContext, &str>(&mut cx, "entry_type")?
                .downcast_or_throw::<JsString, FunctionContext>(&mut cx)?
                .value(&mut cx);
            let entry_type = match entry_type.parse::<models::SpaceEntryType>() {
                Ok(entry_type) => entry_type,
                Err(err) => return cx.throw_error(err.to_string()),
            };
            Ok(DeleteSpaceEntryInput { id, entry_type })
        })
        .collect::<NeonResult<Vec<DeleteSpaceEntryInput>>>()?;

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::SpaceMessage(SpaceMessage::DeleteSpaceEntries(entries)),
        deferred,
    );

    Ok(promise)
}

fn js_delete_entries_in_space_by_entry_ids(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let space_id = cx.argument::<JsString>(1)?.value(&mut cx);

    let entry_ids = cx.argument::<JsArray>(2)?.to_vec(&mut cx)?;
    let entry_ids = entry_ids
        .iter()
        .map(|value| {
            Ok(value
                .downcast_or_throw::<JsString, FunctionContext>(&mut cx)?
                .value(&mut cx))
        })
        .collect::<NeonResult<Vec<String>>>()?;

    let entry_type = cx.argument::<JsString>(3)?.value(&mut cx);
    let entry_type = match entry_type.parse::<models::SpaceEntryType>() {
        Ok(entry_type) => entry_type,
        Err(err) => return cx.throw_error(err.to_string()),
    };

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::SpaceMessage(SpaceMessage::DeleteEntriesInSpaceByEntryIds {
            space_id,
            entry_ids,
            entry_type,
        }),
        deferred,
    );

    Ok(promise)
}

fn js_move_space(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let space_id = cx.argument::<JsString>(1)?.value(&mut cx);
    let new_parent_space_id = cx.argument::<JsString>(2)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::SpaceMessage(SpaceMessage::MoveSpace {
            space_id,
            new_parent_space_id,
        }),
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
        Err(err) => return cx.throw_error(err.to_string()),
    };
    let resource_metadata: Option<models::ResourceMetadata> = match resource_metadata_json
        .map(|json_str| serde_json::from_str(&json_str))
        .transpose()
    {
        Ok(meta) => meta,
        Err(err) => return cx.throw_error(err.to_string()),
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

fn js_remove_resources(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_ids = cx.argument::<JsArray>(1)?.to_vec(&mut cx)?;
    let resource_ids = resource_ids
        .iter()
        .map(|value| {
            Ok(value
                .downcast_or_throw::<JsString, FunctionContext>(&mut cx)?
                .value(&mut cx))
        })
        .collect::<NeonResult<Vec<String>>>()?;

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::RemoveResources(resource_ids)),
        deferred,
    );

    Ok(promise)
}

fn js_remove_resources_by_tags(mut cx: FunctionContext) -> JsResult<JsPromise> {
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
        Err(err) => return cx.throw_error(err.to_string()),
    };
    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::RemoveResourcesByTags(resource_tags)),
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

fn js_list_resources_by_tags(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;

    let resource_tags: Vec<models::ResourceTagFilter> =
        match parse_json_argument(&mut cx, 1, "Resource tags") {
            Ok(tags) => tags,
            Err(err) => return cx.throw_error(err),
        };

    let pagination_params: models::PaginationParams =
        match parse_json_argument(&mut cx, 2, "Pagination parameters") {
            Ok(params) => params,
            Err(err) => return cx.throw_error(err),
        };

    // None = no space filter, Some("") = no space, Some(id) = specific space
    let space_id = cx.argument_opt(3).and_then(|arg| {
        arg.downcast::<JsString, FunctionContext>(&mut cx)
            .ok()
            .map(|js_string| js_string.value(&mut cx))
    });

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::ListResourcesByTags(
            resource_tags,
            pagination_params,
            space_id,
        )),
        deferred,
    );

    Ok(promise)
}

fn js_list_all_resources_and_spaces(mut cx: FunctionContext) -> JsResult<JsPromise> {
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
        Err(err) => return cx.throw_error(err.to_string()),
    };

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::ListAllResourcesAndSpaces(resource_tags)),
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
        Err(err) => return cx.throw_error(err.to_string()),
    };
    let semantic_search_enabled = cx.argument_opt(3).and_then(|arg| {
        arg.downcast::<JsBoolean, FunctionContext>(&mut cx)
            .ok()
            .map(|js_boolean| js_boolean.value(&mut cx))
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
    let space_id = cx.argument_opt(6).and_then(|arg| {
        arg.downcast::<JsString, FunctionContext>(&mut cx)
            .ok()
            .map(|js_string| js_string.value(&mut cx))
    });

    let keyword_limit = cx.argument_opt(7).and_then(|arg| {
        arg.downcast::<JsNumber, FunctionContext>(&mut cx)
            .ok()
            .map(|js_number| js_number.value(&mut cx) as i64)
    });

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::ResourceMessage(ResourceMessage::SearchResources(
            models::SearchResourcesParams {
                query,
                resource_tag_filters,
                semantic_search_enabled,
                embeddings_distance_threshold,
                embeddings_limit,
                space_id,
                keyword_limit,
            },
        )),
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

fn js_create_history_entry(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let entry_json = cx.argument::<JsString>(1)?.value(&mut cx);

    let entry: models::HistoryEntry = match serde_json::from_str(&entry_json) {
        Ok(entry) => entry,
        Err(err) => return cx.throw_error(err.to_string()),
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
        Err(err) => return cx.throw_error(err.to_string()),
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

fn js_remove_all_history_entries(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HistoryMessage(HistoryMessage::RemoveAllHistoryEntries),
        deferred,
    );
    Ok(promise)
}

fn js_get_all_history_entries(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let limit = cx.argument_opt(1).and_then(|arg| {
        arg.downcast::<JsNumber, FunctionContext>(&mut cx)
            .ok()
            .map(|js_number| js_number.value(&mut cx) as usize)
    });

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HistoryMessage(HistoryMessage::GetAllHistoryEntries(limit)),
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
            .map(|js_date| js_date.value(&mut cx))
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

fn js_search_history_entries_by_hostname(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let url = cx.argument::<JsString>(1)?.value(&mut cx);
    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HistoryMessage(HistoryMessage::SearchHistoryEntriesByHostname(url)),
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
            .map(|js_date| js_date.value(&mut cx))
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

fn js_import_browser_history(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let browser_type = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HistoryMessage(HistoryMessage::ImportBrowserHistory(browser_type)),
        deferred,
    );

    Ok(promise)
}

fn js_import_browser_bookmarks(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let browser_type = cx.argument::<JsString>(1)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::HistoryMessage(HistoryMessage::ImportBrowserBookmarks(browser_type)),
        deferred,
    );

    Ok(promise)
}

fn js_update_resource(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let resource_json = cx.argument::<JsString>(1)?.value(&mut cx);

    let resource: models::Resource = match serde_json::from_str(&resource_json) {
        Ok(resource) => resource,
        Err(err) => return cx.throw_error(err.to_string()),
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
        Err(err) => return cx.throw_error(err.to_string()),
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
        Err(err) => return cx.throw_error(err.to_string()),
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
        Err(err) => return cx.throw_error(err.to_string()),
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

    let title = cx.argument::<JsString>(2)?.value(&mut cx);

    let system_prompt = match system_prompt {
        Some(prompt) => prompt,
        None => "".to_string(),
    };

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::CreateAIChatMessage(system_prompt, title)),
        deferred,
    );
    Ok(promise)
}

fn js_update_ai_chat(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let session_id = cx.argument::<JsString>(1)?.value(&mut cx);
    let title = cx.argument::<JsString>(2)?.value(&mut cx);

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::UpdateAIChatMessage(session_id, title)),
        deferred,
    );
    Ok(promise)
}

fn js_list_ai_chats(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let limit = cx.argument_opt(1).and_then(|arg| {
        arg.downcast::<JsNumber, FunctionContext>(&mut cx)
            .ok()
            .map(|js_number| js_number.value(&mut cx) as i64)
    });

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::ListAIChats(limit)),
        deferred,
    );
    Ok(promise)
}

fn js_search_ai_chats(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let search = cx.argument::<JsString>(1)?.value(&mut cx);
    let limit = cx.argument_opt(2).and_then(|arg| {
        arg.downcast::<JsNumber, FunctionContext>(&mut cx)
            .ok()
            .map(|js_number| js_number.value(&mut cx) as i64)
    });

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::MiscMessage(MiscMessage::SearchAIChats(search, limit)),
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

fn js_create_app(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let app_type = cx.argument::<JsString>(1)?.value(&mut cx);
    let content = cx.argument::<JsString>(2)?.value(&mut cx);
    let name = cx.argument_opt(3).and_then(|arg| {
        arg.downcast::<JsString, FunctionContext>(&mut cx)
            .ok()
            .map(|js_string| js_string.value(&mut cx))
    });
    let icon = cx.argument_opt(4).and_then(|arg| {
        arg.downcast::<JsString, FunctionContext>(&mut cx)
            .ok()
            .map(|js_string| js_string.value(&mut cx))
    });
    let meta = cx.argument_opt(5).and_then(|arg| {
        arg.downcast::<JsString, FunctionContext>(&mut cx)
            .ok()
            .map(|js_string| js_string.value(&mut cx))
    });

    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::AppMessage(AppMessage::StoreAppMessage {
            app_type,
            content,
            name,
            icon,
            meta,
        }),
        deferred,
    );
    Ok(promise)
}

fn js_delete_app(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let app_id = cx.argument::<JsString>(1)?.value(&mut cx);
    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::AppMessage(AppMessage::DeleteAppMessage(app_id)),
        deferred,
    );
    Ok(promise)
}

fn js_list_apps(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::AppMessage(AppMessage::ListAppsMessage),
        deferred,
    );
    Ok(promise)
}

fn js_update_app_content(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let tunnel = cx.argument::<JsBox<WorkerTunnel>>(0)?;
    let app_id = cx.argument::<JsString>(1)?.value(&mut cx);
    let content = cx.argument::<JsString>(2)?.value(&mut cx);
    let (deferred, promise) = cx.promise();
    tunnel.worker_send_js(
        WorkerMessage::AppMessage(AppMessage::UpdateAppContentMessage(app_id, content)),
        deferred,
    );
    Ok(promise)
}
