CREATE TABLE IF NOT EXISTS resource_content_hashes (
    resource_id TEXT PRIMARY KEY REFERENCES resources(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL
);
