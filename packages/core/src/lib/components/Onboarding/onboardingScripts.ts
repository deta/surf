import { isMac } from '@horizon/utils'

export enum OnboardingAction {
  SendChatMessage = 'send-chat-message',
  CreateSpace = 'create-space',
  OpenStuff = 'open-stuff'
}

export interface TooltipStep {
  /** Unique identifier for targeting the tooltip */
  target: string
  /** Title/header text of the tooltip */
  headline: string
  /** Main descriptive text content of the tooltip */
  content: string
  /** DOM element to attach the tooltip to */
  domTarget: string
  /** Root DOM element for positioning context */
  domRoot: string
  /** Positioning configuration for the tooltip */
  position: {
    /** Vertical alignment (top/bottom/center) */
    vertical: 'top' | 'bottom' | 'center'
    /** Horizontal alignment (left/right/center) */
    horizontal: 'left' | 'right' | 'center'
    /** Optional X-axis offset in pixels */
    offsetX?: number
    /** Optional Y-axis offset in pixels */
    offsetY?: number
  }
  /** Text for the next step button */
  nextButtonLabel?: string
  /** Text for the previous step button */
  prevButtonLabel?: string
  /** Optional action to trigger on step */
  action?: OnboardingAction
  /** ID of associated media content */
  mediaID?: string
  /** Type of media content (image/video) */
  mediaType?: 'image' | 'video'
  /** Optional z-index override */
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
  ChatWithTabsOnboarding = 'chatWithTabsOnboarding',
  ChatWithPDFOnboarding = 'chatWithPDFOnboarding',
  ChatWithYoutubeVideoOnboarding = 'chatWithYoutubeVideoOnboarding',
  StuffOnboarding = 'stuffOnboarding',
  SmartSpacesOnboarding = 'smartSpacesOnboarding',
  DesktopOnboarding = 'desktopOnboarding'
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
      headline: 'Chatting with a Context',
      content:
        "In Surf, you can chat with all of the items you save. This includes contexts, tabs, and bookmarks. Let's start by chatting with a space.",
      position: { vertical: 'top', horizontal: 'left', offsetY: 26, offsetX: 10 },
      domTarget: 'demo-space',
      domRoot: 'stuff',
      nextButtonLabel: 'Start'
    },
    {
      target: '#chat.onboarding.stuff.2',
      headline: 'Add a Context into Context',
      content:
        'We created a demo space for you. Add the space into context by dragging it into the context bar. Alternatively, you could also do a right-click and select "Chat with Context".',
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
      content: 'You are now chatting with a context.',
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
      action: OnboardingAction.SendChatMessage,
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
      headline: 'Contexts',
      content:
        'You can have multiple contexts. You can also open a context as a tab and rename it (right click → rename).',
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
      content: 'This is your digital inbox for all the stuff you save.',
      position: { vertical: 'top', horizontal: 'left', offsetY: 58, offsetX: 10 },
      domRoot: 'stuff',
      domTarget: 'stuff-spaces-inbox',
      prevButtonLabel: 'Previous',
      nextButtonLabel: 'Next'
    },
    {
      target: '#stuff.onboarding.3',
      headline: 'Managing Stuff',
      content: 'Move items between contexts by simply right-clicking or dragging them.',
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
        "You know, stuff on your computer can get messy sometimes. That's why we created Smart Contexts. They help you to organize your stuff better.",
      position: { vertical: 'top', horizontal: 'left', offsetY: 26, offsetX: 10 },
      domTarget: '',
      domRoot: 'stuff',
      nextButtonLabel: 'Next'
    },
    {
      target: '#smartspaces.stuff.2',
      headline: 'Chatting with a Context',
      content: "Let's create a smart space together. Click the + button to create a new space.",
      position: { vertical: 'top', horizontal: 'left', offsetY: 120, offsetX: 10 },
      domTarget: 'create-space',
      action: OnboardingAction.CreateSpace,
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
      action: OnboardingAction.CreateSpace,
      domRoot: 'stuff',
      nextButtonLabel: 'Start'
    }
  ]
}

export const desktopTimeline: OnboardingTimeline = {
  name: OnboardingFeature.DesktopOnboarding,
  steps: [
    {
      target: '#desktop.onboarding.1',
      headline: 'Your New Desktop',
      content:
        "Hey there! <br/><br/>Here's your customizable desktop space. Drop in websites you visit daily, add quick notes, or populate it with images that inspire you - it's all yours to design. <br/><br/>Think of it as your personal corner of the web where everything that matters is just a click away. And yes, you can even switch up the background to match your style.",
      position: { vertical: 'bottom', horizontal: 'left', offsetY: 120, offsetX: 10 },
      domTarget: 'desktop-demo',
      domRoot: 'body',
      nextButtonLabel: "Alright, let's go!",
      mediaID: 'desktop.onboarding.start',
      mediaType: 'video'
    },
    {
      target: '#desktop.onboarding.2',
      headline: 'Drop resources onto your Desktop',
      content:
        'Drop saved items onto desktop from your stuff. <br/> Or directly drag browser tabs to desktop to save them.',
      position: { vertical: 'bottom', horizontal: 'right', offsetY: 120, offsetX: 10 },
      domTarget: 'open-stuff-desktop',
      domRoot: 'body',
      nextButtonLabel: 'Open my Stuff!',
      mediaID: 'desktop.onboarding.howtodrop',
      action: OnboardingAction.OpenStuff,
      mediaType: 'video'
    }
  ]
}
