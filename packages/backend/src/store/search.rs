use super::models::*;
use crate::{
    store::{db::Database, resource_tags::list_resource_ids_by_tags_query},
    BackendResult,
};

fn escape_fts_query(keyword: &str) -> String {
    let escaped_quotes = keyword.replace(r#"""#, r#"""""#);
    let tokens: Vec<&str> = escaped_quotes.split_whitespace().collect();

    tokens
        .into_iter()
        .map(|token| format!(r#""{}""#, token))
        .collect::<Vec<String>>()
        .join(" ")
}

fn map_resource_and_metadata(
    engine: SearchEngine,
) -> impl FnMut(&rusqlite::Row<'_>) -> Result<SearchResultItem, rusqlite::Error> {
    move |row| {
        Ok(SearchResultItem {
            resource: CompositeResource {
                metadata: Some(ResourceMetadata {
                    id: row.get(0)?,
                    resource_id: row.get(1)?,
                    name: row.get(2)?,
                    source_uri: row.get(3)?,
                    alt: row.get(4)?,
                    user_context: row.get(5)?,
                }),
                resource: Resource {
                    id: row.get(6)?,
                    resource_path: row.get(7)?,
                    resource_type: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                    deleted: row.get(11)?,
                },
                text_content: None,
                // TODO: should we populate the resource tags?
                resource_tags: None,
                resource_annotations: None,
                post_processing_job: None,
                space_ids: None,
            },
            engine: engine.clone(),
        })
    }
}

impl Database {
    pub fn keyword_search_metadata(
        &self,
        keyword: &str,
        filtered_resource_ids: Vec<String>,
        limit: Option<i64>,
    ) -> BackendResult<Vec<SearchResultItem>> {
        let mut results: Vec<SearchResultItem> = Vec::new();

        let limit_clause = limit.map_or(String::new(), |l| format!("LIMIT {}", l));
        let inner_clause = format!(
            "SELECT *
              FROM resource_metadata
              WHERE resource_metadata MATCH ?1
              ORDER BY rank {}",
            limit_clause
        );

        let match_phrase = format!("{{name user_context alt}}: {}", keyword);
        let base_query = format!(
            "SELECT M.id, M.resource_id, M.name, M.source_uri, M.alt, M.user_context, R.* 
            FROM (
                {}
            ) M
            INNER JOIN resources R ON M.resource_id = R.id",
            inner_clause
        );

        let (query, params) = if filtered_resource_ids.is_empty() {
            (base_query, vec![match_phrase])
        } else {
            let placeholders = vec!["?"; filtered_resource_ids.len()].join(",");
            let filtered_query = format!(
                "
                {}
                AND R.id IN ({})
            ",
                base_query, placeholders
            );
            let mut params = vec![match_phrase];
            params.extend(filtered_resource_ids);
            (filtered_query, params)
        };
        let row_map_fn = map_resource_and_metadata(SearchEngine::KeywordMetadata);
        let mut stmt = self.conn.prepare(&query)?;
        let items = stmt.query_map(rusqlite::params_from_iter(params.iter()), row_map_fn)?;
        for item in items {
            results.push(item?);
        }
        Ok(results)
    }

    pub fn keyword_search_content(
        &self,
        keyword: &str,
        filtered_resource_ids: Vec<String>,
        limit: Option<i64>,
    ) -> BackendResult<Vec<SearchResultItem>> {
        let mut results: Vec<SearchResultItem> = Vec::new();

        let limit_clause = limit.map_or(String::new(), |l| format!(" LIMIT {}", l));
        let inner_clause = format!(
            "SELECT resource_id
            FROM resource_text_content
            WHERE resource_text_content MATCH ?1
            ORDER BY rank {}",
            limit_clause
        );

        let base_query = format!(
            "
            SELECT M.id, M.resource_id, M.name, M.source_uri, M.alt, M.user_context, R.*
            FROM (
                {}
            ) T
            INNER JOIN resource_metadata M ON T.resource_id = M.resource_id
            INNER JOIN resources R ON M.resource_id = R.id
            ",
            inner_clause
        );

        let (query, params) = if filtered_resource_ids.is_empty() {
            (base_query, vec![keyword.to_string()])
        } else {
            let placeholders = vec!["?"; filtered_resource_ids.len()].join(",");
            let filtered_query = format!(
                "
                {}
                AND R.id IN ({})
            ",
                base_query, placeholders
            );
            let mut params = vec![keyword.to_string()];
            params.extend(filtered_resource_ids);
            (filtered_query, params)
        };

        let row_map_fn = map_resource_and_metadata(SearchEngine::KeywordContent);
        let mut stmt = self.conn.prepare(&query)?;
        let items = stmt.query_map(rusqlite::params_from_iter(params.iter()), row_map_fn)?;
        for item in items {
            results.push(item?);
        }

        Ok(results)
    }

    pub fn list_all_resources_and_spaces(
        &self,
        resource_tags: Vec<ResourceTagFilter>,
    ) -> BackendResult<Vec<ResourceOrSpace>> {
        let mut combined_query = String::from(
            "SELECT id, 'Resource' as item_type, created_at FROM resources WHERE id IN (",
        );

        let mut params: Vec<String> = Vec::new();

        if !resource_tags.is_empty() {
            let (tag_query, tag_params) = list_resource_ids_by_tags_query(&resource_tags, 0);
            combined_query.push_str(&tag_query);
            params.extend(tag_params);
        } else {
            combined_query.push_str("SELECT id FROM resources WHERE deleted = 0");
        }

        combined_query.push_str(") AND deleted = 0");
        combined_query.push_str(" UNION ALL ");
        combined_query.push_str("SELECT id, 'Space' as item_type, created_at FROM spaces");
        combined_query.push_str(" ORDER BY created_at DESC");

        let mut stmt = self.conn.prepare(&combined_query)?;

        let results = stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
            let id: String = row.get(0)?;
            let type_str: String = row.get(1)?;

            let item_type = match type_str.as_str() {
                "Resource" => SpaceEntryType::Resource,
                "Space" => SpaceEntryType::Space,
                _ => {
                    return Err(rusqlite::Error::InvalidColumnType(
                        2,
                        "Invalid item_type".to_string(),
                        rusqlite::types::Type::Text,
                    ))
                }
            };

            Ok(ResourceOrSpace { id, item_type })
        })?;
        let mut items = Vec::new();
        for result in results {
            items.push(result?);
        }
        Ok(items)
    }

    pub fn search_resources(
        &self,
        keyword: &str,
        filtered_resource_ids: &Option<Vec<String>>,
        keyword_limit: Option<i64>,
    ) -> BackendResult<SearchResult> {
        // The Some value in filtered_resource_ids indicates that the search MUST have the filter ids
        // so if value is Some and empty, we return an empty result
        let filtered_resource_ids = match filtered_resource_ids {
            Some(ids) => {
                if ids.is_empty() {
                    return Ok(SearchResult {
                        items: vec![],
                        spaces: vec![],
                        total: 0,
                        space_entries: None,
                    });
                }
                ids
            }
            None => &vec![],
        };

        let escaped_keyword = escape_fts_query(keyword);
        let mut results = self.keyword_search_metadata(
            &escaped_keyword,
            filtered_resource_ids.clone(),
            keyword_limit,
        )?;

        results.extend(self.keyword_search_content(
            &escaped_keyword,
            filtered_resource_ids.clone(),
            keyword_limit,
        )?);

        Ok(SearchResult {
            total: results.len() as i64,
            items: results,
            spaces: vec![],
            space_entries: None,
        })
    }
}
