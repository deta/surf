use crate::{
    backend::{
        message::{UserdataMessage, TunnelOneshot},
        worker::{send_worker_response, Worker},
    },
    store::{db::Database, models::Userdata},
    BackendResult,
};
use neon::prelude::Channel;

impl Worker {
    pub fn create_userdata(&mut self, user_id: &str) -> BackendResult<Userdata> {
        let userdata_id = uuid::Uuid::new_v4().to_string();
        let userdata = Userdata {
            id: userdata_id,
            user_id: user_id.to_owned(),
        };
        let mut tx = self.db.begin()?;
        Database::create_userdata_tx(&mut tx, &userdata)?;
        tx.commit()?;
        Ok(userdata)
    }

    pub fn get_userdata_by_user_id(&mut self, user_id: &str) -> BackendResult<Option<Userdata>> {
        Ok(self.db.get_userdata_by_user_id(user_id)?)
    }

    pub fn remove_userdata(&mut self, user_id: &str) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::remove_userdata_tx(&mut tx, user_id)?;
        tx.commit()?;
        Ok(())
    }
}

pub fn handle_userdata_message(
    worker: &mut Worker,
    channel: &mut Channel,
    oneshot: TunnelOneshot,
    message: UserdataMessage,
) {
    match message {
        UserdataMessage::CreateUserdata(user_id) => {
            send_worker_response(channel, oneshot, worker.create_userdata(&user_id))
        }
        UserdataMessage::GetUserdataByUserId(user_id) => {
            send_worker_response(channel, oneshot, worker.get_userdata_by_user_id(&user_id))
        }
        UserdataMessage::RemoveUserdata(user_id) => {
            send_worker_response(channel, oneshot, worker.remove_userdata(&user_id))
        }
    }
}
