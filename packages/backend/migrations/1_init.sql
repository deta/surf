CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    resource_path TEXT NOT NULL, 
    resource_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS resource_tags (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    tag_name TEXT NOT NULL,
    tag_value TEXT NOT NULL,
    UNIQUE (resource_id, tag_name, tag_value) 
);

CREATE TABLE IF NOT EXISTS horizons (
    id TEXT PRIMARY KEY,
    horizon_name TEXT NOT NULL,
    icon_uri TEXT NOT NULL,
    tint TEXT NOT NULL,
    view_offset_x INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    horizon_id TEXT NOT NULL REFERENCES horizons(id) ON DELETE CASCADE,
    card_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    position_x INTEGER NOT NULL,
    position_y INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    stacking_order TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    data BLOB NOT NULL DEFAULT '{}' 
);

CREATE INDEX IF NOT EXISTS cards_resource_id_index ON cards(resource_id);

CREATE TABLE IF NOT EXISTS history_entries (
    id TEXT PRIMARY KEY,
    entry_type TEXT NOT NULL,
    url TEXT,
    title TEXT,
    search_query TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS embedding_resources (
    resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    embedding_type TEXT NOT NULL,
    content_id INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS embedding_resources_resource_id_index ON embedding_resources(resource_id);
CREATE INDEX IF NOT EXISTS embedding_resources_content_id_index ON embedding_resources(content_id);

CREATE VIRTUAL TABLE IF NOT EXISTS resource_metadata USING fts5(
    id UNINDEXED,
    resource_id UNINDEXED,
    name,
    source_uri,
    alt,
    user_context,
    tokenize="trigram" 
);

CREATE VIRTUAL TABLE IF NOT EXISTS resource_text_content USING fts5(
    id UNINDEXED,
    resource_id UNINDEXED,
    content,
    content_type,
    metadata,
    tokenize="trigram"
);

CREATE TABLE IF NOT EXISTS card_positions(
    position TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_sessions (
    id TEXT PRIMARY KEY,
    system_prompt TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS ai_session_messages (
    ai_session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sources BLOB NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS space_entries (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    manually_added INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_entries_urls ON history_entries(url);

CREATE TABLE IF NOT EXISTS resource_content_hashes (
    resource_id TEXT PRIMARY KEY REFERENCES resources(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS post_processing_jobs (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    state TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS apps (
    id TEXT PRIMARY KEY,
    name TEXT,
    icon TEXT,
    meta TEXT,
    app_type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(name, app_type)
);

DROP TABLE IF EXISTS horizons;
DROP TABLE IF EXISTS cards;
DROP INDEX IF EXISTS cards_resource_id_index;
DROP TABLE IF EXISTS card_positions;

ALTER TABLE ai_sessions ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_sessions ADD COLUMN created_at TEXT DEFAULT NULL;
ALTER TABLE ai_sessions ADD COLUMN updated_at TEXT DEFAULT NULL;

ALTER TABLE ai_session_messages ADD COLUMN msg_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE ai_session_messages ADD COLUMN truncatable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_session_messages ADD COLUMN is_context INTEGER NOT NULL DEFAULT 0;

 
