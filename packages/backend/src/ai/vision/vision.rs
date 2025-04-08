use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

use crate::ai::_AI_API_ENDPOINT;

pub struct Vision {
    api_key: String,
    api_base: String,
    client: Client,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageTag {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageCaption {
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TagsResult {
    pub values: Vec<ImageTag>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DenseCaptionResult {
    pub values: Vec<ImageCaption>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DescribeImageOutput {
    pub tags_result: TagsResult,
    pub dense_captions_result: DenseCaptionResult,
}

impl Vision {
    pub fn new(api_key: String, api_base: String) -> Self {
        let client = Client::new();
        Self {
            api_key,
            api_base,
            client,
        }
    }

    pub fn describe_image(&self, image: Vec<u8>) -> Result<DescribeImageOutput, reqwest::Error> {
        let url = format!(
            "{}/{}/vision/computervision/imageanalysis:analyze?api-version=2024-02-01&features=tags,denseCaptions",
            self.api_base, _AI_API_ENDPOINT,
        );
        let response = self
            .client
            .post(url)
            .header("Ocp-Apim-Subscription-Key", &self.api_key)
            .header("Content-Type", "application/octet-stream")
            .body(image)
            .send()?;
        let res = response.json::<DescribeImageOutput>()?;
        Ok(res)
    }
}
