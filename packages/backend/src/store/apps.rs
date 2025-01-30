use crate::{store::db::Database, store::models::*, BackendResult};

impl Database {
    pub fn create_app(&self, app: &App) -> BackendResult<()> {
        self.conn.execute(
            "INSERT INTO apps (id, app_type, content, created_at, updated_at, name, icon, meta) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                app.id,
                app.app_type,
                app.content,
                app.created_at,
                app.updated_at,
                app.name,
                app.icon,
                app.meta
            ],
        )?;
        Ok(())
    }

    pub fn delete_app(&self, app_id: &str) -> BackendResult<()> {
        self.conn
            .execute("DELETE FROM apps WHERE id = ?1", rusqlite::params![app_id])?;
        Ok(())
    }

    pub fn list_apps(&self) -> BackendResult<Vec<App>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, app_type, content, created_at, updated_at, name, icon, meta 
             FROM apps ORDER BY updated_at DESC",
        )?;
        let apps = stmt.query_map([], |row| {
            Ok(App {
                id: row.get(0)?,
                app_type: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                name: row.get(5)?,
                icon: row.get(6)?,
                meta: row.get(7)?,
            })
        })?;
        let mut apps_list = Vec::new();
        for app in apps {
            apps_list.push(app?);
        }
        Ok(apps_list)
    }

    pub fn update_app_content(&self, app_id: &str, content: &str) -> BackendResult<()> {
        self.conn.execute(
            "UPDATE apps SET content = ?1, updated_at = datetime('now') 
             WHERE id = ?2",
            rusqlite::params![app_id, content,],
        )?;
        Ok(())
    }
}
