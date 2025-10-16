use crate::BackendError;
use quick_xml::{events::Event, Reader};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct YoutubeTranscript {
    pub transcript: String,
    pub metadata: YoutubeTranscriptMetadata,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct YoutubeTranscriptMetadata {
    pub transcript_pieces: Vec<YoutubeTranscriptPiece>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct YoutubeTranscriptPiece {
    pub text: String,
    pub start: f64,
    pub duration: f64,
}

pub fn extract_youtube_video_id(url: &str) -> Option<String> {
    let patterns = [
        regex::Regex::new(r"(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([^&]+)").unwrap(),
        regex::Regex::new(r"(?:https?://)?(?:www\.)?youtu\.be/([^?]+)").unwrap(),
        regex::Regex::new(r"(?:https?://)?(?:www\.)?youtube\.com/embed/([^?]+)").unwrap(),
    ];

    for pattern in patterns.iter() {
        if let Some(captures) = pattern.captures(url) {
            if let Some(id) = captures.get(1) {
                return Some(id.as_str().to_owned());
            }
        }
    }

    None
}

pub fn fetch_transcript(
    video_url: &str,
    preferred_lang: Option<&str>,
) -> Result<YoutubeTranscript, BackendError> {
    let rt = tokio::runtime::Runtime::new()
        .map_err(|e| BackendError::GenericError(format!("Failed to create runtime: {}", e)))?;

    // Extract video ID
    let video_id = extract_youtube_video_id(video_url)
        .ok_or_else(|| BackendError::GenericError("Invalid YouTube video URL".to_string()))?;

    // Fetch player data
    let player_data = rt.block_on(async {
        reqwest::Client::new()
            .post("https://www.youtube.com/youtubei/v1/player")
            .header("Content-Type", "application/json")
            .header("Origin", "https://www.youtube.com")
            .header("Referer", format!("https://www.youtube.com/watch?v={}", video_id))
            .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36")
            .json(&serde_json::json!({
                "context": {
                    "client": {
                        "clientName": "WEB",
                        "clientVersion": "2.20240304.00.00"
                    }
                },
                "videoId": video_id
            }))
            .send()
            .await
            .map_err(|e| BackendError::GenericError(format!("Failed to fetch player data: {}", e)))?
            .json::<serde_json::Value>()
            .await
            .map_err(|e| BackendError::GenericError(format!("Failed to parse player data: {}", e)))
    })?;

    // Get captions data
    let captions = player_data
        .get("captions")
        .and_then(|c| c.get("playerCaptionsTracklistRenderer"))
        .and_then(|p| p.get("captionTracks"))
        .ok_or_else(|| {
            BackendError::GenericError("No captions found for this video".to_string())
        })?;

    // Find the best caption track
    let tracks = captions.as_array().unwrap();
    if tracks.is_empty() {
        return Err(BackendError::GenericError(
            "No caption tracks found".to_string(),
        ));
    }

    let preferred_lang = preferred_lang.unwrap_or("en");

    // First try: find track in preferred language (prioritize manual over auto-generated)
    let mut selected_track = tracks
        .iter()
        .find(|track| {
            let lang_code = track
                .get("languageCode")
                .and_then(|l| l.as_str())
                .unwrap_or("");
            let is_auto = track
                .get("kind")
                .and_then(|k| k.as_str())
                .map(|k| k == "asr")
                .unwrap_or(false);
            lang_code == preferred_lang && !is_auto
        })
        .or_else(|| {
            tracks.iter().find(|track| {
                let lang_code = track
                    .get("languageCode")
                    .and_then(|l| l.as_str())
                    .unwrap_or("");
                lang_code == preferred_lang
            })
        });

    // Second try: find any non-auto-generated track
    if selected_track.is_none() {
        selected_track = tracks.iter().find(|track| {
            let is_auto = track
                .get("kind")
                .and_then(|k| k.as_str())
                .map(|k| k == "asr")
                .unwrap_or(false);
            !is_auto
        });
    }

    // Final fallback: use first available track
    let selected_track = selected_track.unwrap_or(&tracks[0]);

    // Get caption URL
    let caption_url = selected_track
        .get("baseUrl")
        .and_then(|u| u.as_str())
        .ok_or_else(|| BackendError::GenericError("Failed to get caption URL".to_string()))?;

    // Fetch transcript XML
    let xml_text = rt.block_on(async {
        reqwest::Client::new()
            .get(caption_url)
            .send()
            .await
            .map_err(|e| BackendError::GenericError(format!("Failed to fetch transcript: {}", e)))?
            .text()
            .await
            .map_err(|e| BackendError::GenericError(format!("Failed to read transcript: {}", e)))
    })?;

    // Parse XML into transcript
    let mut transcript_pieces = Vec::new();
    let mut full_text = String::new();

    // Use quick-xml to parse the XML
    let mut reader = Reader::from_str(&xml_text);
    let mut buf = Vec::new();
    let mut in_text = false;
    let mut current_start = 0.0;
    let mut current_duration = 0.0;
    let mut current_text = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                if e.name().as_ref() == b"text" {
                    in_text = true;
                    // Parse start and duration attributes
                    for attr in e.attributes().flatten() {
                        match attr.key.as_ref() {
                            b"start" => {
                                if let Ok(start) = String::from_utf8_lossy(&attr.value).parse() {
                                    current_start = start;
                                }
                            }
                            b"dur" => {
                                if let Ok(duration) = String::from_utf8_lossy(&attr.value).parse() {
                                    current_duration = duration;
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
            Ok(Event::Text(e)) if in_text => {
                let text = e.unescape().unwrap().into_owned();
                current_text = text.clone();
                full_text.push_str(&text);
                full_text.push(' ');
            }
            Ok(Event::End(ref e)) if e.name().as_ref() == b"text" => {
                in_text = false;
                transcript_pieces.push(YoutubeTranscriptPiece {
                    text: current_text.clone(),
                    start: current_start,
                    duration: current_duration,
                });
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(BackendError::GenericError(format!(
                    "Error parsing XML: {}",
                    e
                )))
            }
            _ => (),
        }
        buf.clear();
    }

    Ok(YoutubeTranscript {
        transcript: full_text.trim().to_string(),
        metadata: YoutubeTranscriptMetadata { transcript_pieces },
    })
}
