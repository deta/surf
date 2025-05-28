import { isMac } from '@horizon/utils'
import Onboarding from '../Core/Onboarding.svelte'

export enum OnboardingAction {
  SendChatMessage = 'send-chat-message',
  CreateSpace = 'create-space',
  OpenStuff = 'open-stuff',
  CloseStuff = 'close-stuff',
  OpenPDF = 'open-pdf',
  OpenURL = 'open-url',
  InsertQuestion = 'insert-question',
  StartAICompletion = 'start-ai-completion',
  CreateSurflet = 'create-surflet',
  ReturnToWelcomePage = 'return-to-welcome-page',
  ToggleTabBar = 'toggle-tab-bar',
  ToggleRightSidebar = 'toggle-right-sidebar',
  FinishNotesOnboarding = 'finish-notes-onboarding',
  OpenNoteInSidebar = 'open-note-in-sidebar',
  OpenNoteAsTab = 'open-note-as-tab',
  OpenTab = 'open-tab',
  OpenYouTubeVideo = 'open-youtube-video',
  OpenOnboardingTab = 'open-onboarding-tab',
  TriggerVision = 'trigger-vision',
  SubmitVisionPrompt = 'submit-vision-prompt',
  AddTextToNote = 'add-text-to-note',
  AskOnboardingSpace = 'ask-onboarding-space',
  InsertUseAsDefaultBrowserIntoNote = 'insert-use-as-default-browser-into-note',
  InsertOnboardingFooterIntoNote = 'insert-onboarding-footer-into-note',
  HideVision = 'hide-vision',
  ReloadWelcomePage = 'reload-welcome-page',
  TrackOnboardingTab = 'track-onboarding-tab'
}

/**
 * Enum for completion event IDs used in onboarding steps
 */
export enum CompletionEventID {
  VisionSelected = 'vision-selected',
  VisionSend = 'vision-send',
  OpenVisionNoteInSidebar = 'open-vision-note-in-sidebar',
  OpenStuff = 'onboarding-open-stuff',
  UseVision = 'use-vision',
  OpenNoteAsTab = 'open-note-as-tab',
  CaretClicked = 'caret-clicked',
  AIGenerationDone = 'ai-generation-done',
  ArticleAddedToContext = 'article-added-to-context',
  AIGenerationStarted = 'ai-generation-started'
}

// Interface for action with parameters
export interface OnboardingActionWithParams {
  action: OnboardingAction
  params?: Record<string, any>
}

// Type that can be either a simple action or an action with parameters
export type OnboardingActionType = OnboardingAction | OnboardingActionWithParams

