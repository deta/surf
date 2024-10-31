import { isMac } from '@horizon/utils'

export interface TooltipStep {
  target: string
  headline: string
  content: string
  domTarget: string
  domRoot: string
  position: {
    vertical: 'top' | 'bottom' | 'center'
    horizontal: 'left' | 'right' | 'center'
    offsetX?: number
    offsetY?: number
  }
  nextButtonLabel?: string
  prevButtonLabel?: string
  action?: string
  mediaID?: string
  mediaType?: 'image' | 'video'
  zIndex?: number
}

export interface OnboardingTimeline {
  name: string
  steps: TooltipStep[]
}

export enum OnboardingFeature {
  SavingOnboarding = 'savingOnboarding',
  ChatWithSpaceOnboardingInChat = 'chatWithSpaceOnboardingInChat',
  ChatWithSpaceOnboardingInStuff = 'chatWithSpaceOnboardingInStuff',
  StuffOnboarding = 'stuffOnboarding',
  SmartSpacesOnboarding = 'smartSpacesOnboarding'
}

export const savingTimeline: OnboardingTimeline = {
  name: OnboardingFeature.SavingOnboarding,
  steps: [
    {
      target: '#saving.onboarding.1',
      headline: 'Saving Items',
      content:
        "We opened a few tabs for you. You can save them by clicking the bookmark flower icon, or doing right-click and selecting 'Save Tab'.",
      position: { vertical: 'bottom', horizontal: 'left', offsetY: 120, offsetX: 10 },
      domTarget: 'demo-space',
      domRoot: 'body',
      nextButtonLabel: "Alright, let's save them!",
      mediaID: 'saving',
      mediaType: 'video'
    }
  ]
}

export const chatWithSpaceOnboardingInStuffTimeline: OnboardingTimeline = {
  name: OnboardingFeature.ChatWithSpaceOnboardingInStuff,
  steps: [
    {
      target: '#chat.onboarding.stuff.1',
      headline: 'Chatting with a Space',
      content:
        "In Surf, you can chat with all of the items you save. This includes spaces, tabs, and bookmarks. Let's start by chatting with a space.",
      position: { vertical: 'top', horizontal: 'left', offsetY: 26, offsetX: 10 },
      domTarget: 'demo-space',
      domRoot: 'stuff',
      nextButtonLabel: 'Start'
    },
    {
      target: '#chat.onboarding.stuff.2',
      headline: 'Add a Space into Context',
      content:
        'We created a demo space for you. Add the space into context by dragging it into the context bar. Alternatively, you could also do a right-click and select "Chat with Space".',
      position: { vertical: 'top', horizontal: 'left', offsetY: 26, offsetX: 10 },
      domTarget: 'demo-space',
      domRoot: 'stuff',
      nextButtonLabel: 'Got it!',
      mediaID: 'chat.drag.into.context',
      mediaType: 'video'
    }
  ]
}

export const chatWithSpaceOnboardingInChatTimeline: OnboardingTimeline = {
  name: OnboardingFeature.ChatWithSpaceOnboardingInChat,
  steps: [
    {
      target: '#chat.onboarding.chat.1',
      headline: 'Chat',
      content: 'You are now chatting with a space.',
      position: { vertical: 'bottom', horizontal: 'right', offsetY: 150, offsetX: 30 },
      domTarget: '',
      domRoot: 'body',
      nextButtonLabel: 'Continue'
    },
    {
      target: '#chat.onboarding.chat.2',
      headline: 'Context Bar',
      content:
        'This is your context bar. It currently contains a space, but you can also chat with any number of tabs if you want.',
      position: { vertical: 'bottom', horizontal: 'right', offsetY: 150, offsetX: 150 },
      domTarget: 'context-bar',
      domRoot: 'body',
      prevButtonLabel: 'Back',
      nextButtonLabel: 'Continue'
    },
    {
      target: '#chat.onboarding.chat.3',
      headline: 'Try asking...',
      content: 'Now hit the send button to get an answer to this question.',
      position: { vertical: 'bottom', horizontal: 'right', offsetY: 150, offsetX: 150 },
      domTarget: 'send-chat-message',
      domRoot: 'body',
      action: 'send-chat-message',
      prevButtonLabel: 'Back',
      nextButtonLabel: 'Send it!'
    },
    {
      target: '#chat.onboarding.chat.4',
      headline: 'Citations',
      content:
        "Your answer is streaming in. What's special in Surf is that your answers are backed by citations. You can click on the citations to see the source. In this case, some timestamps from the YouTube video.",
      position: { vertical: 'bottom', horizontal: 'right', offsetY: 150, offsetX: 150 },
      domTarget: 'chat-citation',
      domRoot: 'body',
      prevButtonLabel: 'Back',
      nextButtonLabel: 'Done'
    }
  ]
}

