use std::collections::HashMap;

use super::tunnel::WorkerTunnel;
use crate::{
    ai::embeddings::chunking::ContentChunker,
    api::message::*,
    store::models::{
        CompositeResource, ResourceProcessingState, ResourceTextContentMetadata,
        ResourceTextContentType,
    },
    BackendError, BackendResult,
};

use ocrs::{ImageSource, OcrEngine, OcrEngineParams};
use rten::Model;
use serde::{Deserialize, Serialize};
use serde_yaml;

mod resource_types {
    pub const POST: &str = "application/vnd.space.post";
    pub const ARTICLE: &str = "application/vnd.space.article";
    pub const LINK: &str = "application/vnd.space.link";
}

pub struct Processor {
    tunnel: WorkerTunnel,
    ocr_engine: Option<OcrEngine>,
    language: Option<String>,
}

impl Processor {
    pub fn new(tunnel: WorkerTunnel, app_path: String, language: Option<String>) -> Self {
        let ocr_engine = create_ocr_engine(&app_path)
            .map_err(|e| tracing::error!("failed to create the OCR engine: {e}"))
            .ok();
        Self {
            tunnel,
            ocr_engine,
            language,
        }
    }

    pub fn run(&self) {
        while let Ok(message) = self.tunnel.tqueue_rx.recv() {
            match message {
                ProcessorMessage::ProcessResource(job, resource) => {
                    let resource_id = resource.resource.id.clone();
                    self.set_processing_state(
                        &job.id,
                        &resource_id,
                        ResourceProcessingState::Started,
                    );

                    match self.handle_process_resource(*resource) {
                        Ok(_) => self.set_processing_state(
                            &job.id,
                            &resource_id,
                            ResourceProcessingState::Finished,
                        ),
                        Err(err) => {
                            tracing::error!("failed to process resource: {err}");
                            self.set_processing_state(
                                &job.id,
                                &resource_id,
                                ResourceProcessingState::Failed {
                                    message: format!("error while processing resource: {err:?}"),
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    fn set_processing_state(
        &self,
        job_id: &str,
        resource_id: &str,
        state: ResourceProcessingState,
    ) {
        let (tx, rx) = crossbeam_channel::bounded(1);

        self.tunnel.worker_send_rust(
            WorkerMessage::ResourceMessage(ResourceMessage::SetPostProcessingState {
                id: job_id.to_string(),
                state: state.clone(),
            }),
            Some(tx.clone()),
        );
        rx.recv().ok();

        self.tunnel.worker_send_rust(
            WorkerMessage::MiscMessage(MiscMessage::SendEventBusMessage(
                EventBusMessage::ResourceProcessingMessage {
                    resource_id: resource_id.to_string(),
                    status: state,
                },
            )),
            Some(tx),
        );
        rx.recv().ok();
    }

    fn handle_process_resource(&self, resource: CompositeResource) -> BackendResult<()> {
        if !needs_processing(&resource.resource.resource_type) {
            return Ok(());
        }

        let mut result: HashMap<
            ResourceTextContentType,
            (Vec<String>, Vec<ResourceTextContentMetadata>),
        > = HashMap::new();

        match resource.resource.resource_type.as_str() {
            t if t.starts_with("image/") => {
                if let Some((content_type, content)) =
                    process_resource_data(&resource, "", self.ocr_engine.as_ref())?
                {
                    result.insert(
                        content_type,
                        (
                            vec![content],
                            vec![create_metadata_from_resource(&resource)],
                        ),
                    );
                }
            }
            "application/pdf" => {
                let (contents, metadatas): (Vec<String>, Vec<ResourceTextContentMetadata>) =
                    extract_text_from_pdf(&resource.resource.resource_path)?
                        .into_iter()
                        .map(|(page, content)| {
                            (
                                content,
                                ResourceTextContentMetadata {
                                    url: resource.metadata.as_ref().map(|m| m.source_uri.clone()),
                                    page: Some(page),
                                    ..Default::default()
                                },
                            )
                        })
                        .unzip();
                result.insert(ResourceTextContentType::PDF, (contents, metadatas));
            }
            "application/vnd.space.post.youtube" => {
                if let Some(metadata) = &resource.metadata {
                    let (youtube_contents, youtube_metadatas) = get_youtube_contents_metadatas(
                        &metadata.source_uri,
                        self.language.clone(),
                    )?;
                    result.insert(
                        ResourceTextContentType::YoutubeTranscript,
                        (youtube_contents, youtube_metadatas),
                    );
                }
            }
            _ => {
                let resource_data = std::fs::read_to_string(&resource.resource.resource_path)?;
                if let Some((content_type, content)) =
                    process_resource_data(&resource, &resource_data, self.ocr_engine.as_ref())?
                {
                    result.insert(
                        content_type,
                        (
                            vec![content],
                            vec![create_metadata_from_resource(&resource)],
                        ),
                    );
                }
            }
        }

        tracing::debug!("content types to be batch upserted: {}", result.len());
        for (content_type, (content, metadata)) in result {
            if !content.is_empty() {
                let (tx, rx) = crossbeam_channel::bounded(1);
                self.tunnel.worker_send_rust(
                    WorkerMessage::ResourceMessage(
                        ResourceMessage::BatchUpsertResourceTextContent {
                            resource_id: resource.resource.id.clone(),
                            content_type,
                            content,
                            metadata,
                        },
                    ),
                    Some(tx),
                );

                rx.recv().map_err(|_| {
                    BackendError::GenericError("failed to receive oneshot response".to_owned())
                })??;
            }
        }

        Ok(())
    }
}

pub fn processor_thread_entry_point(
    tunnel: WorkerTunnel,
    app_path: String,
    language: Option<String>,
) {
    let processor = Processor::new(tunnel, app_path, language);
    processor.run();
}

fn create_ocr_engine(app_path: &str) -> Result<OcrEngine, Box<dyn std::error::Error>> {
    // TODO: not have the env var here
    let ocrs_folder = std::env::var("SURF_OCRS_FOLDER").unwrap_or(
        std::path::Path::new(app_path)
            .join("resources")
            .join("ocrs")
            .as_os_str()
            .to_string_lossy()
            .to_string(),
    );
    let ocrs_folder = std::path::PathBuf::from(ocrs_folder);

    let det_model_path = ocrs_folder.join("text-detection.rten");
    let detection_model = Model::load_file(det_model_path.clone()).map_err(|e| {
        BackendError::GenericError(format!("failed to load {det_model_path:?}: {e}"))
    })?;

    let rec_model_path = ocrs_folder.join("text-recognition.rten");
    let recognition_model = Model::load_file(rec_model_path.clone()).map_err(|e| {
        BackendError::GenericError(format!("failed to load {rec_model_path:?}: {e}"))
    })?;

    OcrEngine::new(OcrEngineParams {
        recognition_model: Some(recognition_model),
        detection_model: Some(detection_model),
        ..Default::default()
    })
    .map_err(|e| e.into())
}

fn create_metadata_from_resource(resource: &CompositeResource) -> ResourceTextContentMetadata {
    ResourceTextContentMetadata {
        timestamp: None,
        page: None,
        url: resource.metadata.as_ref().map(|m| m.source_uri.clone()),
    }
}

fn needs_processing(resource_type: &str) -> bool {
    match resource_type {
        "application/pdf" => true,
        _ if resource_type.starts_with("image/") => true,
        _ if resource_type.starts_with("application/vnd.space.") => true,
        _ if resource_type.starts_with("text/") => true,
        _ => false,
    }
}

fn is_markdown_resource_type(resource_type: &str) -> bool {
    matches!(
        resource_type,
        resource_types::POST | resource_types::ARTICLE | resource_types::LINK
    )
}

fn is_markdown_file(file_name: &str) -> bool {
    file_name.ends_with(".md")
}

fn parse_markdown_with_frontmatter(content: &str) -> BackendResult<(String, serde_yaml::Value)> {
    // Simple frontmatter parser - finds content between --- markers
    let parts: Vec<&str> = content.split("---").collect();

    match parts.len() {
        // No frontmatter or invalid format
        0 | 1 => Ok((content.to_string(), serde_yaml::Value::Null)),

        // Has frontmatter
        _ => {
            // Parse the YAML frontmatter (second part, index 1)
            let frontmatter_yaml = parts[1].trim();
            let frontmatter = serde_yaml::from_str(frontmatter_yaml).map_err(|e| {
                BackendError::GenericError(format!("Failed to parse frontmatter: {}", e))
            })?;

            // Get the content (everything after second ---)
            let content = parts[2..].join("---").trim().to_string();

            Ok((content, frontmatter))
        }
    }
}

pub fn get_youtube_contents_metadatas(
    source_uri: &str,
    language: Option<String>,
) -> BackendResult<(Vec<String>, Vec<ResourceTextContentMetadata>)> {
    let transcript = crate::ai::youtube::fetch_transcript(source_uri, language.as_deref())?;
    let mut contents: Vec<String> = vec![];
    let mut metadatas: Vec<ResourceTextContentMetadata> = vec![];
    let mut prev_offset = 0.0;
    let mut transcript_chunk = String::new();
    // min 20 second chunks
    for (i, piece) in transcript.metadata.transcript_pieces.iter().enumerate() {
        transcript_chunk.push_str(&format!(" {}", piece.text));
        if piece.start - prev_offset > 20.0 || i == transcript.metadata.transcript_pieces.len() - 1
        {
            contents.push(ContentChunker::normalize(&transcript_chunk));
            metadatas.push(ResourceTextContentMetadata {
                timestamp: Some(prev_offset as f32),
                url: Some(source_uri.to_string()),
                page: None,
            });
            prev_offset = piece.start;
            transcript_chunk = String::new();
        }
    }
    Ok((contents, metadatas))
}

fn process_resource_data(
    resource: &CompositeResource,
    resource_data: &str,
    ocr_engine: Option<&OcrEngine>,
) -> BackendResult<Option<(ResourceTextContentType, String)>> {
    let resource_text_content_type =
        ResourceTextContentType::from_resource_type(&resource.resource.resource_type)
            .ok_or_else(|| BackendError::GenericError("invalid resource type".to_string()))?;

    match resource_text_content_type {
        ResourceTextContentType::Note => Ok(Some((
            resource_text_content_type,
            resource_data.to_string(),
        ))),

        ResourceTextContentType::Image => {
            match extract_text_from_image(&resource.resource.resource_path, ocr_engine)
                .map_err(|e| BackendError::GenericError(format!("image processing error: {}", e)))?
            {
                Some(text) => Ok(Some((resource_text_content_type, text))),
                None => Ok(None),
            }
        }

        ResourceTextContentType::Post => process_file_data::<PostData>(
            resource_data,
            resource_text_content_type,
            resource,
            |post_data| {
                let title = post_data.title.as_deref().unwrap_or_default();
                let excerpt = post_data.excerpt.as_deref().unwrap_or_default();
                let content = post_data.content_plain.as_deref().unwrap_or_default();
                let author = post_data.author.as_deref().unwrap_or_default();
                let site = post_data.site_name.as_deref().unwrap_or_default();
                format!("{title} {excerpt} {content} {author} {site}")
            },
        ),

        ResourceTextContentType::ChatMessage => process_file_data::<ChatMessageData>(
            resource_data,
            resource_text_content_type,
            resource,
            |msg| {
                let author = msg.author.as_deref().unwrap_or_default();
                let content = msg.content_plain.as_deref().unwrap_or_default();
                let platform = msg.platform_name.as_deref().unwrap_or_default();
                format!("{author} {content} {platform}")
            },
        ),

        ResourceTextContentType::Document => process_file_data::<DocumentData>(
            resource_data,
            resource_text_content_type,
            resource,
            |doc| {
                let author = doc.author.as_deref().unwrap_or_default();
                let content = doc.content_plain.as_deref().unwrap_or_default();
                let editor = doc.editor_name.as_deref().unwrap_or_default();
                format!("{author} {content} {editor}")
            },
        ),

        ResourceTextContentType::Article => process_file_data::<ArticleData>(
            resource_data,
            resource_text_content_type,
            resource,
            |article| {
                let title = article.title.as_deref().unwrap_or_default();
                let excerpt = article.excerpt.as_deref().unwrap_or_default();
                let content = article.content_plain.as_deref().unwrap_or_default();
                format!("{title} {excerpt} {content}")
            },
        ),

        ResourceTextContentType::Link => process_file_data::<LinkData>(
            resource_data,
            resource_text_content_type,
            resource,
            |link| {
                let title = link.title.as_deref().unwrap_or_default();
                let desc = link.description.as_deref().unwrap_or_default();
                let url = link.url.as_deref().unwrap_or_default();
                let content = link.content_plain.as_deref().unwrap_or_default();
                format!("{title} {desc} {url}\n{content}")
            },
        ),

        ResourceTextContentType::ChatThread => process_file_data::<ChatThreadData>(
            resource_data,
            resource_text_content_type,
            resource,
            |thread| {
                let messages_content = thread
                    .messages
                    .as_deref()
                    .unwrap_or_default()
                    .iter()
                    .map(|msg| msg.content_plain.as_deref().unwrap_or_default())
                    .collect::<Vec<_>>()
                    .join(" ");
                let title = thread.title.as_deref().unwrap_or_default();
                format!("{title} {messages_content}")
            },
        ),
        ResourceTextContentType::Annotation => process_file_data::<ResourceDataAnnotation>(
            resource_data,
            resource_text_content_type,
            resource,
            |ann| {
                let content = match &ann.data {
                    AnnotationData::Comment(comment) => Some(comment.content_plain.clone()),
                    _ => None,
                };

                let content_plain = match &ann.anchor {
                    Some(AnnotationAnchor {
                        data: AnnotationAnchorData::Range(range),
                        ..
                    }) => range.content_plain.as_deref(),
                    _ => None,
                };

                format!(
                    "{} {}",
                    content_plain.unwrap_or_default(),
                    content.unwrap_or_default()
                )
            },
        ),
        ResourceTextContentType::GenericText => Ok(Some((
            resource_text_content_type,
            resource_data.to_string(),
        ))),
        _ => Ok(None),
    }
}

#[allow(dead_code)]
fn normalize_html_data(data: &str) -> String {
    let mut output = String::new();
    let mut in_tag = false;

    for c in data.chars() {
        match (in_tag, c) {
            (true, '>') => in_tag = false,
            (false, '<') => {
                in_tag = true;
                output.push(' ');
            }
            (false, _) => output.push(c),
            _ => (),
        }
    }

    output
}

fn extract_text_from_image(
    image_path: &str,
    engine: Option<&OcrEngine>,
) -> Result<Option<String>, Box<dyn std::error::Error>> {
    if let Some(engine) = engine {
        let img = image::ImageReader::open(image_path)?
            .with_guessed_format()?
            .decode()
            .map(|image| image.into_rgb8())?;
        let img_source = ImageSource::from_bytes(img.as_raw(), img.dimensions())?;

        let ocr_input = engine.prepare_input(img_source)?;
        let ocr_text = engine.get_text(&ocr_input)?;

        Ok(Some(ocr_text.trim().to_owned()))
    } else {
        Ok(None)
    }
}

fn extract_text_from_pdf(pdf_path: &str) -> BackendResult<Vec<(u32, String)>> {
    let doc = lopdf::Document::load(pdf_path)
        .map_err(|err| BackendError::GenericError(format!("failed to load pdf: {err}")))?;
    let mut result = Vec::new();

    for (page_num, _object_id) in doc.get_pages() {
        result.push((
            page_num,
            doc.extract_text(&[page_num]).map_err(|e| {
                BackendError::GenericError(format!(
                    "error extracting text from page {page_num}: {e:#?}"
                ))
            })?,
        ));
    }

    Ok(result)
}

fn process_file_data<T>(
    data: &str,
    content_type: ResourceTextContentType,
    resource: &CompositeResource,
    formatter: impl FnOnce(&T) -> String,
) -> BackendResult<Option<(ResourceTextContentType, String)>>
where
    T: serde::de::DeserializeOwned,
{
    // Check if this is a markdown file for supported resource types
    if is_markdown_resource_type(&resource.resource.resource_type)
        && is_markdown_file(&resource.resource.resource_path)
    {
        // Parse markdown with frontmatter
        let (content, frontmatter) = parse_markdown_with_frontmatter(data)?;

        // Try to deserialize the frontmatter into our expected type
        match serde_yaml::from_value::<T>(frontmatter) {
            Ok(parsed_data) => {
                // Format the data and combine with content
                let formatted = formatter(&parsed_data);
                Ok(Some((content_type, format!("{}\n{}", formatted, content))))
            }
            Err(_) => {
                // If frontmatter parsing fails, just use the content
                Ok(Some((content_type, content)))
            }
        }
    } else {
        // Regular JSON processing
        serde_json::from_str::<T>(data)
            .map(|parsed_data| Some((content_type, formatter(&parsed_data))))
            .map_err(|err| BackendError::GenericError(format!("failed to deserialize data: {err}")))
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct PostData {
    author: Option<String>,
    author_fullname: Option<String>,
    author_image: Option<String>,
    author_url: Option<String>,
    content_html: Option<String>,
    content_plain: Option<String>,
    date_edited: Option<String>,
    date_published: Option<String>,
    edited: Option<bool>,
    excerpt: Option<String>,
    images: Option<Vec<String>>,
    lang: Option<String>,
    links: Option<Vec<String>>,
    parent_title: Option<String>,
    parent_url: Option<String>,
    post_id: Option<String>,
    site_icon: Option<String>,
    site_name: Option<String>,
    stats: Option<PostStats>,
    title: Option<String>,
    url: Option<String>,
    video: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PostStats {
    comments: Option<i32>,
    down_votes: Option<i32>,
    up_votes: Option<i32>,
    views: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatMessageData {
    author: Option<String>,
    author_image: Option<String>,
    author_url: Option<String>,
    content_html: Option<String>,
    content_plain: Option<String>,
    date_edited: Option<String>,
    date_sent: Option<String>,
    images: Option<Vec<String>>,
    in_reply_to: Option<String>,
    #[serde(rename = "messageId")]
    message_id: Option<String>,
    parent_title: Option<String>,
    parent_url: Option<String>,
    platform_icon: Option<String>,
    platform_name: Option<String>,
    url: Option<String>,
    video: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DocumentData {
    author: Option<String>,
    author_fullname: Option<String>,
    author_image: Option<String>,
    author_url: Option<String>,
    content_html: Option<String>,
    content_plain: Option<String>,
    date_created: Option<String>,
    date_edited: Option<String>,
    editor_icon: Option<String>,
    editor_name: Option<String>,
    url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ArticleData {
    author: Option<String>,
    author_image: Option<String>,
    author_url: Option<String>,
    category_name: Option<String>,
    category_url: Option<String>,
    content_html: Option<String>,
    content_plain: Option<String>,
    date_published: Option<String>,
    date_updated: Option<String>,
    direction: Option<String>,
    excerpt: Option<String>,
    //images: Vec<String>,
    lang: Option<String>,
    site_icon: Option<String>,
    site_name: Option<String>,
    //stats: Option<HashMap<String, Option<i32>>>,
    title: Option<String>,
    url: Option<String>,
    word_count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LinkData {
    author: Option<String>,
    date_modified: Option<String>,
    date_published: Option<String>,
    description: Option<String>,
    icon: Option<String>,
    image: Option<String>,
    keywords: Option<Vec<String>>,
    language: Option<String>,
    provider: Option<String>,
    title: Option<String>,
    url: Option<String>,
    content_plain: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatThreadData {
    content_plain: Option<String>,
    creator: Option<String>,
    creator_image: Option<String>,
    creator_url: Option<String>,
    messages: Option<Vec<ChatMessageData>>,
    platform_icon: Option<String>,
    platform_name: Option<String>,
    title: Option<String>,
    url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ResourceDataAnnotation {
    #[serde(rename = "type")]
    type_: AnnotationType,
    data: AnnotationData,
    anchor: Option<AnnotationAnchor>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum AnnotationType {
    Highlight,
    Comment,
    Link,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum AnnotationAnchorType {
    Range,
    Element,
    Area,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
enum AnnotationData {
    Highlight(AnnotationHighlightData),
    Comment(AnnotationCommentData),
    Link(AnnotationLinkData),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct AnnotationHighlightData {
    url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct AnnotationCommentData {
    url: Option<String>,
    content_plain: String,
    content_html: Option<String>,
    source: AnnotationCommentSource,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum AnnotationCommentSource {
    User,
    InlineAi,
    ChatAi,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct AnnotationLinkData {
    target_type: AnnotationLinkTargetType,
    url: Option<String>,
    resource_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum AnnotationLinkTargetType {
    External,
    Resource,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
enum AnnotationAnchorData {
    Range(AnnotationRangeData),
    Element(AnnotationElementData),
    Area(AnnotationAreaData),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct AnnotationAnchor {
    #[serde(rename = "type")]
    type_: AnnotationAnchorType,
    data: AnnotationAnchorData,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct AnnotationRangeData {
    content_plain: Option<String>,
    content_html: Option<String>,
    start_offset: i32,
    end_offset: i32,
    start_xpath: String,
    end_xpath: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct AnnotationElementData {
    xpath: String,
    query_selector: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct AnnotationAreaData {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}
