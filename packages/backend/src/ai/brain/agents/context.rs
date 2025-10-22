use crate::{ai::llm::models::Message, BackendResult};

// TODO: should we return Vec<BackendResult> for non atomic batch apis?
pub trait ContextManager {
    fn get_context(&self, key: &str) -> BackendResult<Vec<Message>>;
    fn remove_context_messages(&mut self, key: &str, message_ids: &[String]) -> BackendResult<()>;
    fn populate_context_content(&mut self, key: &str, message_ids: &[String]) -> BackendResult<()>;
    fn add_resources(&mut self, key: &str, resource_ids: &[String]) -> BackendResult<()>;
    fn add_url(&mut self, key: &str, url: &str) -> BackendResult<()>;
    fn add_urls(&mut self, key: &str, urls: &[String]) -> BackendResult<Vec<BackendResult<()>>>;
    // TODO: this is mainly for backwards compatibility, we should phase it out
    fn get_sources_xml(&self, key: &str) -> BackendResult<String>;
    fn get_citation(&self, key: &str, message_id: &str, cited_text: &str) -> BackendResult<String>;
}

pub struct MockContextManager;

impl MockContextManager {
    pub fn new() -> Self {
        Self
    }
}

impl ContextManager for MockContextManager {
    fn get_context(&self, _key: &str) -> BackendResult<Vec<Message>> {
        Ok(vec![])
    }

    fn remove_context_messages(
        &mut self,
        _key: &str,
        _message_ids: &[String],
    ) -> BackendResult<()> {
        Ok(())
    }

    fn populate_context_content(
        &mut self,
        _key: &str,
        _message_ids: &[String],
    ) -> BackendResult<()> {
        Ok(())
    }

    fn add_resources(&mut self, _key: &str, _resource_ids: &[String]) -> BackendResult<()> {
        Ok(())
    }

    fn add_url(&mut self, _key: &str, _url: &str) -> BackendResult<()> {
        Ok(())
    }

    fn add_urls(&mut self, _key: &str, _urls: &[String]) -> BackendResult<Vec<BackendResult<()>>> {
        Ok(vec![])
    }

    fn get_sources_xml(&self, _key: &str) -> BackendResult<String> {
        Ok("<sources></sources>".to_string())
    }

    fn get_citation(
        &self,
        _key: &str,
        _message_id: &str,
        _cited_text: &str,
    ) -> BackendResult<String> {
        Ok("<citation></citation>".to_string())
    }
}
