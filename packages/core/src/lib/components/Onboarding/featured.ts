import teaser048noteschat from '../../../../public/assets/features/048.noteschat.png'
import { useLocalStorageStore } from '@horizon/utils'
import { openDialog } from '../Core/Dialog/Dialog.svelte'

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

/**
 * Handle the notes onboarding feature action
 * Checks if the feature is enabled and shows the appropriate UI
 */
async function handleNotesOnboardingAction() {
  try {
    // @ts-ignore
    const userConfig = await window.api?.getUserConfig()

    // Check if the feature is enabled
    const featureEnabled = userConfig?.settings?.experimental_notes_chat_sidebar === true

    // Update versions array with the correct feature
    const featureIndex = versions.findIndex((v) => v.featureID === '0.4.9')
    if (featureIndex >= 0) {
      versions[featureIndex].buttonText = featureEnabled ? 'Try it out' : 'Activate Notes Sidebar'
    }

    if (featureEnabled) {
      // Feature is enabled, show the onboarding
      // @ts-ignore
      window.showNotesOnboarding()
    } else {
      // Feature is not enabled, show a dialog asking to enable it
      const { closeType: confirmed } = await openDialog({
        icon: 'sidebar.right',
        title: 'Enable Notes Sidebar',
        message: 'To use the experimental notes sidebar Surf needs to restart.',
        actions: [
          { title: 'Cancel', type: 'reset' },
          {
            title: 'Enable and Restart',
            type: 'submit',
            kind: 'submit'
          }
        ]
      })

      if (confirmed) {
        // User confirmed, update the setting and restart
        if (userConfig?.settings) {
          userConfig.settings.experimental_notes_chat_sidebar = true
          // @ts-ignore
          await window.api.updateUserConfigSettings(userConfig.settings)
          // @ts-ignore
          setTimeout(() => window.api.restartApp(), 800)
        }
      }
      // If user canceled, do nothing
    }
  } catch (e) {
    console.error('Error in notes feature action', e)
    // Fallback to just showing the onboarding
    // @ts-ignore
    window.showNotesOnboarding()
  }
}

export const versions: VersionContent[] = [
  {
    label: 'Notes Sidebar',
    featureID: '0.4.9',
    current: true,
    emoji: '',
    title: 'Chat becomes Notes',
    description:
      "We've found that Surf's notes and chat were surprisingly close cousins — many things that would start as a chat would turn into a note, and many people wanted the note in the sidebar. So we started wondering: what if the note lived in the sidebar?",
    buttonText: 'Activate Notes Sidebar',
    image: teaser048noteschat,
    // @ts-ignore
    action: handleNotesOnboardingAction
  }
  /*
  {
    label: 'Surflets',
    featureID: '0.2.0',
    current: false,
    emoji: '',
    title: 'Introducing Surflets',
    description:
      'Our chat features (vision & sidebar) have gotten code-generation capabilities! Allowing you to create interactive "Surflets" like mini apps, charts and more, with a single prompt. ',
    buttonText: 'Learn More',
    image: teaser020apps,
    // @ts-ignore
    action: () => window.showCodegenOnboarding()
  },
  {
    label: 'Surf Notes',
    featureID: '0.1.8',
    current: false,
    emoji: '',
    title: 'Generate Notes From Your Knowledge',
    description:
      'Surf Notes combines a rich text editor with AI capabilities, enabling you to leverage your personal context(s) while writing. It can assist in research, note-taking, and brainstorming by pulling in relevant information and suggestions from your saved stuff.',
    buttonText: 'Try Surf Notes Now',
    image: teaser018smartnotes,
    // @ts-ignore
    action: () => window.showOnboardingNote()
  }
  */
]

// Feature tracking stores
export const completedFeatures = useLocalStorageStore<string[]>('completedFeatures', [], true)
export const showFeatureModal = useLocalStorageStore<boolean>('showFeatureModal', false, true)

// Initialize the button text based on the feature status when the component loads
// This needs to run in the browser environment, not during SSR
if (typeof window !== 'undefined' && window.api?.getUserConfig) {
  // Check if the notes sidebar feature is enabled
  window.api
    .getUserConfig()
    .then((userConfig) => {
      if (userConfig?.settings?.experimental_notes_chat_sidebar === true) {
        // Find the feature and update its button text
        const featureIndex = versions.findIndex((v) => v.featureID === '0.4.9')
        if (featureIndex >= 0) {
          versions[featureIndex].buttonText = 'Try it out'
        }
      }
    })
    .catch((e) => {
      console.error('Error checking notes sidebar feature status:', e)
    })
}
