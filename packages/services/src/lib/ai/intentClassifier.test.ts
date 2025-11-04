import { describe, it, expect } from 'vitest'
import { quickGuess, classifyIntent, decideIntent } from './intentClassifier'

describe('Intent Classifier', () => {
  describe('quickGuess', () => {
    it('should classify URLs as search', () => {
      expect(quickGuess('https://github.com')).toBe('search')
      expect(quickGuess('www.example.com')).toBe('search')
      expect(quickGuess('github.com')).toBe('search')
      expect(quickGuess('github.')).toBe('search')
      expect(quickGuess('github.com/deta/surf')).toBe('search')
    })

    it('should classify questions with ? as question', () => {
      expect(quickGuess('what is TypeScript?')).toBe('question')
      expect(quickGuess('how are you?')).toBe('question')
    })

    it('should classify question starters as question', () => {
      expect(quickGuess('how do I learn Python')).toBe('question')
      expect(quickGuess('what is the weather')).toBe('question')
      expect(quickGuess('explain quantum computing')).toBe('question')
    })

    it('should classify short queries as search', () => {
      expect(quickGuess('weather paris')).toBe('search')
      expect(quickGuess('best pizza')).toBe('search')
      expect(quickGuess('life in mars.')).toBe('search')
      expect(quickGuess('nodejs tutorial')).toBe('search')
    })

    it('should handle search operators', () => {
      expect(quickGuess('site:github.com typescript')).toBe('search')
      expect(quickGuess('filetype:pdf machine learning')).toBe('search')
    })

    it('should classify longer queries as ambiguous', () => {
      expect(quickGuess('the quick brown fox jumps over')).toBe('ambiguous')
    })

    it('should handle edge cases', () => {
      expect(quickGuess('')).toBe('ambiguous')
      expect(quickGuess('   ')).toBe('ambiguous')
    })

    it('should NOT falsely classify sentences ending with period', () => {
      expect(quickGuess('Please help me.')).toBe('search') // 3 words = search
      expect(quickGuess('I need assistance with this.')).toBe('ambiguous') // 5 words
    })
  })

  describe('classifyIntent', () => {
    it('should return llm intent for questions', async () => {
      const result = await classifyIntent('how do I code?')
      expect(result.intent).toBe('llm')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    it('should return search intent for short queries', async () => {
      const result = await classifyIntent('weather today')
      expect(result.intent).toBe('search')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    it('should handle ambiguous cases with question words', async () => {
      const result = await classifyIntent('please explain the situation to me')
      expect(result.intent).toBe('llm')
    })
  })

  describe('decideIntent', () => {
    it('should use rules route for high confidence', async () => {
      const result = await decideIntent('what is this?')
      expect(result.route).toBe('rules')
      expect(result.confidence).toBeGreaterThanOrEqual(0.8)
    })

    it('should use fallback route for lower confidence', async () => {
      const result = await decideIntent('the weather seems nice today for a walk')
      expect(result.route).toBe('fallback')
    })
  })
})
