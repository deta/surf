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

const prepareHTML = (html: string) => {
  return html
    .replace('smart-notes.png', ImageSmartNotes)
    .replace('smart-notes-suggestions.png', ImageSuggestions)
    .replace('smart-notes-rewrite.png', ImageRewrite)
    .replace('smart-notes-autocomplete.png', ImageAutocomplete)
}

const createNote = (note: typeof OnboardingNote1, idx: number) => {
  return {
    id: note.attributes.id || `onboarding-note-${idx}`,
    title: note.attributes.title as string,
    html: prepareHTML(note.html),
    attributes: note.attributes
  }
}

const notes = [
  OnboardingNote0,
  OnboardingNote1,
  OnboardingNote2,
  OnboardingNote3,
  OnboardingNote4,
  OnboardingNote5
]

export const ONBOARDING_NOTES = notes.map(createNote)
