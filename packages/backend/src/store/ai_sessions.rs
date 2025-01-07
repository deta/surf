use super::models::*;
use crate::{store::db::Database, BackendResult};

impl Database {
    pub fn create_ai_session_tx(
        tx: &mut rusqlite::Transaction,
        session: &AIChatSession,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO ai_sessions (id, system_prompt) VALUES (?1, ?2)",
            rusqlite::params![session.id, session.system_prompt],
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
                match serde_json::from_str(&sources_raw) {
                    Ok(sources) => Some(sources),
                    Err(_) => None,
                };

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
