use crate::{
    api::message::{AppMessage, TunnelOneshot},
    store::models::{current_time, random_uuid, App},
    worker::{send_worker_response, Worker},
    BackendResult,
};

impl Worker {
    pub fn store_app(
        &mut self,
        app_type: &str,
        content: &str,
        name: &Option<String>,
        icon: &Option<String>,
        meta: &Option<String>,
    ) -> BackendResult<()> {
        let app_id = random_uuid();
        let current_time = current_time();
        let app = App {
            id: app_id,
            app_type: app_type.to_owned(),
            content: content.to_owned(),
            created_at: current_time,
            updated_at: current_time,
            name: name.to_owned(),
            icon: icon.to_owned(),
            meta: meta.to_owned(),
        };
        self.db.create_app(&app)?;
        Ok(())
    }

    pub fn list_apps(&self) -> BackendResult<Vec<App>> {
        self.db.list_apps()
    }

    pub fn update_app_content(&mut self, app_id: &str, content: &str) -> BackendResult<()> {
        self.db.update_app_content(app_id, content)?;
        Ok(())
    }

    pub fn delete_app(&mut self, app_id: &str) -> BackendResult<()> {
        self.db.delete_app(app_id)?;
        Ok(())
    }
}

#[tracing::instrument(level = "trace", skip(worker, oneshot))]
pub fn handle_app_message(
    worker: &mut Worker,
    oneshot: Option<TunnelOneshot>,
    message: AppMessage,
) {
    match message {
        AppMessage::ListAppsMessage => {
            let result = worker.list_apps();
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        AppMessage::StoreAppMessage {
            app_type,
            content,
            name,
            icon,
            meta,
        } => {
            let result = worker.store_app(&app_type, &content, &name, &icon, &meta);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        AppMessage::UpdateAppContentMessage(app_id, content) => {
            let result = worker.update_app_content(&app_id, &content);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        AppMessage::DeleteAppMessage(app_id) => {
            let result = worker.delete_app(&app_id);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
    }
}
