import * as OnboardingNote0 from './00.onboarding.md'
import * as OnboardingNote1 from './01.onboarding.md'
import * as OnboardingNote2 from './02.onboarding.md'
import * as OnboardingNote3 from './03.onboarding.md'
import * as OnboardingNote4 from './04.onboarding.md'
import * as OnboardingNote5 from './05.onboarding.md'

import ImageSmartNotes from '../../../../public/assets/onboarding/notes/smart-notes.png?url'
import ImageSuggestions from '../../../../public/assets/onboarding/notes/suggestions.png?url'
import ImageRewrite from '../../../../public/assets/onboarding/notes/rewrite.png?url'
import ImageAutocomplete from '../../../../public/assets/onboarding/notes/autocomplete.png?url'
import { isMac } from '@horizon/utils'

export type OnboardingNote = {
  id: string
  title: string
  html: string
  attributes: Record<string, unknown>
}

const prepareHTML = (html: string) => {
  return html
    .replaceAll('smart-notes.png', ImageSmartNotes)
    .replaceAll('smart-notes-suggestions.png', ImageSuggestions)
    .replaceAll('smart-notes-rewrite.png', ImageRewrite)
    .replaceAll('smart-notes-autocomplete.png', ImageAutocomplete)
    .replaceAll('$MOD', isMac() ? '⌘' : 'Ctrl')
    .replaceAll('$OPT', isMac() ? '⌥' : 'Alt')
}

const createNote = (note: typeof OnboardingNote1, idx: number) => {
  return {
    id: note.attributes.id || `onboarding-note-${idx}`,
    title: note.attributes.title as string,
    html: prepareHTML(note.html),
    attributes: note.attributes
  } as OnboardingNote
}

const notes = [
  OnboardingNote0,
  OnboardingNote1,
  OnboardingNote2,
  OnboardingNote3,
  //   OnboardingNote4, // Disabled for now since the feature is not reliable enough
  OnboardingNote5
]

export const ONBOARDING_NOTES = notes.map(createNote)
