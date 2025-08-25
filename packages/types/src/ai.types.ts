import {
  PageChatMessageSentEventError,
  PageChatMessageSentEventTrigger,
} from "./events.types";

export enum Provider {
  OpenAI = "open-ai",
  Anthropic = "anthropic",
  Google = "google",
  Custom = "custom",
}

export enum BuiltInModelIDs {
  GPT4_1 = "gpt-4.1",
  GPT4_1_Mini = "gpt-4.1-mini",
  GPT4o = "gpt-4o",
  GPT4oMini = "gpt-4o-mini",
  O3Mini = "o3-mini",
  ClaudeSonnet = "claude-3-5-sonnet-latest",
  ClaudeSonnet37 = "claude-3-7-sonnet-latest",
  ClaudeHaiku = "claude-3-5-haiku-latest",
  Gemini2Flash = "gemini-2.0-flash",
}

export enum ModelTiers {
  Premium = "premium",
  PremiumVision = "premium_vision",
  Standard = "standard",
}

export enum ChatMode {
  TextOnly = 1,
  TextWithScreenshot = 2,
  AppCreation = 3,
}

export type AIChatData = {
  id: string;
  title: string;
  messages: AIChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type AIDocsSimilarity = {
  index: number;
  similarity: number;
};

export type AIChatMessageRole = "user" | "system" | "assistant";

export type AIChatMessage = {
  id: string; // generated in the frontend
  ai_session_id: string;
  role: AIChatMessageRole;
  status: "success" | "pending" | "error";
  query: string;
  content: string;
  sources?: AIChatMessageSource[];
};

export type AIChatMessageParsed = {
  id: string;
  role: AIChatMessageRole;
  query: string;
  content: string;
  contentItems?: ChatMessageContentItem[];
  sources?: AIChatMessageSource[];
  usedPageScreenshot?: boolean;
  usedInlineScreenshot?: boolean;
  status?: "success" | "pending" | "error" | "cancelled";
};

export type AIChatMessageSource = {
  id: string;
  all_chunk_ids: string[];
  render_id: string;
  resource_id: string;
  content: string;
  uid?: string;
  metadata?: {
    timestamp?: number;
    url?: string;
    page?: number;
  };
};

export type ChatMessageContentItem = {
  type: "text" | "citation";
  content: string;
};

export type YoutubeTranscriptPiece = {
  text: string;
  start: number;
  duration: number;
};

export type YoutubeTranscript = {
  transcript: string;
  metadata: {
    source: string;
    transcript_pieces: YoutubeTranscriptPiece[];
  };
};

export type ChatPrompt = {
  label: string;
  prompt: string;
};

export type ChatError = {
  message: string;
  type: PageChatMessageSentEventError;
};

export type ChatMessageOptions = {
  generationID?: string;
  useContext?: boolean;
  role?: AIChatMessageRole;
  query?: string;
  skipScreenshot?: boolean;
  limit?: number;
  ragOnly?: boolean;
  trigger?: PageChatMessageSentEventTrigger;
  onboarding?: boolean;
  noteResourceId?: string;
};

export type ChatCompletionResponse = {
  output: string | null;
  error: ChatError | null;
};

export namespace ChatMode {
  export function isValid(value: number): value is ChatMode {
    return Object.values(ChatMode).includes(value);
  }
}

export const BuiltInModelLabels = {
  [BuiltInModelIDs.GPT4_1]: "GPT-4.1",
  [BuiltInModelIDs.GPT4_1_Mini]: "GPT-4.1 Mini",
  [BuiltInModelIDs.GPT4o]: "GPT-4o",
  [BuiltInModelIDs.GPT4oMini]: "GPT-4o Mini",
  [BuiltInModelIDs.O3Mini]: "o3 Mini",
  [BuiltInModelIDs.ClaudeSonnet37]: "Claude 3.7 Sonnet",
  [BuiltInModelIDs.ClaudeSonnet]: "Claude 3.5 Sonnet",
  [BuiltInModelIDs.ClaudeHaiku]: "Claude 3.5 Haiku",
  [BuiltInModelIDs.Gemini2Flash]: "Gemini 2.0 Flash",
};

export const ProviderLabels = {
  [Provider.OpenAI]: "Open AI",
  [Provider.Anthropic]: "Anthropic",
  [Provider.Google]: "Google",
  [Provider.Custom]: "Custom",
};

export type Model = {
  id: string;
  label: string;
  provider: Provider;
  tier: ModelTiers;
  icon: string;
  vision: boolean;
  supports_json_format?: boolean;
  max_tokens?: number;
  custom_key?: string;
  provider_url?: string;
  skip_append_open_ai_suffix?: boolean;
  custom_model_name?: string;
};

export const OPEN_AI_PATH_SUFFIX = "/v1/chat/completions";

export const BUILT_IN_MODELS = [
  {
    id: BuiltInModelIDs.GPT4_1,
    label: BuiltInModelLabels[BuiltInModelIDs.GPT4_1],
    provider: Provider.OpenAI,
    tier: ModelTiers.Premium,
    icon: "open-ai",
    vision: true,
    supports_json_format: true,
  },
  {
    id: BuiltInModelIDs.GPT4_1_Mini,
    label: BuiltInModelLabels[BuiltInModelIDs.GPT4_1_Mini],
    provider: Provider.OpenAI,
    tier: ModelTiers.Standard,
    icon: "open-ai",
    vision: true,
    supports_json_format: true,
  },
  {
    id: BuiltInModelIDs.GPT4o,
    label: BuiltInModelLabels[BuiltInModelIDs.GPT4o],
    provider: Provider.OpenAI,
    tier: ModelTiers.Premium,
    icon: "open-ai",
    vision: true,
    supports_json_format: true,
  },
  {
    id: BuiltInModelIDs.GPT4oMini,
    label: BuiltInModelLabels[BuiltInModelIDs.GPT4oMini],
    provider: Provider.OpenAI,
    tier: ModelTiers.Standard,
    icon: "open-ai",
    vision: true,
    supports_json_format: true,
  },
  {
    id: BuiltInModelIDs.O3Mini,
    label: BuiltInModelLabels[BuiltInModelIDs.O3Mini],
    provider: Provider.OpenAI,
    tier: ModelTiers.Premium,
    icon: "open-ai",
    vision: false,
    supports_json_format: true,
  },
  {
    id: BuiltInModelIDs.ClaudeSonnet37,
    label: BuiltInModelLabels[BuiltInModelIDs.ClaudeSonnet37],
    provider: Provider.Anthropic,
    tier: ModelTiers.Premium,
    icon: "claude",
    vision: true,
    supports_json_format: true,
    max_tokens: 128_000,
  },
  {
    id: BuiltInModelIDs.ClaudeSonnet,
    label: BuiltInModelLabels[BuiltInModelIDs.ClaudeSonnet],
    provider: Provider.Anthropic,
    tier: ModelTiers.Premium,
    icon: "claude",
    vision: true,
    supports_json_format: true,
    max_tokens: 128_000,
  },
  {
    id: BuiltInModelIDs.ClaudeHaiku,
    label: BuiltInModelLabels[BuiltInModelIDs.ClaudeHaiku],
    provider: Provider.Anthropic,
    tier: ModelTiers.Standard,
    icon: "claude",
    supports_json_format: true,
    vision: false,
  },
  {
    id: BuiltInModelIDs.Gemini2Flash,
    label: BuiltInModelLabels[BuiltInModelIDs.Gemini2Flash],
    provider: Provider.Google,
    tier: ModelTiers.Standard,
    icon: "gemini",
    supports_json_format: true,
    vision: true,
  },
] as Model[];

export const DEFAULT_AI_MODEL = BuiltInModelIDs.GPT4_1;