/** Configuration for completion event that must be triggered to advance to the next step */
export interface CompletionEventConfig {
  /** Event ID that will automatically advance to the next step when dispatched */
  eventId: CompletionEventID | string
  /** Message to display while waiting for the event to be triggered */
  message: string
  /** If true, the completion event is optional and won't block advancing to the next step */
  optional?: boolean
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
  /** Optional DOM element with data-tooltip-anchor attribute for positioning */
  domAnchor?: string
  /** If true, only shows the tooltip header and a loading spinner */
  minimized?: boolean
  /** If true, hides the tooltip visually but keeps all handlers and events working */
  invisible?: boolean
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
  /** Optional array of DOM selectors with data-tooltip-safearea attributes to avoid collisions */
  safeArea?: string[]
  /** Alternative positioning to use when tooltip collides with safe area elements */
  alternativePosition?: {
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
  /** Optional actions to trigger on step */
  actions?: OnboardingActionType[]
  /** Optional actions to trigger when the step is first displayed */
  initialActions?: OnboardingActionType[]
  /** ID of associated media content */
  mediaID?: string
  /** Type of media content (image/video) */
  mediaType?: 'image' | 'video'
  /** Optional z-index override */
  zIndex?: number
  /** Optional completion event configuration that must be triggered to advance to the next step */
  completionEvent?: CompletionEventConfig | string
  /** If true, automatically proceed to the next step when AI generation completes */
  proceedAfterAIGeneration?: boolean
  /** If true, the next button will be enabled even when a completion event is defined */
  actionCanSkipCompletionEvent?: boolean
}

export interface OnboardingTimeline {
  name: string
  steps: TooltipStep[]
  initialActions?: OnboardingActionType[]
  dismissable?: boolean
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
  DesktopOnboarding = 'desktopOnboarding',
  SmartNotesOnboarding = 'smartNotesOnboarding',
  NotesOnboarding = 'notesOnboarding',
  AppOnboarding = 'appOnboarding'
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
        "In Surf, you can chat with all of the items you save. This includes contexts, tabs, and bookmarks. Let's start by chatting with a context.",
      position: { vertical: 'top', horizontal: 'left', offsetY: 26, offsetX: 10 },
      domTarget: 'demo-space',
      domRoot: 'stuff',
      nextButtonLabel: 'Start'
    },
    {
      target: '#chat.onboarding.stuff.2',
      headline: 'Add a Context into Chat',
      content:
        'We created a demo context for you. Add it into the chat by dragging it into the input bar. Alternatively, you could also do a right-click and select "Chat with Context".',
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
        'This is your context bar. It currently contains a context, but you can also chat with any number of tabs if you want.',
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
      actions: [{ action: OnboardingAction.SendChatMessage }],
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
      content: "Let's create a smart context together. Click the + button to create a new context.",
      position: { vertical: 'top', horizontal: 'left', offsetY: 120, offsetX: 10 },
      domTarget: 'create-space',
      actions: [{ action: OnboardingAction.CreateSpace }],
      domRoot: 'stuff',
      nextButtonLabel: 'Next'
    },
    {
      target: '#smartspaces.stuff.3',
      headline: 'Creating a live context',
      content:
        'You can add a description to auto-fetch from your existing stuff. New saves will appear automatically.',
      position: { vertical: 'bottom', horizontal: 'center', offsetY: 350, offsetX: 0 },
      domTarget: 'smart-space-description',
      actions: [{ action: OnboardingAction.CreateSpace }],
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
        "Hey there! <br/><br/>Here's your customizable desktop context. Drop in websites you visit daily, add quick notes, or populate it with images that inspire you - it's all yours to design. <br/><br/>Think of it as your personal corner of the web where everything that matters is just a click away. And yes, you can even switch up the background to match your style.",
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
      actions: [{ action: OnboardingAction.OpenStuff }],
      mediaType: 'video'
    }
  ]
}

export const smartNotesTimeline: OnboardingTimeline = {
  name: OnboardingFeature.SmartNotesOnboarding,
  steps: [
    {
      target: '#notes.onboarding.1',
      headline: 'Generated Output',
      content: "This is the output from Surf AI. It's generated from the input that was provided.",
      position: { vertical: 'top', horizontal: 'left', offsetY: 300, offsetX: 200 },
      domTarget: 'onboarding-output-basics',
      domRoot: 'body',
      nextButtonLabel: "Alright, let's go!"
    }
  ]
}

