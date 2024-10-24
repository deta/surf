// config.ts

export type Role =
  | 'Student'
  | 'Software Engineer'
  | 'Designer'
  | 'Entrepreneur'
  | 'Marketing'
  | 'Artist'
  | 'Researcher'
  | 'Product Manager'
  | 'Writer'
  | 'Other'

type Explainer = {
  eyebrow: string
  headline: string
  description: string[]
  caption?: string
}

type ContentRole = 'Student' | 'Designer' | 'Other'

type ContentStructure = {
  [key in ContentRole]: {
    stuff: Explainer
    chat: Explainer
    vision: Explainer
  }
}

const STUDENT_STUFF_EYEBROW = 'EVERYTHING IN ONE PLACE'
const STUDENT_STUFF_HEADLINE = '"Self-organizing Bookmarks"'
const STUDENT_STUFF_DESCRIPTION = [
  "But it's not just bookmarks. Save super-powered screenshots, PDFs, YouTube videos, and more.",
  'Find them in an instant and watch them organize themselves.'
]
const STUDENT_CHAT_EYEBROW = 'WHATS IN SURF'
const STUDENT_CHAT_HEADLINE = 'Super-charged chat.'
const STUDENT_CHAT_DESCRIPTION = [
  "Surf's AI chat can power through dozens of tabs, hours of podcasts, and thousands of pages, in seconds."
]
const STUDENT_CHAT_CAPTION = 'Tip: Chat works flawlessly with Youtube Videos and PDFs as well.'
const STUDENT_VISION_EYEBROW = 'INLINE VISION'
const STUDENT_VISION_HEADLINE = 'Your new browser now has eyes.'
const STUDENT_VISION_DESCRIPTION = [
  'Confused by a difficult concept within a paper you are reading?',
  'Use Vision to get instant clarity and explanations without breaking your flow.'
]
const STUDENT_VISION_CAPTION =
  'Tip: You can also add any number of vision elements to your current chat context.'

const DESIGNER_STUFF_EYEBROW = 'EVERYTHING IN ONE PLACE'
const DESIGNER_STUFF_HEADLINE = '"Self-organizing Bookmarks"'
const DESIGNER_STUFF_DESCRIPTION = [
  "But it's not just bookmarks. Save super-powered screenshots, PDFs, YouTube videos, and more.",
  'Find them in an instant and watch them organize themselves.'
]
const DESIGNER_CHAT_EYEBROW = 'CHAT WITH EVERYTHING'
const DESIGNER_CHAT_HEADLINE = 'Turn Notes into Action'
const DESIGNER_CHAT_DESCRIPTION = [
  "Surf's AI chat can power through dozens of tabs, hours of podcasts, and thousands of pages, in seconds."
]
const DESIGNER_CHAT_CAPTION = 'Tip: Chat works flawlessly with Youtube Videos and PDFs as well.'
const DESIGNER_VISION_EYEBROW = 'INLINE VISION'
const DESIGNER_VISION_HEADLINE = 'Your new browser now has eyes.'
const DESIGNER_VISION_DESCRIPTION = [
  "Capture any part of your design, and immediately see what needs improvement— contrast, clutter, whatever's in the way of a perfect experience.",
  "It's like a design buddy within your browser and works perfectly when using Figma within Surf."
]
const DESIGNER_VISION_CAPTION =
  'Tip: You can also add any number of vision elements to your current chat context.'

const OTHER_STUFF_EYEBROW = 'EVERYTHING IN ONE PLACE'
const OTHER_STUFF_HEADLINE = '"Self-organizing Bookmarks"'
const OTHER_STUFF_DESCRIPTION = [
  "But it's not just bookmarks. Save super-powered screenshots, PDFs, YouTube videos, and more.",
  'Find them in an instant and watch them organize themselves.'
]
const OTHER_CHAT_EYEBROW = 'WHATS IN SURF'
const OTHER_CHAT_HEADLINE = 'Chat with everything. Your Tabs, your Spaces, your Stuff.'
const OTHER_CHAT_DESCRIPTION = [
  "Surf's AI chat can power through dozens of tabs, hours of podcasts, and thousands of pages, in seconds."
]
const OTHER_CHAT_CAPTION = 'Tip: Chat works flawlessly with Youtube Videos and PDFs as well.'
const OTHER_VISION_EYEBROW = 'INLINE VISION'
const OTHER_VISION_HEADLINE = 'Your new browser now has eyes.'
const OTHER_VISION_DESCRIPTION = [
  'Our Inline Vision feature is like having a buddy that browses with you. You can select everything you see and ask questions about anything.',
  'This feature is really only bound by your imagination.'
]
const OTHER_VISION_CAPTION =
  'Tip: You can also add any number of vision elements to your current chat context.'

const contentStructure: ContentStructure = {
  Student: {
    stuff: {
      eyebrow: STUDENT_STUFF_EYEBROW,
      headline: STUDENT_STUFF_HEADLINE,
      description: STUDENT_STUFF_DESCRIPTION
    },
    chat: {
      eyebrow: STUDENT_CHAT_EYEBROW,
      headline: STUDENT_CHAT_HEADLINE,
      description: STUDENT_CHAT_DESCRIPTION,
      caption: STUDENT_CHAT_CAPTION
    },
    vision: {
      eyebrow: STUDENT_VISION_EYEBROW,
      headline: STUDENT_VISION_HEADLINE,
      description: STUDENT_VISION_DESCRIPTION,
      caption: STUDENT_VISION_CAPTION
    }
  },
  Designer: {
    stuff: {
      eyebrow: DESIGNER_STUFF_EYEBROW,
      headline: DESIGNER_STUFF_HEADLINE,
      description: DESIGNER_STUFF_DESCRIPTION
    },
    chat: {
      eyebrow: DESIGNER_CHAT_EYEBROW,
      headline: DESIGNER_CHAT_HEADLINE,
      description: DESIGNER_CHAT_DESCRIPTION,
      caption: DESIGNER_CHAT_CAPTION
    },
    vision: {
      eyebrow: DESIGNER_VISION_EYEBROW,
      headline: DESIGNER_VISION_HEADLINE,
      description: DESIGNER_VISION_DESCRIPTION,
      caption: DESIGNER_VISION_CAPTION
    }
  },
  Other: {
    stuff: {
      eyebrow: OTHER_STUFF_EYEBROW,
      headline: OTHER_STUFF_HEADLINE,
      description: OTHER_STUFF_DESCRIPTION
    },
    chat: {
      eyebrow: OTHER_CHAT_EYEBROW,
      headline: OTHER_CHAT_HEADLINE,
      description: OTHER_CHAT_DESCRIPTION,
      caption: OTHER_CHAT_CAPTION
    },
    vision: {
      eyebrow: OTHER_VISION_EYEBROW,
      headline: OTHER_VISION_HEADLINE,
      description: OTHER_VISION_DESCRIPTION,
      caption: OTHER_VISION_CAPTION
    }
  }
}

export default contentStructure
