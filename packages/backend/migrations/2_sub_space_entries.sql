CREATE TABLE IF NOT EXISTS sub_space_entries (
    id TEXT PRIMARY KEY,
    parent_space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    child_space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    manually_added INTEGER NOT NULL DEFAULT 1,
    UNIQUE(parent_space_id, child_space_id)
);
