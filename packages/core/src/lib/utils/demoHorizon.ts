import type { Horizon } from '../service/horizon'
import imageDND from '../../../public/assets/demo/dnd-full-hq.gif'
import imageOverview from '../../../public/assets/demo/overview-demo-full.gif'

export const initDemoHorizon = async (horizon: Horizon) => {
  console.log('CREATING DEMO CARDS')
  horizon.addCard({
    ...{ x: 50, y: 50, width: 400, height: 300 },
    type: 'text',
    data: {
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Welcome to your new horizon! 🚀' }]
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: "Welcome aboard! We're thrilled to have you as one of the first to experience our new spatial browser. This project is close to our hearts, and your early insights are going to be a big part of its success. "
              }
            ]
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: "Dive in, explore freely, and let us know what you think. Your feedback is not just valued – it's essential. Happy browsing!"
              }
            ]
          },
          { type: 'paragraph' }
        ]
      }
    }
  })

  // Use environment variable for the cheatsheet URL
  const cheatsheetUrl = import.meta.env.R_VITE_CHEATSHEET_URL
  if (typeof cheatsheetUrl === 'string' && cheatsheetUrl.length > 0) {
    horizon.addCardBrowser(cheatsheetUrl, {
      x: 550,
      y: 50,
      width: 600,
      height: 800
    })
  } else {
    console.error('R_VITE_CHEATSHEET_URL is not defined or invalid.')
  }
}
