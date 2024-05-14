use core::fmt;

use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSource {
    pub data_type: String,
    pub data_value: String,
    pub metadata: String,
    pub env_variables: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DataSourceMetadata {
    pub resource_id: String,
    pub resource_type: String,
}

#[derive(Debug)]
pub enum DataSourceType {
    Text,
    YoutubeVideo,
    Webpage,
}

impl fmt::Display for DataSourceType {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            DataSourceType::Text => write!(f, "text"),
            DataSourceType::YoutubeVideo => write!(f, "youtube_video"),
            DataSourceType::Webpage => write!(f, "web_page"),
        }
    }
}

#[derive(Debug)]
pub struct AI {
    api_endpoint: String,
    client: Client,
}

impl AI {
    pub fn new(api_endpoint: String) -> Self {
        let client = Client::new();
        Self {
            api_endpoint,
            client,
        }
    }

    pub fn add_data_source(&self, data_source: &DataSource) -> Result<(), reqwest::Error> {
        let url = format!("{}/admin/data_sources", &self.api_endpoint);

        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::CONTENT_TYPE,
            reqwest::header::HeaderValue::from_static("application/json"),
        );
        let response = self
            .client
            .post(url)
            .headers(headers)
            .json(data_source)
            .send()?;
        dbg!(&response.text());
        Ok(())
    }

    // TODO: figure out real streaming
    // right now response.text() is blocking
    pub fn chat(
        &self,
        query: String,
        thread_id: String,
        number_documents: i32,
        model: String,
    ) -> impl Iterator<Item = Result<String, reqwest::Error>> {
        let url = format!("{}/chat", &self.api_endpoint);
        let response = self
            .client
            .get(url)
            .query(&[
                ("query", query),
                ("thread_id", thread_id),
                ("number_documents", number_documents.to_string()),
                ("model", model),
            ])
            .send();
        if let Ok(response) = response {
            let res = response.text();
            vec![res].into_iter()
        } else {
            vec![Err(response.unwrap_err())].into_iter()
        }
    }
}
