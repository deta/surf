use super::models::TokenModel;
use crate::llm::models::{Message, MessageContent};

// reference: https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them
fn estimate_text_tokens(text: &str) -> usize {
    // ~4 characters per token
    (text.len() + 3) / 4
}

// TODO: properly implement this function
// for now estimate the worst case scenario
// reference: https://platform.openai.com/docs/guides/vision/calculating-costs#calculating-costs
fn estimate_image_tokens(_image_url: &str) -> usize {
    1105
}

pub fn estimate_message_content_tokens(content: &MessageContent) -> usize {
    match content {
        MessageContent::Text(text) => estimate_text_tokens(&text.text),
        MessageContent::Image(image) => estimate_image_tokens(&image.image_url.url),
    }
}

pub fn estimate_message_token(message: &Message) -> usize {
    message
        .content
        .iter()
        .map(|content| estimate_message_content_tokens(&content))
        .sum()
}

pub fn estimate_messages_tokens(messages: &[Message]) -> usize {
    messages
        .iter()
        .map(|message| estimate_message_token(message))
        .sum()
}

// truncate messages to fit the max tokens
//
// the following functions adds message content
// as long as the total tokens are less than the max tokens
// it truncates the last message content if the total tokens exceed the max tokens
// or skips the extra message content if it is not text content
pub fn truncate_messages(messages: Vec<Message>, model: &impl TokenModel) -> (bool, Vec<Message>) {
    let mut truncated_messages: Vec<Message> = Vec::new();
    let mut tokens = 0;
    let mut truncated = false;

    messages.into_iter().for_each(|message| {
        // TODO: what if user message is too large?
        if message.role == "user" {
            tokens += estimate_message_token(&message);
            truncated_messages.push(message);
            return;
        }
        if tokens >= model.max_tokens() {
            truncated = true;
            return;
        }
        let mut truncated_content: Vec<MessageContent> = Vec::new();
        message.content.iter().for_each(|content| {
            let content_tokens = estimate_message_content_tokens(content);
            if tokens + content_tokens > model.max_tokens() {
                truncated = true;

                // TODO: what if image needs preferencial treatment?
                // truncate text if text content or skip image
                match content {
                    MessageContent::Text(text_content) => {
                        let include_len = model.max_tokens() - tokens;
                        truncated_content.push(MessageContent::new_text(
                            text_content.text.chars().take(include_len).collect(),
                        ));
                        return;
                    }
                    MessageContent::Image(_) => {
                        return;
                    }
                }
            }
            tokens += content_tokens;
            truncated_content.push(content.clone());
        });
        truncated_messages.push(Message {
            role: message.role.clone(),
            content: truncated_content,
        });
    });
    (truncated, truncated_messages)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::models::{Message, MessageContent};

    struct MockModel {
        max_tokens: usize,
    }

    impl TokenModel for MockModel {
        fn max_tokens(&self) -> usize {
            self.max_tokens
        }
    }

    #[test]
    fn test_empty_messages() {
        let messages = vec![];
        let model = MockModel { max_tokens: 100 };
        let (truncated, truncated_messages) = truncate_messages(messages, &model);
        assert!(!truncated);
        assert_eq!(truncated_messages.len(), 0);
    }

    #[test]
    fn test_single_text_message_under_limit() {
        let content = MessageContent::new_text("Hello world".to_string());
        let message = Message {
            role: "system".to_string(),
            content: vec![content],
        };
        let messages = vec![message.clone()];
        let model = MockModel { max_tokens: 100 };

        let (truncated, truncated_messages) = truncate_messages(messages, &model);
        assert!(!truncated);
        assert_eq!(truncated_messages, vec![message]);
    }

    #[test]
    fn test_text_message_truncation() {
        let long_text = "a".repeat(1000);
        let content = MessageContent::new_text(long_text);
        let message = Message {
            role: "system".to_string(),
            content: vec![content],
        };
        let messages = vec![message];
        let model = MockModel { max_tokens: 50 };

        let (truncated, truncated_messages) = truncate_messages(messages, &model);
        assert!(truncated);
        assert_eq!(truncated_messages.len(), 1);
        assert_eq!(truncated_messages[0].content.len(), 1);
        match &truncated_messages[0].content[0] {
            MessageContent::Text(text) => {
                assert!(text.text.len() <= 50);
            }
            _ => panic!("Expected text content"),
        }
    }

    #[test]
    fn test_image_message_skipping() {
        let image_content = MessageContent::new_image("https://example.com/image.jpg".to_string());
        let text_content = MessageContent::new_text("Hello".to_string());
        let message = Message {
            role: "system".to_string(),
            content: vec![text_content.clone(), image_content],
        };
        let messages = vec![message];
        let model = MockModel { max_tokens: 10 };

        let (truncated, truncated_messages) = truncate_messages(messages, &model);
        assert!(truncated);
        assert_eq!(truncated_messages[0].content.len(), 1);
        assert_eq!(truncated_messages[0].content[0], text_content);
    }

    #[test]
    fn test_multiple_messages() {
        let message1 = Message {
            role: "system".to_string(),
            content: vec![MessageContent::new_text("First".to_string().repeat(50))],
        };
        let message2 = Message {
            role: "system".to_string(),
            content: vec![MessageContent::new_text("Second".to_string().repeat(200))],
        };
        let messages = vec![message1.clone(), message2.clone()];
        let model = MockModel { max_tokens: 100 };

        let (truncated, truncated_messages) = truncate_messages(messages, &model);
        assert!(truncated);
        assert_eq!(truncated_messages.len(), 2);
        assert_eq!(truncated_messages[1].content.len(), 1);
        match &truncated_messages[1].content[0] {
            MessageContent::Text(text) => {
                assert!(text.text.len() <= 50);
            }
            _ => panic!("Expected text content"),
        }
    }

    #[test]
    fn test_include_user_message() {
        let message1 = Message {
            role: "system".to_string(),
            content: vec![MessageContent::new_text("First".to_string().repeat(200))],
        };
        let message2 = Message {
            role: "user".to_string(),
            content: vec![MessageContent::new_text("Second".to_string().repeat(50))],
        };
        let messages = vec![message1.clone(), message2.clone()];
        let model = MockModel { max_tokens: 100 };

        let (truncated, truncated_messages) = truncate_messages(messages, &model);

        assert!(truncated);
        assert_eq!(truncated_messages.len(), 2);

        assert_eq!(truncated_messages[0].content.len(), 1);
        match &truncated_messages[0].content[0] {
            MessageContent::Text(text) => {
                assert!(text.text.len() <= 100);
            }
            _ => panic!("Expected text content"),
        }
        assert_eq!(truncated_messages[1].content.len(), 1);
        assert_eq!(truncated_messages[1], message2);
    }
}
