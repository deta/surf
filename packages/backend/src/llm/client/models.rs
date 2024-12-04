use strum_macros::{Display, EnumString};

#[derive(Debug, Clone, EnumString, Display)]
pub enum Model {
    #[strum(serialize = "gpt-4o")]
    GPT4o,
    #[strum(serialize = "gpt-4o-mini")]
    GPT4oMini,
    #[strum(serialize = "o1-preview")]
    O1Preview,
    #[strum(serialize = "o1-mini")]
    O1Mini,
}

pub trait TokenModel {
    fn max_tokens(&self) -> usize;
}

impl TokenModel for Model {
    // NOTE: the actual max tokens are 128k, but we are using 100k to be safe
    // and for practicality
    fn max_tokens(&self) -> usize {
        match self {
            Model::GPT4o => 100000,
            Model::GPT4oMini => 100000,
            Model::O1Preview => 100000,
            Model::O1Mini => 100000,
        }
    }
}