export const notesOnboardingTimeline: OnboardingTimeline = {
  name: OnboardingFeature.NotesOnboarding,
  steps: [
    {
      target: '#notes.onboarding.1',
      headline: 'Say hello to your new cursor.',
      content: `Say hello to your new cursor. Click the caret — or hit ${isMac() ? '⌘' : 'CTRL'} + ⏎ — to start writing in the sidebar. It follows you as you type, ready to help, suggest, and respond.`,
      domTarget: 'sidebar-right',
      domAnchor: 'sidebar-right',
      domRoot: 'body',
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: -440,
        offsetY: 100
      },
      nextButtonLabel: 'Continue',
      prevButtonLabel: 'Back',
      mediaID: 'caret',
      mediaType: 'image',
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.2',
      headline: 'Need to bring something in?',
      content:
        'Type @ to mention tabs, saved stuff, or your whole Surf to use them as the context you are chatting with.',
      domTarget: 'sidebar-right',
      domAnchor: 'sidebar-right',
      domRoot: 'body',
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: -440,
        offsetY: 100
      },
      nextButtonLabel: 'Continue',
      prevButtonLabel: 'Back',
      action: undefined,
      mediaID: 'at.menu',
      mediaType: 'video',
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.3',
      headline: 'Quick actions',
      content: 'Type / to see what you can do — from inserting elements to asking a question.',
      domTarget: 'sidebar-right',
      domAnchor: 'sidebar-right',
      domRoot: 'body',
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: -440,
        offsetY: 100
      },
      nextButtonLabel: 'Continue',
      prevButtonLabel: 'Back',
      action: undefined,
      mediaID: 'slash.menu',
      mediaType: 'video',
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.4',
      headline: 'Suggestions',
      content: "Don't know where to start? Hit space to see suggestions.",
      domTarget: 'sidebar-right',
      domAnchor: 'sidebar-right',
      domRoot: 'body',
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: -440,
        offsetY: 100
      },
      nextButtonLabel: 'Continue',
      prevButtonLabel: 'Back',
      action: undefined,
      mediaID: 'suggestions',
      mediaType: 'video',
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.5',
      headline: 'Chat with YouTube Videos',
      content:
        "Now let's try chatting with a YouTube video. Surf can analyze video content and answer questions about it.",
      domTarget: 'sidebar-right',
      domAnchor: 'sidebar-right',
      domRoot: 'body',
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: -440,
        offsetY: 100
      },
      nextButtonLabel: 'Open the Video',
      prevButtonLabel: 'Back',
      actions: [OnboardingAction.OpenYouTubeVideo],
      mediaID: 'youtube.chat',
      mediaType: 'image',
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.6',
      headline: 'Video Analysis',
      content:
        'Great! The video is now loaded and Surf is analyzing the content. You can see how Surf processes the video and provides valuable insights.',
      domTarget: 'chat-input',
      domRoot: 'body',
      domAnchor: 'sidebar-right',
      position: {
        vertical: 'bottom',
        horizontal: 'left',
        offsetX: -440,
        offsetY: -440
      },
      nextButtonLabel: 'Continue',
      prevButtonLabel: 'Back',
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.7',
      headline: 'View Citations',
      content:
        'Surf provides citations for its answers. Click on any citation to jump directly to that part of the video.',
      domTarget: 'chat-citation',
      domRoot: 'body',
      position: {
        vertical: 'bottom',
        horizontal: 'left',
        offsetX: -440,
        offsetY: -440
      },
      nextButtonLabel: 'Next',
      prevButtonLabel: 'Back',
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.10',
      headline: 'Create a Surflet',
      content:
        "Surflets are AI-generated mini-apps that can help you accomplish specific tasks or visualize information. Let's create one now to see how they work. Note: Surflets work best with the latest Claude Sonnet AI models.",
      domTarget: 'chat-input',
      domRoot: 'body',
      domAnchor: 'sidebar-right',
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: -440,
        offsetY: 100
      },
      nextButtonLabel: 'Create Surflet',
      prevButtonLabel: 'Back',
      actions: [OnboardingAction.CreateSurflet],
      mediaID: 'create.surflet',
      mediaType: 'image',
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.11',
      headline: 'Generating Surflet',
      content:
        'Your Surflet is being generated right now! Surf is analyzing your content and creating a custom mini-app to help you understand it better. This may take a moment.',
      domTarget: 'chat-input',
      domRoot: 'body',
      domAnchor: 'sidebar-right',
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: -440,
        offsetY: 100
      },
      nextButtonLabel: 'Continue',
      prevButtonLabel: 'Back',
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.11',
      headline: 'Congratulations!',
      content:
        "You've completed the onboarding tour and learned about Surf's key features. Continue exploring and discovering what Surf can do for you!",
      domTarget: 'chat-input',
      domRoot: 'body',
      domAnchor: 'sidebar-right',
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: -440,
        offsetY: 100
      },
      actions: [OnboardingAction.ReturnToWelcomePage],
      nextButtonLabel: 'Return to Onboarding',
      prevButtonLabel: 'Back',
      zIndex: 1000
    }
  ]
}