export const stuffOnboardingTimeline: OnboardingTimeline = {
  name: OnboardingFeature.StuffOnboarding,
  steps: [
    {
      target: '#stuff.onboarding.1',
      headline: 'Your Stuff',
      content:
        'This is your stuff. Your new home for all the things that you encounter on the web. Articles, websites, documents. You can save them all here.',
      position: { vertical: 'top', horizontal: 'left', offsetY: 26, offsetX: 10 },
      domTarget: 'stuff-container',
      domRoot: 'stuff',
      nextButtonLabel: 'Continue',
      mediaID: 'stuff.onboarding.01',
      mediaType: 'image'
    },
    {
      target: '#stuff.onboarding.2',
      headline: 'Spaces',
      content:
        'You can have multiple spaces. You can also open a space as a tab and rename it (double-click).',
      position: { vertical: 'top', horizontal: 'left', offsetY: 26, offsetX: 10 },
      domTarget: 'stuff-spaces-list',
      domRoot: 'stuff',
      prevButtonLabel: 'Previous',
      nextButtonLabel: 'Next',
      mediaID: 'stuff.onboarding.spaces',
      mediaType: 'video'
    },
    {
      target: '#stuff.onboarding.2',
      headline: 'Your Inbox',
      content:
        'This is your default space where all your saved items are initially stored. Think of it as your digital inbox for web content.',
      position: { vertical: 'top', horizontal: 'left', offsetY: 26, offsetX: 10 },
      domRoot: 'stuff',
      domTarget: 'stuff-spaces-all',
      prevButtonLabel: 'Previous',
      nextButtonLabel: 'Next'
    },
    {
      target: '#stuff.onboarding.3',
      headline: 'Managing Stuff',
      content: 'Move items between spaces by simply right-clicking or dragging them.',
      position: { vertical: 'top', horizontal: 'left', offsetY: 26, offsetX: 380 },
      domRoot: 'stuff',
      domTarget: 'stuff-example-resource',
      prevButtonLabel: 'Previous',
      nextButtonLabel: 'Next',
      mediaID: 'stuff.onboarding.select',
      mediaType: 'video'
    },
    {
      target: '#stuff.onboarding.4',
      headline: 'One more thing: Multi-select',
      content: `You can also multi-select more items by click-dragging or using ${
        isMac() ? '⌘' : 'CTRL'
      } + Click.`,
      position: { vertical: 'top', horizontal: 'left', offsetY: 26, offsetX: 380 },
      domRoot: 'stuff',
      domTarget: '',
      prevButtonLabel: 'Previous',
      nextButtonLabel: "Let's go!",
      mediaID: 'chat.with.space',
      mediaType: 'video'
    },
    {
      target: '#stuff.onboarding.5',
      headline: 'Close',
      content: `You can exit your stuff by clicking outside of the stuff area or by hitting ESC.`,
      position: { vertical: 'top', horizontal: 'left', offsetY: 26, offsetX: 26 },
      domRoot: 'stuff',
      domTarget: '',
      prevButtonLabel: 'Previous',
      nextButtonLabel: 'Finish.'
    }
  ]
}

export const smartSpacesOnboardingTimeline: OnboardingTimeline = {
  name: OnboardingFeature.SmartSpacesOnboarding,
  steps: [
    {
      target: '#smartspaces.stuff.1',
      headline: 'Premise',
      content:
        "You know, stuff on your computer can get messy sometimes. That's why we created Smart Spaces. They help you to organize your stuff better.",
      position: { vertical: 'top', horizontal: 'left', offsetY: 26, offsetX: 10 },
      domTarget: '',
      domRoot: 'stuff',
      nextButtonLabel: 'Next'
    },
    {
      target: '#smartspaces.stuff.2',
      headline: 'Chatting with a Space',
      content: "Let's create a smart space together.",
      position: { vertical: 'top', horizontal: 'left', offsetY: 450, offsetX: 10 },
      domTarget: 'create-space',
      action: 'create-space',
      domRoot: 'stuff',
      nextButtonLabel: 'Next'
    },
    {
      target: '#smartspaces.stuff.3',
      headline: 'Creating a live space',
      content:
        'You can add a description to auto-fetch from your existing stuff. New saves will appear automatically.',
      position: { vertical: 'bottom', horizontal: 'center', offsetY: 350, offsetX: 0 },
      domTarget: 'smart-space-description',
      action: 'create-space',
      domRoot: 'stuff',
      nextButtonLabel: 'Start'
    }
  ]
}
