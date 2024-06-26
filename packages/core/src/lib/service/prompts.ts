import { get, writable } from 'svelte/store'
import { INLINE_PROMPTS, PAGE_PROMPTS } from '../constants/prompts'
import type { EditablePrompt } from '@horizon/types'
import log from '../utils/log'
import { HorizonDatabase } from './storage'

export enum PromptIDs {
  INLINE_SUMMARIZER = 'inline_summarize',
  INLINE_EXPLAINER = 'inline_explain',
  INLINE_TRANSLATE = 'inline_translate',
  INLINE_GRAMMAR = 'inline_spell_check',
  INLINE_TRANSFORM_USER = 'inline_user_transform',
  PAGE_SUMMARIZER = 'page_summarize',
  PAGE_TOC = 'page_toc',
  PAGE_TRANSLATOR = 'page_translate'
}

export type PromptID = keyof PromptIDs

const EDITABLE_PROMPTS = [
  {
    id: PromptIDs.INLINE_SUMMARIZER,
    kind: 'inline',
    title: 'Summarizer',
    description: 'Summarizes the text selected by the user inside the page.',
    content: INLINE_PROMPTS.SUMMARIZE
  },
  {
    id: PromptIDs.INLINE_EXPLAINER,
    kind: 'inline',
    title: 'Explainer',
    description: 'Explains the text selected by the user inside the page.',
    content: INLINE_PROMPTS.EXPLAIN
  },
  {
    id: PromptIDs.INLINE_TRANSLATE,
    kind: 'inline',
    title: 'Translator',
    description: 'Translates the text selected by the user inside the page.',
    content: INLINE_PROMPTS.TRANSLATE
  },
  {
    id: PromptIDs.INLINE_GRAMMAR,
    kind: 'inline',
    title: 'Spell Checker',
    description: 'Checks the text selected by the user inside the page for grammar.',
    content: INLINE_PROMPTS.GRAMMAR
  },
  {
    id: PromptIDs.INLINE_TRANSFORM_USER,
    kind: 'inline',
    title: 'Custom User Prompt',
    description:
      'Transforms the text selected by the user inside the page using a user-defined prompt.',
    content: INLINE_PROMPTS.TRANSFORM_USER
  },
  {
    id: PromptIDs.PAGE_SUMMARIZER,
    kind: 'page',
    title: 'Summarizer',
    description: 'Summarizes the entire page.',
    content: PAGE_PROMPTS.SUMMARIZE
  },
  {
    id: PromptIDs.PAGE_TOC,
    kind: 'page',
    title: 'Table of Contents',
    description: 'Generates a table of contents for the entire page.',
    content: PAGE_PROMPTS.TOC
  },
  {
    id: PromptIDs.PAGE_TRANSLATOR,
    kind: 'page',
    title: 'Translator',
    description: 'Translates the entire page.',
    content: PAGE_PROMPTS.TRANSLATE
  }
] as EditablePrompt[]

const storage = new HorizonDatabase()

const prompts = storage.prompts

const getChanges = async () => {
  const changes = await prompts.all()

  return new Map(changes.map((p) => [p.id, p.content]))
}

const getChange = async (id: PromptIDs) => {
  const change = await prompts.read(id)
  return change?.content
}

const saveChange = async (prompt: EditablePrompt) => {
  const change = await prompts.read(prompt.id)
  if (change) {
    await prompts.update(prompt.id, prompt)
    return
  }

  await prompts.create(prompt)
}

const resetChange = async (id: PromptIDs) => {
  await prompts.delete(id)
}

export const getPrompts = async () => {
  log.debug('Getting prompts')
  const allChanges = await getChanges()

  return EDITABLE_PROMPTS.map((p) => {
    const changes = allChanges.get(p.id)
    if (changes) {
      return { ...p, content: changes }
    }

    return p
  })
}

export const getPrompt = async (id: PromptIDs) => {
  log.debug('Getting prompt', id)
  const prompt = EDITABLE_PROMPTS.find((p) => p.id === id)
  if (!prompt) {
    throw new Error(`Prompt with id ${id} not found`)
  }

  const changes = await getChange(id)
  if (changes) {
    return { ...prompt, content: changes }
  }

  return prompt
}

export const updatePrompt = async (id: PromptIDs, content: string) => {
  log.debug('Updating prompt', id, content)

  const prompt = EDITABLE_PROMPTS.find((p) => p.id === id)
  if (!prompt) {
    throw new Error(`Prompt with id ${id} not found`)
  }

  await saveChange({ ...prompt, content })
}

export const resetPrompt = (id: PromptIDs) => {
  log.debug('Resetting prompt', id)

  const prompt = EDITABLE_PROMPTS.find((p) => p.id === id)
  if (!prompt) {
    throw new Error(`Prompt with id ${id} not found`)
  }

  resetChange(id)
}
