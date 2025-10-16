use super::TokenModel;
use crate::ai::llm::models::{Message, MessageContent};
use std::collections::HashSet;

// reference: https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them
fn estimate_text_tokens(text: &str) -> usize {
    // ~4 characters per token
    text.len().div_ceil(4)
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
        .map(estimate_message_content_tokens)
        .sum()
}

pub fn estimate_messages_tokens(messages: &[Message]) -> usize {
    messages.iter().map(estimate_message_token).sum()
}

// truncate messages to fit the max tokens
//
// the following function gives priority to non-truncatable messages
// and includes as many as possible truncatable messages until tokens are exhausted
pub fn truncate_messages(
    mut messages: Vec<Message>,
    model: &impl TokenModel,
) -> (bool, Vec<Message>) {
    let max_tokens = model.max_tokens();
    let mut truncated_messages: Vec<Message> = Vec::new();
    let mut truncated = false;

    // calculate tokens needed for non-truncatable messages
    messages.reverse();
    let mut required_tokens = 0;
    for message in messages.iter() {
        if !message.truncatable {
            required_tokens += estimate_message_token(message);
        }
    }

    // if we don't have enough tokens for all non-truncatable messages,
    // include as many as possible
    if required_tokens > max_tokens {
        truncated = true;
        let mut remaining_tokens = max_tokens;

        // include non-truncatable messages until we run out of tokens
        for message in messages.iter() {
            if !message.truncatable {
                let message_tokens = estimate_message_token(message);
                if message_tokens <= remaining_tokens {
                    remaining_tokens = remaining_tokens.saturating_sub(message_tokens);
                    truncated_messages.push(message.clone());
                } else {
                    break;
                }
            }
        }

        truncated_messages.reverse();
        return (truncated, truncated_messages);
    }

    // process all messages in order, ensuring space for non-truncatable ones
    let mut remaining_tokens = max_tokens;
    let mut tokens_reserved = required_tokens;

    let mut seen_messages: HashSet<String> = HashSet::new();
    for message in messages.iter() {
        if !message.truncatable {
            // non-truncatable messages are always included as we confirmed enough space above
            let message_tokens = estimate_message_token(message);
            remaining_tokens -= message_tokens;
            tokens_reserved -= message_tokens;
            truncated_messages.push(message.clone());
        } else {
            // for truncatable messages, only use remaining non-reserved tokens
            let available_tokens = remaining_tokens - tokens_reserved;
            let mut total_content_tokens = 0;

            if message.content.is_empty() {
                continue;
            }
            // Even though the content is a vector
            // the presumption is there will always be only one content
            // the conntent is a vector only because of API requirements
            let content = &message.content[0];
            if seen_messages.contains(&content.get_content()) {
                truncated = true;
                continue;
            }
            let content_tokens = estimate_message_content_tokens(content);
            if total_content_tokens + content_tokens > available_tokens {
                truncated = true;
                continue;
            }
            total_content_tokens += content_tokens;
            seen_messages.insert(content.get_content());

            remaining_tokens -= total_content_tokens;
            truncated_messages.push(Message {
                role: message.role.clone(),
                content: message.content.clone(),
                truncatable: message.truncatable,
                is_context: message.is_context,
            });
        }
    }
    truncated_messages.reverse();
    (truncated, truncated_messages)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::llm::models::{ContextMessage, Message, MessageContent};

    struct MockModel {
        // NOTE: the token estimation is 4 characters per token
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
        let message = Message::new_system("Hello world").with_truncatable(true);
        let messages = vec![message.clone()];
        let model = MockModel { max_tokens: 100 };

        let (truncated, truncated_messages) = truncate_messages(messages, &model);
        assert!(!truncated);
        assert_eq!(truncated_messages, vec![message]);
    }

    #[test]
    fn test_text_message_truncation() {
        let long_text = "a".repeat(1000);
        let message = Message::new_system(&long_text).with_truncatable(true);
        let messages = vec![message];
        let model = MockModel { max_tokens: 50 };

        let (truncated, truncated_messages) = truncate_messages(messages, &model);
        assert!(truncated);
        assert_eq!(truncated_messages.len(), 0);
    }

    #[test]
    fn test_multiple_messages() {
        let should_truncate = &"a".repeat(50);
        let should_not_truncate = &"b".repeat(50);

        let message1 = Message::new_system(should_truncate).with_truncatable(true);
        let message2 = Message::new_system(should_not_truncate).with_truncatable(true);
        let messages = vec![message1.clone(), message2.clone()];

        let model = MockModel { max_tokens: 15 };

        let (truncated, truncated_messages) = truncate_messages(messages, &model);
        assert!(truncated);
        assert_eq!(truncated_messages.len(), 1);
        assert_eq!(truncated_messages[0].content.len(), 1);
        assert_eq!(
            truncated_messages[0].content[0],
            MessageContent::new_text(should_not_truncate.to_string())
        );
    }

    #[test]
    fn test_truncate_image_message() {
        let message = Message::new_image("https://example.com/image.jpg");
        let messages = vec![message];
        let model = MockModel { max_tokens: 10 };

        let (truncated, truncated_messages) = truncate_messages(messages, &model);
        assert!(truncated);
        assert_eq!(truncated_messages.len(), 0);
    }

    #[test]
    fn test_include_non_truncatable_message() {
        let message1 = Message::new_context(&ContextMessage {
            id: "test".to_string(),
            content: Some("a".to_string().repeat(200)),
            content_type: "test content type".to_string(),
            title: None,
            author: None,
            source_url: None,
            page: None,
            description: None,
            created_at: None,
        })
        .expect("Failed to create context message");

        let user_text = "a".repeat(200);
        let message2 = Message::new_user(&user_text).with_truncatable(false);

        let messages = vec![message1.clone(), message2.clone()];
        let model = MockModel { max_tokens: 50 };

        let (truncated, truncated_messages) = truncate_messages(messages, &model);

        assert!(truncated);
        assert_eq!(truncated_messages.len(), 1);

        assert_eq!(truncated_messages[0].content.len(), 1);
        match &truncated_messages[0].content[0] {
            MessageContent::Text(text) => {
                assert!(text.text.len() == 200);
                assert_eq!(text.text, user_text);
            }
            _ => panic!("Expected text content"),
        }
    }

    #[test]
    fn test_multiple_non_truncatable_messages_under_limit() {
        let message1 = Message::new_user("First message").with_truncatable(false);
        let message2 = Message::new_user("Second message").with_truncatable(false);
        let message3 = Message::new_user("Third truncatable").with_truncatable(true);

        let messages = vec![message1.clone(), message2.clone(), message3.clone()];
        let model = MockModel { max_tokens: 100 };

        let (truncated, truncated_messages) = truncate_messages(messages, &model);

        assert!(!truncated);
        assert_eq!(truncated_messages.len(), 3);
        assert_eq!(truncated_messages[0], message1);
        assert_eq!(truncated_messages[1], message2);
        assert_eq!(truncated_messages[2], message3);
    }

    #[test]
    fn test_multiple_non_truncatable_messages_exceed_limit() {
        let message1 = Message::new_user(&"a".repeat(120)).with_truncatable(false);
        let message2 = Message::new_user(&"b".repeat(120)).with_truncatable(false);
        let message3 = Message::new_user(&"c".repeat(120)).with_truncatable(false);

        let messages = vec![message1.clone(), message2.clone(), message3.clone()];
        let model = MockModel { max_tokens: 30 }; // only enough tokens for last message

        let (truncated, truncated_messages) = truncate_messages(messages, &model);

        assert!(truncated);
        assert_eq!(truncated_messages.len(), 1);
        assert_eq!(truncated_messages[0], message3);
    }

    #[test]
    fn test_mixed_messages_with_non_truncatable_priority() {
        let non_trunc1 = Message::new_user(&"a".repeat(40)).with_truncatable(false);
        let trunc1 = Message::new_user(&"b".repeat(40)).with_truncatable(true);
        let non_trunc2 = Message::new_user(&"c".repeat(40)).with_truncatable(false);
        let trunc2 = Message::new_user(&"d".repeat(40)).with_truncatable(true);

        let messages = vec![
            non_trunc1.clone(),
            trunc1.clone(),
            non_trunc2.clone(),
            trunc2.clone(),
        ];
        let model = MockModel { max_tokens: 10 }; // only enough for one non-truncatable message

        let (truncated, truncated_messages) = truncate_messages(messages, &model);

        assert!(truncated);
        assert_eq!(truncated_messages.len(), 1);
        // latest non-truncatable message should be included
        assert_eq!(truncated_messages[0], non_trunc2);
    }

    #[test]
    fn test_truncatable_messages_get_remaining_space() {
        let non_trunc = Message::new_user(&"a".repeat(40)).with_truncatable(false);
        let trunc1 = Message::new_user(&"b".repeat(40)).with_truncatable(true);
        let trunc2 = Message::new_user(&"c".repeat(40)).with_truncatable(true);

        let messages = vec![trunc1.clone(), non_trunc.clone(), trunc2.clone()];
        let model = MockModel { max_tokens: 20 }; // enough for non-truncatable and one truncatable

        let (truncated, truncated_messages) = truncate_messages(messages, &model);

        assert!(truncated);
        assert_eq!(truncated_messages.len(), 2);
        assert_eq!(truncated_messages[0], non_trunc);
        assert_eq!(truncated_messages[1], trunc2);
    }

    #[test]
    fn test_exact_token_limit_with_non_truncatable() {
        let message = Message::new_user(&"a".repeat(40)).with_truncatable(false);
        let messages = vec![message.clone()];
        let model = MockModel { max_tokens: 10 }; // exactly matches the tokens needed

        let (truncated, truncated_messages) = truncate_messages(messages, &model);

        assert!(!truncated);
        assert_eq!(truncated_messages.len(), 1);
        assert_eq!(truncated_messages[0], message);
    }

    #[test]
    fn test_preserve_order_with_available_tokens() {
        let message1 = Message::new_user("First").with_truncatable(true);
        let message2 = Message::new_user("Second").with_truncatable(false);
        let message3 = Message::new_user("Third").with_truncatable(true);
        let message4 = Message::new_user("Fourth").with_truncatable(false);

        let messages = vec![
            message1.clone(),
            message2.clone(),
            message3.clone(),
            message4.clone(),
        ];
        let model = MockModel { max_tokens: 100 }; // enough for all messages

        let (truncated, truncated_messages) = truncate_messages(messages, &model);

        assert!(!truncated);
        assert_eq!(truncated_messages.len(), 4);
        assert_eq!(truncated_messages[0], message1);
        assert_eq!(truncated_messages[1], message2);
        assert_eq!(truncated_messages[2], message3);
        assert_eq!(truncated_messages[3], message4);
    }

    #[test]
    fn test_remove_duplicates() {
        let should_be_removed = Message::new_user("First").with_truncatable(true);
        let second = Message::new_user("Second").with_truncatable(false);
        let third = Message::new_user("First").with_truncatable(true);
        let fourth = Message::new_user("Fourth").with_truncatable(false);

        let messages = vec![
            should_be_removed.clone(),
            second.clone(),
            third.clone(),
            fourth.clone(),
        ];
        let model = MockModel { max_tokens: 100 }; // enough for all messages

        let (truncated, truncated_messages) = truncate_messages(messages, &model);

        assert!(truncated);
        assert_eq!(truncated_messages.len(), 3);
        assert_eq!(truncated_messages[0], second);
        assert_eq!(truncated_messages[1], third);
        assert_eq!(truncated_messages[2], fourth);
    }
}
