import * as CodegenOnboardingNote0 from './00.onboarding.md'
import { isMac } from '@horizon/utils'
import ImageCodegen from '../../../../public/assets/onboarding/codegen/codegen.png?url'
import ImageTable from '../../../../public/assets/onboarding/codegen/table.png?url'
import ImageSave from '../../../../public/assets/onboarding/codegen/save.png?url'
import ImageDrop from '../../../../public/assets/onboarding/codegen/dropontonotes.gif?url'
import ImageFilter from '../../../../public/assets/onboarding/codegen/filter.gif?url'

export type CodegenOnboardingNote = {
  id: string
  title: string
  html: string
  attributes: Record<string, unknown>
}

const prepareHTML = (html: string) => {
  return html
    .replaceAll('codegen.png', ImageCodegen)
    .replaceAll('table.png', ImageTable)
    .replaceAll('save.png', ImageSave)
    .replaceAll('dropontonotes.gif', ImageDrop)
    .replaceAll('filter.gif', ImageFilter)
    .replaceAll('$MOD', isMac() ? '⌘' : 'Ctrl')
    .replaceAll('$OPT', isMac() ? '⌥' : 'Alt')
}

const createNote = (note: typeof CodegenOnboardingNote0, idx: number) => {
  return {
    id: note.attributes.id || `codegen-onboarding-note-${idx}`,
    title: note.attributes.title as string,
    html: prepareHTML(note.html),
    attributes: note.attributes
  } as CodegenOnboardingNote
}

const notes = [CodegenOnboardingNote0]

export const ONBOARDING_CODEGEN = notes.map(createNote)

export const CODEGEN_ONBOARDING_RESOURCE_ID = 'onboarding-codegen'