export const appOnboardingTimeline: OnboardingTimeline = {
  name: OnboardingFeature.AppOnboarding,
  dismissable: false,
  initialActions: [
    { action: OnboardingAction.ToggleTabBar, params: { visible: false } },
    { action: OnboardingAction.ToggleRightSidebar, params: { visible: false } },
    { action: OnboardingAction.OpenOnboardingTab, params: { section: 'vision' } },
    { action: OnboardingAction.TrackOnboardingTab }
  ],
  steps: [
    {
      target: '#notes.onboarding.0',
      headline: 'Welcome to Surf',
      content: `Surf does a few things differently, compared to your previous browser.</br></br> <b>It has vision</b> — and you can ask it questions about anything that you can see.`,
      domTarget: 'sidebar-right',
      domRoot: 'body',
      actions: [{ action: OnboardingAction.TriggerVision }],
      invisible: true,
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: 20,
        offsetY: 20
      },
      completionEvent: {
        eventId: CompletionEventID.UseVision,
        message: 'Use the button or the shortcut to start start vision.',
        optional: true
      },
      nextButtonLabel: 'Use Vision',
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.1',
      headline: 'Select everything that you see',
      content: '',
      domTarget: 'screen-picker',
      domRoot: 'body',
      position: {
        vertical: 'top',
        horizontal: 'center',
        offsetX: 20,
        offsetY: 20
      },
      nextButtonLabel: 'Continue',
      invisible: true,
      zIndex: 2147483647,
      completionEvent: {
        eventId: CompletionEventID.VisionSelected,
        message: '→ Select something.'
      }
    },
    {
      target: '#notes.onboarding.2000',
      headline: 'Ask anything',
      content: '',
      domTarget: '',
      domRoot: 'body',
      invisible: true,
      position: {
        vertical: 'top',
        horizontal: 'center',
        offsetX: 20,
        offsetY: 20
      },
      completionEvent: {
        eventId: CompletionEventID.VisionSend,
        message: '→ Input the example text into the chat input and hit send.'
      },

      nextButtonLabel: 'Continue',
      actions: undefined,
      zIndex: 2147483647
    },
    {
      target: '#notes.onboarding.2001',
      headline: 'Generating answer',
      content: '',
      minimized: true,
      domTarget: '',
      domRoot: 'body',
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: 20,
        offsetY: 20
      },
      proceedAfterAIGeneration: true,
      nextButtonLabel: 'Continue',
      zIndex: 2147483647
    },
    {
      target: '#app.onboarding.open-in-sidebar',
      headline: 'Open in Sidebar',
      content: '',
      domTarget: 'open-in-sidebar-button',
      domRoot: 'body',
      position: {
        vertical: 'top',
        horizontal: 'right',
        offsetX: 20,
        offsetY: 20
      },
      safeArea: ['message-box'],
      alternativePosition: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: 20,
        offsetY: 20
      },
      nextButtonLabel: 'Jump to Next Step',
      completionEvent: {
        eventId: CompletionEventID.OpenVisionNoteInSidebar,
        message: 'Open the note in the sidebar'
      },
      actions: [{ action: OnboardingAction.OpenNoteInSidebar }],
      actionCanSkipCompletionEvent: true,
      zIndex: 2147483647
    },
    {
      target: '#notes.onboarding.4',
      headline: 'Welcome to the Sidebar',
      content: 'Your answer is now a note—ready to edit in the Sidebar.',
      domTarget: '',
      domAnchor: 'sidebar-right',
      domRoot: 'body',
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: -440,
        offsetY: 650
      },
      initialActions: [{ action: OnboardingAction.HideVision }],
      mediaID: 'note-sidebar',
      mediaType: 'image',
      nextButtonLabel: 'Continue',
      actions: undefined,
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.5',
      headline: 'Chat with all your Tabs',
      content:
        'Let’s try chatting with a Tab. Surf can break down and answer questions on any content—even YouTube videos.',
      domTarget: '',
      domAnchor: 'sidebar-right',
      domRoot: 'body',
      initialActions: [
        {
          action: OnboardingAction.HideVision
        }
      ],
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: -440,
        offsetY: 650
      },
      nextButtonLabel: 'Open a Surf Article',
      actions: [
        {
          action: OnboardingAction.OpenURL,
          params: {
            url: 'https://productidentity.co/p/surf-the-browser',
            question: 'What is the role of AI in Surf?'
          }
        }
      ],
      mediaID: 'article.chat',
      mediaType: 'image',
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.6',
      headline: 'Article Analysis',
      content: 'Surf is preparing the article for the chat, this usually just takes a few seconds.',
      domTarget: '',
      domRoot: 'body',
      domAnchor: 'sidebar-right',
      position: {
        vertical: 'bottom',
        horizontal: 'left',
        offsetX: -440,
        offsetY: -440
      },
      initialActions: [
        {
          action: OnboardingAction.TrackOnboardingTab
        }
      ],
      completionEvent: {
        eventId: CompletionEventID.ArticleAddedToContext,
        message: ''
      },
      actionCanSkipCompletionEvent: true,
      nextButtonLabel: 'Continue',
      zIndex: 1000
    },
    {
      target: '#app.onboarding.sendmessage',
      headline: 'Send Message',
      content: 'Hit ↵ or click the submit button to send your question',
      domTarget: '',
      domAnchor: 'sidebar-right',
      domRoot: 'body',
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: -440,
        offsetY: 650
      },
      completionEvent: {
        eventId: CompletionEventID.AIGenerationStarted,
        message: ''
      },
      mediaID: 'note-chat-submit',
      mediaType: 'video',
      actionCanSkipCompletionEvent: false,
      nextButtonLabel: 'Next',
      zIndex: 1000
    },
    {
      target: '#app.onboarding.generateanswer',
      headline: 'Generating Answer',
      content:
        'Surf is now using the article as context to answer your question. Watch the response come in...',
      domTarget: '',
      domAnchor: 'sidebar-right',
      domRoot: 'body',
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: -440,
        offsetY: 650
      },
      actionCanSkipCompletionEvent: false,
      proceedAfterAIGeneration: true,
      nextButtonLabel: 'Next',
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.7',
      headline: 'View Citations',
      content:
        'Nice! As you can see every answer comes with citations. Click any citation to jump to that spot in the article.',
      domTarget: 'chat-citation',
      domAnchor: 'sidebar-right',
      domRoot: 'body',
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: -440,
        offsetY: 650
      },
      mediaID: 'citations',
      mediaType: 'image',
      nextButtonLabel: 'Next',
      zIndex: 1000
    },
    // {
    //   target: '#notes.onboarding.10',
    //   headline: 'Create a Surflet',
    //   content:
    //     "Surflets are AI-generated mini-apps that can help you accomplish specific tasks or visualize information. Let's create one now to see how they work. Note: Surflets work best with the latest Claude Sonnet AI models.",
    //   domTarget: 'chat-input',
    //   domRoot: 'body',
    //   domAnchor: 'sidebar-right',
    //   position: {
    //     vertical: 'top',
    //     horizontal: 'left',
    //     offsetX: -440,
    //     offsetY: 100
    //   },
    //   nextButtonLabel: 'Create Surflet',
    //   prevButtonLabel: 'Back',
    //   actions: [{ action: OnboardingAction.CreateSurflet }],
    //   mediaID: 'create.surflet',
    //   mediaType: 'image',
    //   zIndex: 1000
    // },
    // {
    //   target: '#notes.onboarding.11',
    //   headline: 'Generating Surflet',
    //   content:
    //     'Your Surflet is being generated right now! Surf is analyzing your content and creating a custom mini-app to help you understand it better. This may take a moment.',
    //   domTarget: 'chat-input',
    //   domRoot: 'body',
    //   domAnchor: 'sidebar-right',
    //   position: {
    //     vertical: 'top',
    //     horizontal: 'left',
    //     offsetX: -440,
    //     offsetY: 100
    //   },
    //   nextButtonLabel: 'Continue',
    //   prevButtonLabel: 'Back',
    //   zIndex: 1000
    // },
    {
      target: '#app.onboarding.open-note-as-tab',
      headline: 'Open as Tab',
      content: '',
      domTarget: 'open-note-as-tab',
      domAnchor: 'sidebar-right',
      domRoot: 'body',
      position: {
        vertical: 'top',
        horizontal: 'left',
        offsetX: -440,
        offsetY: 650
      },
      actions: [{ action: OnboardingAction.OpenNoteAsTab }],
      completionEvent: {
        eventId: CompletionEventID.OpenNoteAsTab,
        message: '↗ Click “Open as Tab” (inside the dot menu) to launch your note as a tab.'
      },
      actionCanSkipCompletionEvent: true,
      nextButtonLabel: 'Open the Note as a Tab',
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.11',
      headline: 'How does it work?',
      content:
        'You can type @ to mention tabs, saved stuff, or your entire Surf to use them as the context you are chatting with. We prepared a question about a context that we created earlier for you. Just continue.',
      domTarget: 'chat-input',
      domRoot: 'body',
      position: {
        vertical: 'top',
        horizontal: 'right',
        offsetX: 20,
        offsetY: 20
      },
      initialActions: [{ action: OnboardingAction.TrackOnboardingTab }],
      mediaType: 'video',
      mediaID: 'at.menu',
      actions: [
        {
          action: OnboardingAction.AskOnboardingSpace,
          params: {
            mention: 'Surf Onboarding',
            query:
              'what is Stuff in Surf and how can Surf notes help me create something out of everything I consume?'
          }
        }
      ],
      nextButtonLabel: 'Insert Ask Context Prompt',
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.11',
      headline: 'Get Insights From Your Context',
      content: '',
      domTarget: 'chat-input',
      domRoot: 'body',
      position: {
        vertical: 'top',
        horizontal: 'right',
        offsetX: 20,
        offsetY: 20
      },
      nextButtonLabel: 'Continue',
      completionEvent: {
        eventId: CompletionEventID.AIGenerationDone,
        message: 'Hit ↵ or click the submit button next to the inserted question ask Surf AI.'
      },
      actions: [
        {
          action: OnboardingAction.InsertUseAsDefaultBrowserIntoNote
        },
        {
          action: OnboardingAction.AddTextToNote
        },
        {
          action: OnboardingAction.InsertOnboardingFooterIntoNote,
          params: {
            links: [
              {
                url: 'https://deta.notion.site/surf-alpha',
                title: 'Cheat Sheet'
              },
              {
                url: 'https://deta.notion.site/changelogs',
                title: 'Changelog'
              },
              {
                url: 'https://deta.notion.site/keyboard-shortcuts',
                title: 'Learn Keyboard Shortcuts'
              },
              {
                url: 'https://deta.surf',
                title: 'Surf'
              }
            ]
          }
        }
      ],
      proceedAfterAIGeneration: true,
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.11',
      headline: 'Congratulations!',
      content:
        'You’ve finished the tour. We opened a Surf Playground tab for you to explore what else you can do with Surf.',
      domTarget: 'chat-input',
      domRoot: 'body',
      position: {
        vertical: 'bottom',
        horizontal: 'right',
        offsetX: 100,
        offsetY: 100
      },
      actions: [
        {
          action: OnboardingAction.ToggleTabBar,
          params: {
            visible: true
          }
        },
        {
          action: OnboardingAction.ReloadWelcomePage
        }
      ],
      nextButtonLabel: 'Start Browsing',
      zIndex: 1000
    },
    {
      target: '#notes.onboarding.11',
      headline: 'Congratulations!',
      content:
        'You’ve finished the tour. We opened a Surf Playground tab for you to explore what else you can do with Surf.',
      domTarget: 'chat-input',
      domRoot: 'body',
      position: {
        vertical: 'bottom',
        horizontal: 'right',
        offsetX: 100,
        offsetY: 100
      },
      actions: [
        {
          action: OnboardingAction.ToggleTabBar,
          params: {
            visible: true
          }
        },
        {
          action: OnboardingAction.ReloadWelcomePage
        }
      ],
      nextButtonLabel: 'Start Browsing',
      zIndex: 1000
    }
  ]
}
