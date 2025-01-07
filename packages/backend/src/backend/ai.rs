use crate::{store::models, vision::vision::Vision, BackendError, BackendResult};

// TODO: use a single AI struct/abstraction in the codebase
pub struct AI {
    pub vision: Vision,
}

impl AI {
    pub fn new(api_key: String, api_endpoint: String) -> Self {
        Self {
            vision: Vision::new(api_key, api_endpoint),
        }
    }

    pub fn process_vision_message(
        &self,
        composite_resource: &models::CompositeResource,
    ) -> BackendResult<Vec<(models::ResourceTextContentType, Vec<String>)>> {
        let image = std::fs::read(&composite_resource.resource.resource_path)
            .map_err(|e| BackendError::GenericError(format!("failed to read image: {}", e)))?;
        let output = self
            .vision
            .describe_image(image)
            .map_err(|e| BackendError::GenericError(format!("failed to describe image: {}", e)))?;

        let tags: Vec<String> = output
            .tags_result
            .values
            .iter()
            .map(|tag| tag.name.clone())
            .collect();
        let captions: Vec<String> = output
            .dense_captions_result
            .values
            .iter()
            .map(|caption| caption.text.clone())
            .collect();

        let mut result = Vec::new();
        if !tags.is_empty() {
            result.push((models::ResourceTextContentType::ImageTags, tags));
        }
        if !captions.is_empty() {
            result.push((models::ResourceTextContentType::ImageCaptions, captions));
        }

        Ok(result)
    }
}
