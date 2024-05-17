use super::{message::*, tunnel::WorkerTunnel};
use crate::{store::db::CompositeResource, BackendError, BackendResult};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub fn processor_thread_entry_point(tunnel: WorkerTunnel, app_path: String) {
    while let Ok(message) = tunnel.tqueue_rx.recv() {
        match message {
            ProcessorMessage::ProcessResource(resource) => {
                let _ = handle_process_resource(&tunnel, resource, &app_path)
                    .map_err(|e| eprintln!("error while processing resource: {e:?}"));
            }
        }
    }
}

fn handle_process_resource(
    tunnel: &WorkerTunnel,
    resource: CompositeResource,
    app_path: &str,
) -> BackendResult<()> {
    let mut tessdata_folder = Some(
        std::path::Path::new(app_path)
            .join("resources")
            .join("tessdata"),
    );
    tessdata_folder = tessdata_folder.filter(|path| path.exists());

    if !needs_processing(&resource.resource.resource_type) {
        return Ok(());
    }

    let resource_data = match resource.resource.resource_type.as_str() {
        t if t.starts_with("image/") || t == "application/pdf" => "".to_owned(),
        _ => std::fs::read_to_string(&resource.resource.resource_path)?,
    };
    let output = process_resource_data(&resource, &resource_data, &tessdata_folder);

    if let Some(output) = output {
        tunnel.worker_send_rust(
            WorkerMessage::ResourceMessage(ResourceMessage::UpsertResourceTextContent {
                resource_id: resource.resource.id,
                content: output,
            }),
            None,
        );
    }

    Ok(())
}

fn needs_processing(resource_type: &str) -> bool {
    match resource_type {
        "application/pdf" => true,
        _ if resource_type.starts_with("image/") => true,
        _ if resource_type.starts_with("application/vnd.space.") => true,
        _ => false,
    }
}

fn process_resource_data(
    resource: &CompositeResource,
    resource_data: &str,
    tessdata_folder: &Option<std::path::PathBuf>,
) -> Option<String> {
    match resource.resource.resource_type.as_str() {
        // TODO: mb we should have this use the same format as the post resources?
        "application/vnd.space.document.space-note" => Some(normalize_html_data(resource_data)),

        "application/pdf" => extract_text_from_pdf(&resource.resource.resource_path)
            .map_err(|e| eprintln!("extracting text from pdf: {e:#?}"))
            .ok(),
        resource_type if resource_type.starts_with("image/") => {
            extract_text_from_image(&resource.resource.resource_path, tessdata_folder)
                .map_err(|e| eprintln!("extracting text from image: {e:#?}"))
                .ok()
        }

        resource_type if resource_type.starts_with("application/vnd.space.post") => {
            serde_json::from_str::<PostData>(resource_data)
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
                })
        }
        resource_type if resource_type.starts_with("application/vnd.space.chat-message") => {
            serde_json::from_str::<ChatMessageData>(resource_data)
                .map_err(|e| eprintln!("deserializing chat message data: {e:#?}"))
                .ok()
                .map(|message_data| {
                    format!(
                        "{} {} {}",
                        message_data.author.unwrap_or_default(),
                        message_data.content_plain.unwrap_or_default(),
                        message_data.platform_name.unwrap_or_default()
                    )
                })
        }
        resource_type if resource_type.starts_with("application/vnd.space.document") => {
            serde_json::from_str::<DocumentData>(resource_data)
                .map_err(|e| eprintln!("deserializing document data: {e:#?}"))
                .ok()
                .map(|document_data| {
                    format!(
                        "{} {} {}",
                        document_data.author.unwrap_or_default(),
                        document_data.content_plain.unwrap_or_default(),
                        document_data.editor_name.unwrap_or_default()
                    )
                })
        }
        resource_type if resource_type.starts_with("application/vnd.space.article") => {
            serde_json::from_str::<ArticleData>(resource_data)
                .map_err(|e| eprintln!("deserializing article data: {e:#?}"))
                .ok()
                .map(|article_data| {
                    format!(
                        "{} {} {} {} {}",
                        article_data.title.unwrap_or_default(),
                        article_data.excerpt.unwrap_or_default(),
                        article_data.content_plain.unwrap_or_default(),
                        article_data.author.unwrap_or_default(),
                        article_data.site_name.unwrap_or_default()
                    )
                })
        }
        resource_type if resource_type.starts_with("application/vnd.space.link") => {
            serde_json::from_str::<LinkData>(resource_data)
                .map_err(|e| eprintln!("deserializing link data: {e:#?}"))
                .ok()
                .map(|link_data| {
                    format!(
                        "{} {} {}",
                        link_data.title.unwrap_or_default(),
                        link_data.description.unwrap_or_default(),
                        link_data.url.unwrap_or_default()
                    )
                })
        }
        resource_type if resource_type.starts_with("application/vnd.space.chat-thread") => {
            serde_json::from_str::<ChatThreadData>(resource_data)
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
                })
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
    tessdata_folder: &Option<std::path::PathBuf>,
) -> BackendResult<String> {
    let mut lt = leptess::LepTess::new(
        tessdata_folder.as_ref().map(|path| path.to_str()).flatten(),
        "eng",
    )
    .map_err(|e| BackendError::GenericError(e.to_string()))?;
    lt.set_image(image_path)
        .map_err(|e| BackendError::GenericError(e.to_string()))?;
    let text = lt
        .get_utf8_text()
        .map_err(|e| BackendError::GenericError(e.to_string()))?;
    Ok(text.trim().to_owned())
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
    images: Vec<String>,
    lang: Option<String>,
    site_icon: Option<String>,
    site_name: Option<String>,
    stats: Option<HashMap<String, Option<i32>>>,
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
