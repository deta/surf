export type IntentType = 'search' | 'llm'

export type QuickGuessResult = 'search' | 'question' | 'ambiguous'

export type ClassificationRoute = 'rules' | 'onnx' | 'onnx-ambiguous' | 'fallback'

export interface ClassificationResult {
  intent: IntentType
  confidence: number
}

export interface ClassificationResultWithRoute extends ClassificationResult {
  route: ClassificationRoute
}

export interface BatchClassificationResult {
  intent: IntentType
  pLLM: number
}
