use crate::backend::worker::Worker;
use crate::store::db::{CompositeResource, Database};
use crate::store::models::*;
use crate::{BackendError, BackendResult};

use std::path::Path;

use super::processor::get_youtube_contents_metadatas;

impl Worker {
    fn process_youtube_data(&mut self, resource: &CompositeResource) -> BackendResult<()> {
        if resource.metadata.is_none() {
            println!(
                "\t\tSkipping resource id '{}' because it doesn't have metadata",
                &resource.resource.id
            );
            return Ok(());
        }
        let metadata = resource.metadata.as_ref().unwrap();
        // TODO: language setting
        let (contents, metadatas) = get_youtube_contents_metadatas(&metadata.source_uri, None)?;
        self.batch_upsert_resource_text_content(
            resource.resource.id.clone(),
            ResourceTextContentType::YoutubeTranscript,
            contents,
            metadatas,
        )?;
        Ok(())
    }

    // separate function because we don't want to do async using queues
    fn reindex_resource(
        &mut self,
        resource_id: &str,
        text_content: String,
        text_content_type: ResourceTextContentType,
    ) -> BackendResult<()> {
        let resource = self.read_resource(resource_id.to_string(), false)?;
        if resource.is_none() {
            return Err(BackendError::GenericError(format!(
                "Resource with id '{}' not found",
                resource_id
            )));
        }
        let resource = resource.unwrap();

        match text_content_type {
            ResourceTextContentType::YoutubeTranscript => self.process_youtube_data(&resource),
            _ => {
                let text_content_metadata = match &resource.metadata {
                    Some(metadata) => ResourceTextContentMetadata {
                        timestamp: None,
                        url: Some(metadata.source_uri.clone()),
                    },
                    None => ResourceTextContentMetadata {
                        timestamp: None,
                        url: None,
                    },
                };
                self.upsert_resource_text_content(
                    resource.resource.id.clone(),
                    text_content,
                    text_content_type,
                    text_content_metadata,
                )
            }
        }
    }

    pub fn migrate_data(&mut self, old_db: &str) -> BackendResult<()> {
        let old_db_path = Path::new(&self.backend_root_path)
            .join(old_db)
            .as_os_str()
            .to_string_lossy()
            .to_string();
        let old_db = Database::new(&old_db_path, false)?;

        println!("Migrating non deleted resources using {}...", old_db_path);

        let non_deleted_resources = old_db.list_all_resources(0)?;
        println!(
            "{} non deleted resources found",
            non_deleted_resources.len()
        );
        let mut tx = self.db.begin()?;
        for (i, resource) in non_deleted_resources.iter().enumerate() {
            println!(
                "migrating resource {}/{}...",
                i + 1,
                non_deleted_resources.len()
            );
            Database::create_resource_tx(&mut tx, &resource)?;
            println!("\tcreated resource");

            let tags = old_db.list_resource_tags(&resource.id)?;
            for tag in tags {
                Database::create_resource_tag_tx(&mut tx, &tag)?;
            }
            println!("\tcreated tags");
            let metadata = old_db.get_resource_metadata_by_resource_id(&resource.id)?;
            if let Some(metadata) = metadata {
                Database::create_resource_metadata_tx(&mut tx, &metadata)?;
            }
            println!("\tcreated metadata");
        }

        let spaces = old_db.list_spaces()?;
        for (i, space) in spaces.iter().enumerate() {
            println!("migrating space {}/{}...", i + 1, spaces.len());
            Database::create_space_tx(&mut tx, &space)?;
            println!("\tcreated space");

            let space_entries = old_db.list_space_entries(&space.id)?;
            for entry in space_entries {
                match Database::create_space_entry_tx(&mut tx, &entry) {
                    Ok(_) => {}
                    Err(_) => {
                        println!(
                            "\tSkipping (deleted) resource id '{:?}' for space entry",
                            entry.resource_id
                        );
                    }
                }
            }
            println!("\tcreated space entries");
        }
        tx.commit()?;

        println!("reindexing resource text content embeddings...");
        for (i, resource) in non_deleted_resources.iter().enumerate() {
            println!(
                "\treindexing resource '{}' {}/{}...",
                resource.id,
                i + 1,
                non_deleted_resources.len()
            );
            if let Some(text_content) =
                old_db.legacy_get_resource_text_content_by_resource_id(&resource.id)?
            {
                println!("\t text content length: {}", text_content.content.len());
                if let Some(text_content_type) =
                    ResourceTextContentType::from_resource_type(&resource.resource_type)
                {
                    self.reindex_resource(&resource.id, text_content.content, text_content_type)?;
                }
            } else {
                println!(
                    "\t\tSkipping resource id '{}' because it doesn't have text content",
                    &resource.id
                );
            }
        }
        println!("done");
        Ok(())
    }
}
