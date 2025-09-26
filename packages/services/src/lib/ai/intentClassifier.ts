import type {
  IntentType,
  QuickGuessResult,
  ClassificationResult,
  ClassificationResultWithRoute,
  BatchClassificationResult
} from './intentClassifier.types'

export function quickGuess(s: string): QuickGuessResult {
  const t = s.trim()
  if (!t) return 'ambiguous'
  if (t.includes('?')) return 'question'
  const lower = t.toLowerCase()
  if (/(https?:\/\/|www\.)/.test(lower) || /\.[a-z]{2,}$/.test(lower)) return 'search'
  if (/\b(site:|filetype:|intitle:|inurl:|OR|\-)\b/i.test(t)) return 'search'
  if (
    /^(how|why|what|who|when|where|which|can|could|should|do|does|did|is|are|am|was|were|explain|tell me|note|create)\b/i.test(
      t
    )
  )
    return 'question'
  const tokens = t.split(/\s+/)
  if (tokens.length <= 4 && !/[!.?]/.test(t)) return 'search'
  return 'ambiguous'
}

export async function classifyIntent(text: string): Promise<ClassificationResult> {
  return fallbackClassify(text)
}

function fallbackClassify(text: string): ClassificationResult {
  const guess = quickGuess(text)

  if (guess === 'question') {
    return { intent: 'llm', confidence: 0.85 }
  } else if (guess === 'search') {
    return { intent: 'search', confidence: 0.85 }
  } else {
    // For ambiguous cases, use additional heuristics
    const lower = text.toLowerCase()
    const hasQuestionWords =
      /\b(explain|describe|tell me|show me|help|tutorial|guide|learn)\b/.test(lower)
    const hasComplexSentence = text.split(/[.!?]/).length > 1
    const wordCount = text.trim().split(/\s+/).length

    if (hasQuestionWords || hasComplexSentence || wordCount > 8) {
      return { intent: 'llm', confidence: 0.65 }
    } else {
      return { intent: 'search', confidence: 0.65 }
    }
  }
}

export async function classifyBatch(texts: string[]): Promise<BatchClassificationResult[]> {
  const results = await Promise.all(
    texts.map(async (text) => {
      const result = await classifyIntent(text)
      return {
        intent: result.intent,
        pLLM: result.intent === 'llm' ? result.confidence : 1 - result.confidence
      }
    })
  )

  return results
}

export async function decideIntent(s: string): Promise<ClassificationResultWithRoute> {
  const fast = quickGuess(s)

  if (fast !== 'ambiguous') {
    return {
      intent: fast === 'question' ? 'llm' : 'search',
      confidence: 0.95,
      route: 'rules'
    }
  }

  const { intent, confidence } = await classifyIntent(s)

  if (confidence >= 0.6) {
    return { intent, confidence, route: 'onnx' }
  }

  if (confidence <= 0.4) {
    return { intent, confidence, route: 'onnx' }
  }

  return { intent, confidence, route: 'onnx-ambiguous' }
}
