CREATE TABLE IF NOT EXISTS resource (
    id TEXT PRIMARY KEY,
    resource_path TEXT NOT NULL, 
    resource_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS resource_tags (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
    tag_name TEXT NOT NULL,
    tag_value TEXT NOT NULL,
    UNIQUE (resource_id, tag_name, tag_value) 
);

CREATE TABLE IF NOT EXISTS horizons (
    id TEXT PRIMARY KEY,
    horizon_name TEXT NOT NULL,
    icon_uri TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    horizon_id TEXT NOT NULL REFERENCES horizons(id) ON DELETE CASCADE,
    card_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    position_x INTEGER NOT NULL,
    poxition_y INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    stacking_order TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    data BLOB NOT NULL DEFAULT '{}' 
);

CREATE VIRTUAL TABLE resource_metadata USING fts5(
    id UNINDEXED,
    resource_id UNINDEXED,
    name,
    source_uri,
    alt
);

CREATE VIRTUAL TABLE resource_text_content USING fts5(
    id UNINDEXED,
    resource_id UNINDEXED,
    content
);

CREATE VIRTUAL TABLE card_positions USING vss0(
    position(3)
);