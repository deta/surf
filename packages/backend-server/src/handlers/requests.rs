use strum_macros::EnumString;

#[derive(Debug, Clone, EnumString)]
#[strum(serialize_all = "snake_case")]
pub enum Requests {
    LLMChatCompletion,
    GetDocsSimilarity,
    EncodeSentences,
    FilteredSearch,
    UpsertEmbeddings,
}
