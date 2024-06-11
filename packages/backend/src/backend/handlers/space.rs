use crate::{
    backend::{
        message::{CreateSpaceEntryInput, SpaceMessage, TunnelOneshot},
        worker::{send_worker_response, Worker},
    },
    store::{
        db::Database,
        models::{current_time, random_uuid, Space, SpaceEntry},
    },
    BackendResult,
};
use neon::prelude::Channel;

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

    pub fn get_space(&self, space_id: &str) -> BackendResult<Option<Space>> {
        self.db.get_space(space_id)
    }

    pub fn list_spaces(&self) -> BackendResult<Vec<Space>> {
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
        entries: Vec<CreateSpaceEntryInput>,
    ) -> BackendResult<Vec<SpaceEntry>> {
        let current_time = current_time();
        let mut space_entries = Vec::new();
        let mut tx = self.db.begin()?;
        for entry in entries {
            let space_entry = SpaceEntry {
                id: random_uuid(),
                space_id: space_id.clone(),
                resource_id: entry.resource_id,
                created_at: current_time,
                updated_at: current_time,
                manually_added: entry.manually_added as i32,
            };
            Database::create_space_entry_tx(&mut tx, &space_entry)?;
            space_entries.push(space_entry);
        }
        tx.commit()?;
        Ok(space_entries)
    }

    pub fn get_space_entries(&self, space_id: &str) -> BackendResult<Vec<SpaceEntry>> {
        self.db.list_space_entries(space_id)
    }

    pub fn delete_space_entries(&mut self, entry_ids: Vec<String>) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        for entry_id in entry_ids {
            Database::delete_space_entry_tx(&mut tx, &entry_id)?;
        }
        tx.commit()?;
        Ok(())
    }
}

pub fn handle_space_message(
    worker: &mut Worker,
    channel: &mut Channel,
    oneshot: Option<TunnelOneshot>,
    message: SpaceMessage,
) {
    match message {
        SpaceMessage::CreateSpace { name } => {
            send_worker_response(channel, oneshot, worker.create_space(&name))
        }
        SpaceMessage::GetSpace(space_id) => {
            send_worker_response(channel, oneshot, worker.get_space(&space_id))
        }
        SpaceMessage::ListSpaces => send_worker_response(channel, oneshot, worker.list_spaces()),
        SpaceMessage::UpdateSpace { space_id, name } => {
            send_worker_response(channel, oneshot, worker.update_space_name(space_id, name))
        }
        SpaceMessage::DeleteSpace(space_id) => {
            send_worker_response(channel, oneshot, worker.delete_space(&space_id))
        }
        SpaceMessage::CreateSpaceEntries { entries, space_id } => send_worker_response(
            channel,
            oneshot,
            worker.create_space_entries(space_id, entries),
        ),
        SpaceMessage::GetSpaceEntries { space_id } => {
            send_worker_response(channel, oneshot, worker.get_space_entries(&space_id))
        }
        SpaceMessage::DeleteSpaceEntries(entry_ids) => {
            send_worker_response(channel, oneshot, worker.delete_space_entries(entry_ids))
        }
    }
}
