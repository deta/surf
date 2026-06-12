import { markdown as INLINE_SUMMARIZER } from './prompts/inline-summarizer.md'
import { markdown as ACOSTA_TUTOR } from './prompts/acosta-tutor.md'
import { markdown as INLINE_EXPLAINER } from './prompts/inline-explainer.md'
import { markdown as INLINE_TRANSLATE } from './prompts/inline-translate.md'
import { markdown as INLINE_GRAMMAR } from './prompts/inline-grammar.md'
import { markdown as INLINE_TRANSFORM_USER } from './prompts/inline-transform-user.md'
import { markdown as LEGACY_PAGE_CITATIONS } from './prompts/page-citations.md'
import { markdown as PAGE_SUMMARIZE } from './prompts/page-summarize.md'
import { markdown as PAGE_TOC } from './prompts/page-toc.md'
import { markdown as PAGE_TRANSLATE } from './prompts/page-translate.md'
export { markdown as CLASSIFY_CHAT_MODE } from './prompts/classify-chat-mode.md'
export { markdown as CLASSIFY_NOTE_CHAT_MODE } from './prompts/classify-note-chat-mode.md'
export { markdown as PAGE_PROMPTS_GENERATOR_PROMPT } from './prompts/page-prompts-generator.md'
export { markdown as SMART_NOTES_SUGGESTIONS_GENERATOR_PROMPT } from './prompts/smart-note-suggestions-generator.md'
export { markdown as INLINE_TRANSFORM } from './prompts/inline-transform.md'
export { markdown as WIKIPEDIA_TITLE_EXTRACTOR_PROMPT } from './prompts/wikipedia-title-extractor.md'
export { markdown as CHAT_TITLE_GENERATOR_PROMPT } from './prompts/chat-title-generator.md'
export { markdown as FILENAME_CLEANUP_PROMPT } from './prompts/filename-cleanup.md'
export { markdown as BROWSER_HISTORY_QUERY_PROMPT } from './prompts/browser-history-query.md'

export const SIMPLE_SUMMARIZER_PROMPT = `You are a summarizer, summarize the text given to you. Only respond with the summarization.`

/**
 * The Acosta tutor identity — the canonical Acosta platform system prompt.
 * Prepended to the system prompt of every chat in Acosta Browse; chats must
 * never run without it. Maintained in prompts/acosta-tutor.md.
 */
export const ACOSTA_TUTOR_SYSTEM_PROMPT = ACOSTA_TUTOR

export type AcostaUserContext = {
  userName?: string | null
  yearLevel?: string | null
  location?: string | null
  subjects?: string[]
  guardianStatus?: string | null
  memories?: string[]
}

/** Full Acosta system prompt with the per-user context block appended. */
export const buildAcostaSystemPrompt = (context: AcostaUserContext = {}): string => {
  const subjects =
    context.subjects && context.subjects.length > 0 ? context.subjects.join(', ') : 'Not specified'
  const memories =
    context.memories && context.memories.length > 0
      ? context.memories.map((memory) => `- ${memory}`).join('\n')
      : 'No active memories'

  return `${ACOSTA_TUTOR_SYSTEM_PROMPT}

User Context:
Name: ${context.userName || 'Student'}
Year Level: ${context.yearLevel || 'Not specified'}
Location: ${context.location || 'Not specified'}
Subjects: ${subjects}
Guardian Status: ${context.guardianStatus || 'Normal'}

Long-Term Memories (Personalisation):
${memories}`
}

/** Additional system context while a focus session is running. */
export const acostaFocusContextPrompt = (subject: string, task: string): string =>
  `The student is currently in a focus study session. Subject: ${subject}. Task: ${task}. Keep your answers relevant to this task and gently steer the student back to it if their questions drift off-topic.`

/** Pre-built prompts for the page context-menu selection actions. */
export const ACOSTA_SELECTION_PROMPTS = {
  explain: (selection: string): string =>
    `Explain the following in a way that's easy to understand. Break it down step by step and use an example if it helps:\n\n"""\n${selection}\n"""`,
  quiz: (selection: string): string =>
    `Quiz me on the following content. Ask me one question at a time, wait for my answer, then tell me if I'm right and explain why before asking the next question. Start with question 1:\n\n"""\n${selection}\n"""`,
  summarise: (selection: string): string =>
    `Summarise the following into the key points I need to remember for study notes:\n\n"""\n${selection}\n"""`,
  'find-in-syllabus': (selection: string): string =>
    `Where does the following topic fit in the NSW syllabus? Name the subject, stage, and outcome codes if you know them, and explain what I'm expected to be able to do:\n\n"""\n${selection}\n"""`,
  'add-to-notes': (selection: string): string =>
    `Write a concise study-note summary (2-4 sentences) of the following, suitable to sit underneath the quoted text in my notes:\n\n"""\n${selection}\n"""`
} as const
export const LEGACY_PAGE_CITATION_SUMMARY_PROMPT = LEGACY_PAGE_CITATIONS

export const INLINE_PROMPTS = {
  SUMMARIZE: INLINE_SUMMARIZER,
  EXPLAIN: INLINE_EXPLAINER,
  TRANSLATE: INLINE_TRANSLATE,
  GRAMMAR: INLINE_GRAMMAR,
  TRANSFORM_USER: INLINE_TRANSFORM_USER
}

export const PAGE_PROMPTS = {
  SUMMARIZE: PAGE_SUMMARIZE,
  TOC: PAGE_TOC,
  TRANSLATE: PAGE_TRANSLATE
}

export const BUILT_IN_PAGE_PROMPTS = [
  {
    label: 'Summarize',
    prompt:
      'Summarize the page to extract the main points and give a overview of what it is about. Try to stay concise and to the point.'
  }
]

export const EXAMPLE_PROMPTS = [
  {
    id: 'search',
    icon: 'search',
    label: "Why hasn't the computer revolution happened yet?",
    description:
      "Ask about a topic that's interesting to you, and let Surf help you find relevant information.",
    prompt: 'Search the web on why the computer revolution has not happened yet'
  },
  {
    id: 'youtube',
    icon: 'message',
    label: 'YouTube Insights',
    description: 'Open a YouTube video and ask about the details of the content.',
    prompt: 'What did steve say about styluses?',
    url: 'https://www.youtube.com/watch?v=VKpaK670U7s'
  },
  {
    id: 'pdf',
    icon: 'file-text-ai',
    label: 'PDF Analysis',
    description: 'Upload a PDF from your computer and ask for a summary.',
    prompt: 'Summarize the key findings and conclusions presented in this document.'
  },
  {
    id: 'mention',
    icon: 'mention',
    label: 'Mentioning Sources',
    description:
      '@mention any of your notebooks, notes, tabs and/or other media to pinpoint various contexts.',
    prompt: ''
  },
  {
    id: 'note',
    icon: 'note',
    label: 'Note Taking',
    description: 'Compose a note directly in Surf.',
    prompt: ''
  }
]

export type ExamplePrompt = (typeof EXAMPLE_PROMPTS)[number]
