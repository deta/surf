use crate::llm::models::Message;
use crate::{BackendError, BackendResult};
use llama_cpp::{
    standard_sampler::StandardSampler, CompletionHandle, LlamaModel, LlamaParams, SessionParams,
};

#[derive(Clone)]
pub struct Llama {
    pub model: LlamaModel,
    pub n_ctx: u32,
    pub n_batch: u32,
    pub max_tokens: usize,
}

impl Llama {
    // TODO: support other parameters
    pub fn new_remote(
        repo: String,
        filename: String,
        n_ctx: u32,
        n_batch: u32,
        max_tokens: usize,
    ) -> BackendResult<Self> {
        let api = hf_hub::api::sync::Api::new().map_err(|e| {
            BackendError::GenericError(format!("failed to create hugging face api: {:#?}", e))
        })?;
        let model_filepath = api.model(repo).get(&filename).map_err(|e| {
            BackendError::GenericError(format!("failed to download model file: {:#?}", e))
        })?;
        let params = LlamaParams::default();
        let model = LlamaModel::load_from_file(&model_filepath, params)?;
        Ok(Self {
            model,
            n_ctx,
            n_batch,
            max_tokens,
        })
    }

    fn get_llama3_instruct_msg(&self, header: &str, message: &str) -> String {
        format!(
            "<|start_header_id|>{}<|end_header_id|>\n{}<|eot_id|>",
            header, message
        )
    }

    fn get_llama3_instruct_prompt(&self, message: &str) -> String {
        format!(
            "<|begin_of_text|>{}\n<|start_header_id|>assistant<|end_header_id|>",
            message
        )
    }

    // TODO: not leak underlying completion handle
    pub fn create_chat_completion(
        &self,
        messages: Vec<Message>,
    ) -> BackendResult<CompletionHandle> {
        println!("creating chat completion");
        if messages.len() == 0 {
            return Err(BackendError::GenericError("messages is empty".to_string()));
        }
        let mut prompt = String::new();
        for message in messages {
            prompt.push_str(&self.get_llama3_instruct_msg(&message.role, &message.content));
        }
        println!("getting instruct prompt");
        let prompt = self.get_llama3_instruct_prompt(&prompt);

        let tokens = self.model.tokenize_bytes(&prompt, true, false)?;
        println!("len tokens: {}", tokens.len());
        let mut params = SessionParams::default();
        params.n_ctx = self.n_ctx;
        params.n_batch = self.n_batch;
        println!("creating session");
        let mut ctx = self.model.create_session(params)?;
        println!("created session");

        println!("advancing context");
        ctx.advance_context(&prompt)?;
        println!("advanced context");
        Ok(ctx.start_completing_with(StandardSampler::default(), self.max_tokens)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_llama() -> Result<(), Box<dyn std::error::Error>> {
        let llama = Llama::new_remote(
            "bartowski/Meta-Llama-3-8B-Instruct-GGUF".to_string(),
            "Meta-Llama-3-8B-Instruct-Q4_K_S.gguf".to_string(),
            16000,
            512,
            16000,
        )
        .expect("Could not create new llama model");

        let messages = vec![
            Message {
                role: "system".to_string(),
                content: "You are a helpful assistant.".to_string(),
            },
            Message {
                role: "user".to_string(),
                content: "What is 42?".to_string(),
            },
        ];

        let handle = llama
            .create_chat_completion(messages)
            .expect("Could not create chat completion");

        let max_tokens = 256;
        let mut decoded_tokens = 0;
        for _msg in handle.into_strings() {
            decoded_tokens += 1;
            if decoded_tokens > max_tokens {
                break;
            }
        }
        Ok(())
    }
}
