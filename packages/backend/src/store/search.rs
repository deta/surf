use super::models::*;
use crate::{store::db::Database, BackendResult};

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
    ref_resource_id: Option<String>,
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
            distance: row.get(12).unwrap_or(None),
            ref_resource_id: ref_resource_id.clone(),
            card_ids: Vec::new(),
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

        let match_phrase = format!("{{name alt}}: {}", keyword);
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
        let row_map_fn = map_resource_and_metadata(None, SearchEngine::KeywordMetadata);
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

        let row_map_fn = map_resource_and_metadata(None, SearchEngine::KeywordContent);
        let mut stmt = self.conn.prepare(&query)?;
        let items = stmt.query_map(rusqlite::params_from_iter(params.iter()), row_map_fn)?;
        for item in items {
            results.push(item?);
        }

        Ok(results)
    }

    // search for resources that match the given tags and only return the resource ids
    pub fn list_resources_by_tags(
        &self,
        mut tags: Vec<ResourceTagFilter>,
    ) -> BackendResult<SearchResultSimple> {
        let filtered_resource_ids = self.list_resource_ids_by_tags(&mut tags)?;

        if filtered_resource_ids.is_empty() {
            return Ok(SearchResultSimple {
                items: vec![],
                total: 0,
            });
        }

        Ok(SearchResultSimple {
            total: filtered_resource_ids.len() as i64,
            items: filtered_resource_ids,
        })
    }

    // list all resources that are not in a space by list of tags
    pub fn list_resources_by_tags_no_space(
        &self,
        tags: Vec<ResourceTagFilter>,
    ) -> BackendResult<SearchResultSimple> {
        let filtered_resource_ids = self.list_resource_ids_by_tags_no_space(&tags)?;

        if filtered_resource_ids.is_empty() {
            return Ok(SearchResultSimple {
                items: vec![],
                total: 0,
            });
        }

        Ok(SearchResultSimple {
            total: filtered_resource_ids.len() as i64,
            items: filtered_resource_ids,
        })
    }

    pub fn search_resources(
        &self,
        keyword: &str,
        filtered_resource_ids: &Option<Vec<String>>,
        include_annotations: bool,
        keyword_limit: Option<i64>,
    ) -> BackendResult<SearchResult> {
        // The Some value in filtered_resource_ids indicates that the search MUST have the filter ids
        // so if value is Some and empty, we return an empty result
        let filtered_resource_ids = match filtered_resource_ids {
            Some(ids) => {
                if ids.is_empty() {
                    return Ok(SearchResult {
                        items: vec![],
                        total: 0,
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

        if include_annotations {
            let mut annotations = self.list_resource_annotations(
                results
                    .iter()
                    .map(|item| item.resource.resource.id.as_str())
                    .collect::<Vec<_>>()
                    .as_ref(),
            )?;
            for item in results.iter_mut() {
                item.resource.resource_annotations =
                    annotations.remove(item.resource.resource.id.as_str())
            }
        }
        Ok(SearchResult {
            total: results.len() as i64,
            items: results,
        })
    }
}
