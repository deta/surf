use super::models::*;
use crate::{store::db::Database, BackendResult};

impl Database {
    pub fn create_ai_session_tx(
        tx: &mut rusqlite::Transaction,
        session: &AIChatSession,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO ai_sessions (id, system_prompt, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
            session.id,
            session.system_prompt,
            session.title,
            session.created_at,
            session.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn get_ai_session(&self, id: &str) -> BackendResult<Option<AIChatSession>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, system_prompt, title, created_at, updated_at 
            FROM ai_sessions 
            WHERE id = ?1",
        )?;

        let mut rows = stmt.query(rusqlite::params![id])?;

        if let Some(row) = rows.next()? {
            Ok(Some(AIChatSession {
                id: row.get(0)?,
                system_prompt: row.get(1)?,
                title: row.get(2)?,
                created_at: row.get(3).unwrap_or_else(|_| chrono::Utc::now()),
                updated_at: row.get(4).unwrap_or_else(|_| chrono::Utc::now()),
            }))
        } else {
            Ok(None)
        }
    }

    pub fn update_ai_session_tx(
        tx: &mut rusqlite::Transaction,
        id: &str,
        title: &str,
        updated_at: chrono::DateTime<chrono::Utc>,
    ) -> BackendResult<()> {
        tx.execute(
            "UPDATE ai_sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![title, updated_at, id],
        )?;
        Ok(())
    }

    pub fn delete_ai_session_tx(tx: &mut rusqlite::Transaction, id: &str) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM ai_sessions WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    pub fn list_ai_sessions(&self, limit: Option<i64>) -> BackendResult<Vec<AIChatSession>> {
        let sql = match limit {
            Some(_) => {
                "SELECT id, system_prompt, title, created_at, updated_at 
                       FROM ai_sessions 
                       ORDER BY updated_at DESC 
                       LIMIT ?1"
            }
            None => {
                "SELECT id, system_prompt, title, created_at, updated_at 
                    FROM ai_sessions 
                    ORDER BY updated_at DESC"
            }
        };

        let mut stmt = self.conn.prepare(sql)?;

        let map_fn = |row: &rusqlite::Row| -> rusqlite::Result<AIChatSession> {
            Ok(AIChatSession {
                id: row.get(0)?,
                system_prompt: row.get(1)?,
                title: row.get(2)?,
                created_at: row.get(3).unwrap_or_else(|_| chrono::Utc::now()),
                updated_at: row.get(4).unwrap_or_else(|_| chrono::Utc::now()),
            })
        };

        let sessions = match limit {
            Some(n) => stmt.query_map([n], map_fn)?,
            None => stmt.query_map([], map_fn)?,
        };

        let mut result = Vec::new();
        for session in sessions {
            result.push(session?);
        }
        Ok(result)
    }

    pub fn search_ai_sessions(
        &self,
        search: &str,
        limit: Option<i64>,
    ) -> BackendResult<Vec<AIChatSession>> {
        let sql = match limit {
            Some(_) => {
                "SELECT id, system_prompt, title, created_at, updated_at 
                       FROM ai_sessions 
                       WHERE title LIKE ?1 
                       ORDER BY updated_at DESC 
                       LIMIT ?2"
            }
            None => {
                "SELECT id, system_prompt, title, created_at, updated_at 
                    FROM ai_sessions 
                    WHERE title LIKE ?1 
                    ORDER BY updated_at DESC"
            }
        };

        let mut stmt = self.conn.prepare(sql)?;

        let map_fn = |row: &rusqlite::Row| -> rusqlite::Result<AIChatSession> {
            Ok(AIChatSession {
                id: row.get(0)?,
                system_prompt: row.get(1)?,
                title: row.get(2)?,
                created_at: row.get(3).unwrap_or_else(|_| chrono::Utc::now()),
                updated_at: row.get(4).unwrap_or_else(|_| chrono::Utc::now()),
            })
        };

        let sessions = match limit {
            Some(n) => stmt.query_map([format!("%{}%", search), n.to_string()], map_fn)?,
            None => stmt.query_map([format!("%{}%", search)], map_fn)?,
        };

        let mut result = Vec::new();
        for session in sessions {
            result.push(session?);
        }
        Ok(result)
    }

    pub fn create_ai_session_message_tx(
        tx: &mut rusqlite::Transaction,
        msg: &AIChatSessionMessage,
    ) -> BackendResult<()> {
        // TODO: impl FromSql and ToSql for sources
        let sources_string = match &msg.sources {
            Some(sources) => match serde_json::to_string(sources) {
                Ok(s) => s,
                Err(_) => "".to_string(),
            },
            None => "".to_string(),
        };
        tx.execute(
            "INSERT INTO ai_session_messages (ai_session_id, role, content, truncatable, is_context, msg_type, sources, created_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                msg.ai_session_id,
                msg.role,
                msg.content,
                msg.truncatable,
                msg.is_context,
                msg.msg_type,
                sources_string,
                msg.created_at
            ],
        )?;

        tx.execute(
            "UPDATE ai_sessions SET updated_at = ?1 WHERE id = ?2",
            rusqlite::params![msg.created_at, msg.ai_session_id],
        )?;

        Ok(())
    }

    pub fn list_ai_session_messages_skip_sources(
        &self,
        session_id: &str,
    ) -> BackendResult<Vec<AIChatSessionMessage>> {
        let mut stmt = self.conn.prepare(
            "SELECT ai_session_id, role, content, truncatable, is_context, msg_type, created_at
            FROM ai_session_messages
            WHERE ai_session_id = ?1
            ORDER BY created_at ASC",
        )?;
        let messages = stmt.query_map(rusqlite::params![session_id], |row| {
            Ok(AIChatSessionMessage {
                ai_session_id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                truncatable: row.get(3)?,
                is_context: row.get(4)?,
                msg_type: row.get(5)?,
                created_at: row.get(6)?,
                sources: None,
            })
        })?;
        let mut result = Vec::new();
        for message in messages {
            result.push(message?);
        }
        Ok(result)
    }

    pub fn list_non_context_ai_session_messages(
        &self,
        session_id: &str,
    ) -> BackendResult<Vec<AIChatSessionMessage>> {
        let mut stmt = self.conn.prepare(
            "SELECT ai_session_id, role, content, truncatable, is_context, msg_type, sources, created_at
            FROM ai_session_messages
            WHERE ai_session_id = ?1
            AND is_context = 0
            ORDER BY created_at ASC",
        )?;
        let messages = stmt.query_map(rusqlite::params![session_id], |row| {
            let sources_raw: String = row.get(6)?;
            let parsed_sources: Option<Vec<AIChatSessionMessageSource>> =
                serde_json::from_str(&sources_raw).ok();

            Ok(AIChatSessionMessage {
                ai_session_id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                truncatable: row.get(3)?,
                is_context: row.get(4)?,
                msg_type: row.get(5)?,
                sources: parsed_sources,
                created_at: row.get(7)?,
            })
        })?;
        let mut result = Vec::new();
        for message in messages {
            result.push(message?);
        }
        Ok(result)
    }
}
