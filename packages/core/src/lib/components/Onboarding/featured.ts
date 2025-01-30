import teaser018smartnotes from '../../../../public/assets/features/018.teaser.png'
import teaser020apps from '../../../../public/assets/features/020.createapps.png'
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
    label: 'Generate Artifacts',
    featureID: '0.2.0',
    current: true,
    emoji: '',
    title: 'Generating your own Artifacts, now in Surf',
    description:
      'Our chat features (vision & sidebar) have gotten code-generation capabilities! Allowing you to create interactive artifacts like mini apps, charts and more, with a single prompt. ',
    buttonText: 'Try Creating Artifacts',
    image: teaser020apps,
    // @ts-ignore
    action: () => window.showCodegenOnboarding()
  },
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
