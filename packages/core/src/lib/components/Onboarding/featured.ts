import teaser018smartnotes from '../../../../public/assets/features/018.teaser.png'
import teaser018apps from '../../../../public/assets/features/018.apps.teaser.png'
import { useLocalStorageStore } from '@horizon/utils'

export interface VersionContent {
  label: string
  current: boolean
  emoji?: string
  featureID: string
  title: string
  description: string
  buttonText: string
  image: string
  action: () => void
}

export const versions: VersionContent[] = [
  {
    label: 'Smart Notes',
    featureID: '0.1.8',
    current: true,
    emoji: '',
    title: 'Generate Notes From Your Knowledge',
    description:
      'Smart Notes combines a rich text editor with AI capabilities, enabling you to leverage your personal context(s) while writing. It can assist in research, note-taking, and brainstorming by pulling in relevant information and suggestions from your saved stuff.',
    buttonText: 'Try Smart Notes Now',
    image: teaser018smartnotes,
    // @ts-ignore
    action: () => window.showOnboardingNote()
  }
]

// Feature tracking stores
export const completedFeatures = useLocalStorageStore<string[]>('completedFeatures', [], true)
export const showFeatureModal = useLocalStorageStore<boolean>('showFeatureModal', false, true)
