use crate::{
    api::message::{DeleteSpaceEntryInput, SpaceEntryInput, SpaceMessage, TunnelOneshot},
    store::{
        db::Database,
        models::{
            current_time, random_uuid, SearchResultSpaceItem, Space, SpaceEntry,
            SpaceEntryExtended, SpaceEntryType, SpaceExtended, SubSpaceEntry,
        },
    },
    worker::{send_worker_response, Worker},
    BackendResult,
};

impl Worker {
    pub fn create_space(&mut self, name: &str) -> BackendResult<Space> {
        let space_id = random_uuid();
        let current_time = current_time();
        let space = Space {
            id: space_id,
            name: name.to_owned(),
            created_at: current_time,
            updated_at: current_time,
        };
        self.db.create_space(&space)?;
        Ok(space)
    }

    pub fn get_space(&self, space_id: &str) -> BackendResult<Option<SpaceExtended>> {
        self.db.get_space(space_id)
    }

    pub fn search_spaces(&self, query: &str) -> BackendResult<Vec<SearchResultSpaceItem>> {
        self.db.search_spaces(query)
    }

    pub fn list_spaces(&self) -> BackendResult<Vec<SpaceExtended>> {
        self.db.list_spaces()
    }

    pub fn update_space_name(&mut self, space_id: String, name: String) -> BackendResult<()> {
        self.db.update_space_name(&space_id, &name)?;
        Ok(())
    }

    pub fn delete_space(&mut self, space_id: &str) -> BackendResult<()> {
        self.db.delete_space(space_id)?;
        Ok(())
    }

    pub fn create_space_entries(
        &mut self,
        space_id: String,
        entries: Vec<SpaceEntryInput>,
    ) -> BackendResult<Vec<SpaceEntryExtended>> {
        let current_time = current_time();
        let mut space_entries = Vec::new();
        let mut tx = self.db.begin()?;
        for entry in entries {
            match entry.entry_type {
                SpaceEntryType::Resource => {
                    if entry.manually_added == 1 {
                        Database::delete_space_entry_by_resource_id_tx(
                            &mut tx,
                            &space_id,
                            &entry.entry_id,
                        )?;
                    }
                    let space_entry = SpaceEntry {
                        id: random_uuid(),
                        space_id: space_id.clone(),
                        resource_id: entry.entry_id,
                        created_at: current_time,
                        updated_at: current_time,
                        manually_added: entry.manually_added,
                    };
                    Database::create_space_entry_tx(&mut tx, &space_entry)?;
                    space_entries.push(SpaceEntryExtended {
                        id: space_entry.id.clone(),
                        space_id: space_entry.space_id.clone(),
                        created_at: space_entry.created_at,
                        updated_at: space_entry.updated_at,
                        manually_added: space_entry.manually_added,
                        entry_type: SpaceEntryType::Resource,
                        entry_id: space_entry.resource_id.clone(),
                        resource_type: None,
                    });
                }
                SpaceEntryType::Space => {
                    let sub_space_entry = SubSpaceEntry {
                        id: random_uuid(),
                        parent_space_id: space_id.clone(),
                        child_space_id: entry.entry_id,
                        created_at: current_time,
                        updated_at: current_time,
                        manually_added: entry.manually_added,
                    };
                    Database::create_sub_space_entry_tx(&mut tx, &sub_space_entry)?;
                    space_entries.push(SpaceEntryExtended {
                        id: sub_space_entry.id.clone(),
                        space_id: sub_space_entry.parent_space_id.clone(),
                        created_at: sub_space_entry.created_at,
                        updated_at: sub_space_entry.updated_at,
                        manually_added: sub_space_entry.manually_added,
                        entry_type: SpaceEntryType::Space,
                        entry_id: sub_space_entry.child_space_id.clone(),
                        resource_type: None,
                    });
                }
            }
        }
        tx.commit()?;
        Ok(space_entries)
    }

    pub fn get_space_entries(
        &self,
        space_id: &str,
        sort_by: Option<&str>,
        order_by: Option<&str>,
        limit: Option<usize>,
    ) -> BackendResult<Vec<SpaceEntryExtended>> {
        self.db
            .list_space_entries(space_id, sort_by, order_by, limit)
    }

    pub fn delete_space_entries(
        &mut self,
        entries: Vec<DeleteSpaceEntryInput>,
    ) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        for entry in entries {
            match entry.entry_type {
                SpaceEntryType::Resource => {
                    Database::delete_space_entry_tx(&mut tx, &entry.id)?;
                }
                SpaceEntryType::Space => {
                    Database::delete_sub_space_entry_tx(&mut tx, &entry.id)?;
                }
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn delete_entries_in_space(
        &mut self,
        space_id: &str,
        entry_ids: &[String],
        entry_type: SpaceEntryType,
    ) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        match entry_type {
            SpaceEntryType::Resource => {
                Database::delete_space_entries_in_space_tx(&mut tx, space_id, entry_ids)?
            }
            SpaceEntryType::Space => {
                Database::delete_sub_space_entries_in_space_tx(&mut tx, space_id, entry_ids)?
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn update_sub_space_parent_id(
        &mut self,
        space_id: &str,
        new_parent_space_id: &str,
    ) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_sub_space_entry_parent_id_tx(&mut tx, space_id, new_parent_space_id)?;
        tx.commit()?;
        Ok(())
    }
}

#[tracing::instrument(level = "trace", skip(worker, oneshot))]
pub fn handle_space_message(
    worker: &mut Worker,
    oneshot: Option<TunnelOneshot>,
    message: SpaceMessage,
) {
    match message {
        SpaceMessage::CreateSpace { name } => {
            let result = worker.create_space(&name);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        SpaceMessage::GetSpace(space_id) => {
            let result = worker.get_space(&space_id);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        SpaceMessage::SearchSpace { query } => {
            let result = worker.search_spaces(&query);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        SpaceMessage::ListSpaces => {
            let result = worker.list_spaces();
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        SpaceMessage::UpdateSpace { space_id, name } => {
            let result = worker.update_space_name(space_id, name);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        SpaceMessage::DeleteSpace(space_id) => {
            let result = worker.delete_space(&space_id);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        SpaceMessage::CreateSpaceEntries { entries, space_id } => {
            let result = worker.create_space_entries(space_id, entries);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        SpaceMessage::GetSpaceEntries {
            space_id,
            sort_by,
            order_by,
            limit,
        } => {
            let result =
                worker.get_space_entries(&space_id, sort_by.as_deref(), order_by.as_deref(), limit);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        SpaceMessage::DeleteSpaceEntries(entries) => {
            let result = worker.delete_space_entries(entries);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        SpaceMessage::MoveSpace {
            space_id,
            new_parent_space_id,
        } => {
            let result = worker.update_sub_space_parent_id(&space_id, &new_parent_space_id);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        SpaceMessage::DeleteEntriesInSpaceByEntryIds {
            space_id,
            entry_ids,
            entry_type,
        } => {
            let result = worker.delete_entries_in_space(&space_id, &entry_ids, entry_type);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
    }
}
