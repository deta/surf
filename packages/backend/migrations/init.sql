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

CREATE VIRTUAL TABLE IF NOT EXISTS resource_metadata USING fts5(
    id UNINDEXED,
    resource_id UNINDEXED,
    name,
    source_uri,
    alt,
    tokenize="trigram" 
);

CREATE VIRTUAL TABLE IF NOT EXISTS resource_text_content USING fts5(
    id UNINDEXED,
    resource_id UNINDEXED,
    content,
    tokenize="trigram"
);

CREATE VIRTUAL TABLE IF NOT EXISTS card_positions USING vss0(
    position(2)
);

CREATE VIRTUAL TABLE IF NOT EXISTS embeddings USING vss0(
    embedding(384)
);
