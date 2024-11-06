use std::collections::HashMap;

use super::{message::*, tunnel::WorkerTunnel};
use crate::{
    backend::ai::AI,
    embeddings::chunking::ContentChunker,
    store::{
        db::CompositeResource,
        models::{ResourceTextContentMetadata, ResourceTextContentType},
    },
    BackendError, BackendResult,
};

use ocrs::{ImageSource, OcrEngine, OcrEngineParams};
use rten::Model;
use serde::{Deserialize, Serialize};

pub struct Processor {
    tunnel: WorkerTunnel,
    ai: AI,
    ocr_engine: OcrEngine,
    language: Option<String>,
}

impl Processor {
    pub fn new(
        tunnel: WorkerTunnel,
        app_path: String,
        language: Option<String>,
        vision_api_key: String,
        vision_api_endpoint: String,
    ) -> Self {
        let ai = AI::new(&vision_api_key, &vision_api_endpoint);
        let ocr_engine = create_ocr_engine(&app_path).expect("failed to create the OCR engine");
        Self {
            tunnel,
            ai,
            ocr_engine,
            language,
        }
    }

    pub fn run(&self) {
        while let Ok(message) = self.tunnel.tqueue_rx.recv() {
            match message {
                ProcessorMessage::ProcessResource(resource) => {
                    let resource_id = resource.resource.id.clone();
                    self.emit_processing_status(&resource_id, ResourceProcessingStatus::Started);

                    match self.handle_process_resource(resource) {
                        Ok(_) => self.emit_processing_status(
                            &resource_id,
                            ResourceProcessingStatus::Finished,
                        ),
                        Err(err) => {
                            tracing::error!("failed to process resource: {err}");

                            // TODO(@aavash, @brkp): remove this once we fix the usearch issues
                            if err
                                .to_string()
                                .contains("Duplicate keys not allowed in high-level wrappers")
                            {
                                return self.emit_processing_status(
                                    &resource_id,
                                    ResourceProcessingStatus::Finished,
                                );
                            }

                            self.emit_processing_status(
                                &resource_id,
                                ResourceProcessingStatus::Failed {
                                    message: format!("error while processing resource: {err:?}"),
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    fn emit_processing_status(&self, resource_id: &str, status: ResourceProcessingStatus) {
        self.tunnel.worker_send_rust(
            WorkerMessage::MiscMessage(MiscMessage::SendEventBusMessage(
                EventBusMessage::ResourceProcessingMessage {
                    resource_id: resource_id.to_string(),
                    status,
                },
            )),
            None,
        );
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
                    process_resource_data(&resource, "", &self.ocr_engine)
                {
                    result.insert(
                        content_type,
                        (
                            vec![content],
                            vec![create_metadata_from_resource(&resource)],
                        ),
                    );
                }

                match self.ai.process_vision_message(&resource) {
                    Ok(ai_results) => {
                        for (content_type, content) in ai_results {
                            let content_len = content.len();
                            let metadata = vec![
                                ResourceTextContentMetadata {
                                    timestamp: None,
                                    url: None,
                                };
                                content_len
                            ];
                            result.insert(content_type, (content, metadata));
                        }
                    }
                    Err(e) => tracing::error!("error processing image with AI: {:?}", e),
                }
            }
            "application/pdf" => {
                if let Some((content_type, content)) =
                    process_resource_data(&resource, "", &self.ocr_engine)
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
                    process_resource_data(&resource, &resource_data, &self.ocr_engine)
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
    vision_api_key: String,
    vision_api_endpoint: String,
) {
    let processor = Processor::new(
        tunnel,
        app_path,
        language,
        vision_api_key,
        vision_api_endpoint,
    );
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
    let detection_model = Model::load_file(det_model_path)?;

    let rec_model_path = ocrs_folder.join("text-recognition.rten");
    let recognition_model = Model::load_file(rec_model_path)?;

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
        url: resource.metadata.as_ref().map(|m| m.source_uri.clone()),
    }
}

fn needs_processing(resource_type: &str) -> bool {
    match resource_type {
        "application/pdf" => true,
        _ if resource_type.starts_with("image/") => true,
        _ if resource_type.starts_with("application/vnd.space.") => true,
        _ => false,
    }
}

pub fn get_youtube_contents_metadatas(
    source_uri: &str,
    language: Option<String>,
) -> BackendResult<(Vec<String>, Vec<ResourceTextContentMetadata>)> {
    let runtime = tokio::runtime::Runtime::new()?;
    let transcript_config = match language {
        Some(language) => Some(ytranscript::TranscriptConfig {
            lang: Some(language),
        }),
        _ => None,
    };
    let transcripts = runtime
        .block_on(ytranscript::YoutubeTranscript::fetch_transcript(
            source_uri,
            transcript_config,
        ))
        .map_err(|e| BackendError::GenericError(e.to_string()))?;
    let mut contents: Vec<String> = vec![];
    let mut metadatas: Vec<ResourceTextContentMetadata> = vec![];
    let mut prev_offset = 0.0;
    let mut transcript_chunk = String::new();
    // min 20 second chunks
    for (i, transcript) in transcripts.iter().enumerate() {
        transcript_chunk.push_str(&format!(" {}", transcript.text));
        if transcript.offset - prev_offset > 20.0 || i == transcripts.len() - 1 {
            contents.push(ContentChunker::normalize(&transcript_chunk));
            metadatas.push(ResourceTextContentMetadata {
                timestamp: Some(prev_offset.clone() as f32),
                url: Some(source_uri.to_string()),
            });
            prev_offset = transcript.offset;
            transcript_chunk = String::new();
        }
    }
    Ok((contents, metadatas))
}

fn process_resource_data(
    resource: &CompositeResource,
    resource_data: &str,
    ocr_engine: &OcrEngine,
) -> Option<(ResourceTextContentType, String)> {
    let resource_text_content_type =
        ResourceTextContentType::from_resource_type(&resource.resource.resource_type)?;

    match resource_text_content_type {
        // TODO: mb we should have this use the same format as the post resources?
        ResourceTextContentType::Note => Some((
            resource_text_content_type,
            normalize_html_data(resource_data),
        )),

        ResourceTextContentType::PDF => {
            match extract_text_from_pdf(&resource.resource.resource_path) {
                Ok(text) => Some((resource_text_content_type, text)),
                Err(e) => {
                    eprintln!("extracting text from pdf: {e:#?}");
                    None
                }
            }
        }
        ResourceTextContentType::Image => {
            match extract_text_from_image(&resource.resource.resource_path, ocr_engine) {
                Ok(text) => Some((resource_text_content_type, text)),
                Err(e) => {
                    eprintln!("extracting text from image: {e:#?}");
                    None
                }
            }
        }

        ResourceTextContentType::Post => {
            match serde_json::from_str::<PostData>(resource_data)
                .map_err(|e| eprintln!("deserializing post data: {e:#?}"))
                .ok()
                .map(|post_data| {
                    format!(
                        "{} {} {} {} {}",
                        post_data.title.unwrap_or_default(),
                        post_data.excerpt.unwrap_or_default(),
                        post_data.content_plain.unwrap_or_default(),
                        post_data.author.unwrap_or_default(),
                        post_data.site_name.unwrap_or_default()
                    )
                }) {
                Some(text) => Some((resource_text_content_type, text)),
                None => None,
            }
        }
        ResourceTextContentType::ChatMessage => {
            match serde_json::from_str::<ChatMessageData>(resource_data)
                .map_err(|e| eprintln!("deserializing chat message data: {e:#?}"))
                .ok()
                .map(|message_data| {
                    format!(
                        "{} {} {}",
                        message_data.author.unwrap_or_default(),
                        message_data.content_plain.unwrap_or_default(),
                        message_data.platform_name.unwrap_or_default()
                    )
                }) {
                Some(text) => Some((resource_text_content_type, text)),
                None => None,
            }
        }
        ResourceTextContentType::Document => {
            match serde_json::from_str::<DocumentData>(resource_data)
                .map_err(|e| eprintln!("deserializing document data: {e:#?}"))
                .ok()
                .map(|document_data| {
                    format!(
                        "{} {} {}",
                        document_data.author.unwrap_or_default(),
                        document_data.content_plain.unwrap_or_default(),
                        document_data.editor_name.unwrap_or_default()
                    )
                }) {
                Some(text) => Some((resource_text_content_type, text)),
                None => None,
            }
        }
        ResourceTextContentType::Article => {
            match serde_json::from_str::<ArticleData>(resource_data)
                .map_err(|e| eprintln!("deserializing article data: {e:#?}, {resource_data}"))
                .ok()
                .map(|article_data| {
                    format!(
                        "{} {} {}",
                        article_data.title.unwrap_or_default(),
                        article_data.excerpt.unwrap_or_default(),
                        article_data.content_plain.unwrap_or_default(),
                    )
                }) {
                Some(text) => Some((resource_text_content_type, text)),
                None => None,
            }
        }
        ResourceTextContentType::Link => {
            match serde_json::from_str::<LinkData>(resource_data)
                .map_err(|e| eprintln!("deserializing link data: {e:#?}"))
                .ok()
                .map(|link_data| {
                    format!(
                        "{} {} {}\n{}",
                        link_data.title.unwrap_or_default(),
                        link_data.description.unwrap_or_default(),
                        link_data.url.unwrap_or_default(),
                        link_data.content_plain.unwrap_or_default()
                    )
                }) {
                Some(text) => Some((resource_text_content_type, text)),
                None => None,
            }
        }
        ResourceTextContentType::ChatThread => {
            match serde_json::from_str::<ChatThreadData>(resource_data)
                .map_err(|e| eprintln!("deserializing chat thread data: {e:#?}"))
                .ok()
                .map(|thread_data| {
                    let messages_content = thread_data
                        .messages
                        .unwrap_or_default()
                        .iter()
                        .map(|msg| msg.content_plain.clone().unwrap_or_default())
                        .collect::<Vec<_>>()
                        .join(" ");
                    format!(
                        "{} {}",
                        thread_data.title.unwrap_or_default(),
                        messages_content
                    )
                }) {
                Some(text) => Some((resource_text_content_type, text)),
                None => None,
            }
        }
        ResourceTextContentType::Annotation => {
            match serde_json::from_str::<ResourceDataAnnotation>(resource_data)
                .map_err(|e| eprintln!("deserializing annotation data: {e:#?}"))
                .ok()
                .map(|annotation_data| {
                    let content = match &annotation_data.data {
                        AnnotationData::Comment(comment_data) => {
                            Some(comment_data.content_plain.clone())
                        }
                        _ => None,
                    };

                    let content_plain = match &annotation_data.anchor {
                        Some(AnnotationAnchor {
                            data: AnnotationAnchorData::Range(range_data),
                            ..
                        }) => range_data.content_plain.clone(),
                        _ => None,
                    };

                    format!(
                        "{} {}",
                        content_plain.unwrap_or_default(),
                        content.unwrap_or_default()
                    )
                }) {
                Some(text) => Some((resource_text_content_type, text)),
                None => None,
            }
        }
        _ => None,
    }
}

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
    engine: &OcrEngine,
) -> Result<String, Box<dyn std::error::Error>> {
    let img = image::ImageReader::open(image_path)?
        .with_guessed_format()?
        .decode()
        .map(|image| image.into_rgb8())?;
    let img_source = ImageSource::from_bytes(img.as_raw(), img.dimensions())?;

    let ocr_input = engine.prepare_input(img_source)?;
    let ocr_text = engine.get_text(&ocr_input)?;

    Ok(ocr_text.trim().to_owned())
}

fn extract_text_from_pdf(pdf_path: &str) -> BackendResult<String> {
    let doc =
        lopdf::Document::load(pdf_path).map_err(|e| BackendError::GenericError(e.to_string()))?;
    let mut text = String::new();

    for (page_num, _object_id) in doc.get_pages() {
        match doc.extract_text(&[page_num]) {
            Ok(page_text) => {
                text += &page_text;
                text.push_str("\n")
            }
            Err(e) => eprintln!("error extracting text from page {page_num}: {e:#?}"),
        }
    }

    Ok(text)
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
