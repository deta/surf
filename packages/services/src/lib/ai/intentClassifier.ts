import type {
  QuickGuessResult,
  ClassificationResult,
  ClassificationResultWithRoute,
  BatchClassificationResult
} from './intentClassifier.types'

// compiled regexes once at module load time
const REGEX_PATTERNS = {
  url: /(https?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,})/i,
  domain: /(?:^|\s)([a-z0-9-]+\.)+[a-z]{2,}(?:\/|\s|$)/i,
  searchOperators: /\b(site:|filetype:|intitle:|inurl:|OR|\-)\b/i,
  questionStarters:
    /^(how|why|what|who|when|where|which|can|could|should|do|does|did|is|are|am|was|were|explain|tell me|note|create)\b/i,
  questionWords: /\b(explain|describe|tell me|show me|help|tutorial|guide|learn)\b/,
  sentenceSplitter: /[.!?]/
} as const

export function quickGuess(s: string): QuickGuessResult {
  const t = s.trim()
  if (!t) return 'ambiguous'

  if (t.includes('?')) return 'question'

  const lower = t.toLowerCase()

  if (REGEX_PATTERNS.url.test(lower)) return 'search'

  if (REGEX_PATTERNS.domain.test(lower)) return 'search'

  if (REGEX_PATTERNS.searchOperators.test(t)) return 'search'

  if (REGEX_PATTERNS.questionStarters.test(t)) return 'question'

  // short queries (<=4 words) default to search
  const tokens = t.split(/\s+/)
  if (tokens.length <= 4) return 'search'

  return 'ambiguous'
}

export async function classifyIntent(text: string): Promise<ClassificationResult> {
  return fallbackClassify(text)
}

function fallbackClassify(text: string): ClassificationResult {
  const guess = quickGuess(text)

  if (guess === 'question') {
    return { intent: 'llm', confidence: 0.85 }
  }

  if (guess === 'search') {
    return { intent: 'search', confidence: 0.85 }
  }

  const lower = text.toLowerCase()
  const hasQuestionWords = REGEX_PATTERNS.questionWords.test(lower)
  const hasComplexSentence = REGEX_PATTERNS.sentenceSplitter.test(text)
  const wordCount = text.trim().split(/\s+/).length

  if (hasQuestionWords || hasComplexSentence || wordCount > 8) {
    return { intent: 'llm', confidence: 0.65 }
  }

  return { intent: 'search', confidence: 0.65 }
}

export async function classifyBatch(texts: string[]): Promise<BatchClassificationResult[]> {
  return texts.map((text) => {
    const result = fallbackClassify(text)
    return {
      intent: result.intent,
      pLLM: result.intent === 'llm' ? result.confidence : 1 - result.confidence
    }
  })
}

export async function decideIntent(s: string): Promise<ClassificationResultWithRoute> {
  const { intent, confidence } = fallbackClassify(s)

  const route = confidence >= 0.8 ? 'rules' : 'fallback'

  return { intent, confidence, route }
}
