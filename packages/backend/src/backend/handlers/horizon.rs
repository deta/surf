use crate::{
    backend::{
        message::{HorizonMessage, TunnelOneshot},
        worker::{send_worker_response, Worker},
    },
    store::{
        db::Database,
        models::{default_horizon_tint, Horizon},
    },
    BackendResult,
};

use chrono::Utc;
use neon::prelude::Channel;

impl Worker {
    pub fn list_horizons(&mut self) -> BackendResult<Vec<Horizon>> {
        Ok(self.db.list_all_horizons()?)
    }

    pub fn create_horizon(&mut self, name: &str) -> BackendResult<Horizon> {
        let horizon_id = uuid::Uuid::new_v4().to_string();
        let current_time = Utc::now();
        let horizon = Horizon {
            id: horizon_id,
            horizon_name: name.to_owned(),
            icon_uri: "".to_owned(),
            tint: default_horizon_tint(),
            view_offset_x: 0,
            created_at: current_time.clone(),
            updated_at: current_time,
        };
        let mut tx = self.db.begin()?;
        Database::create_horizon_tx(&mut tx, &horizon)?;
        tx.commit()?;
        Ok(horizon)
    }

    pub fn update_horizon(&mut self, horizon: Horizon) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_horizon_tx(&mut tx, horizon)?;
        tx.commit()?;
        Ok(())
    }

    pub fn remove_horizon(&mut self, id: &str) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::remove_horizon_tx(&mut tx, id)?;
        tx.commit()?;
        Ok(())
    }
}

pub fn handle_horizon_message(
    worker: &mut Worker,
    channel: &mut Channel,
    oneshot: Option<TunnelOneshot>,
    message: HorizonMessage,
) {
    match message {
        HorizonMessage::CreateHorizon(name) => {
            send_worker_response(channel, oneshot, worker.create_horizon(&name))
        }
        HorizonMessage::ListHorizons => {
            send_worker_response(channel, oneshot, worker.list_horizons())
        }
        HorizonMessage::UpdateHorizon(horizon) => {
            send_worker_response(channel, oneshot, worker.update_horizon(horizon))
        }
        HorizonMessage::RemoveHorizon(id) => {
            send_worker_response(channel, oneshot, worker.remove_horizon(&id))
        }
    }
}
