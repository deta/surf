import type { Horizon } from '../service/horizon'
import imageDND from '../../../public/assets/demo/dnd-full-hq.gif'
import imageOverview from '../../../public/assets/demo/overview-demo-full.gif'
import type { CardPosition } from '../types'

export const createCheatSheetCard = (horizon: Horizon, position: CardPosition) => {
  // Use environment variable for the cheatsheet URL
  const cheatsheetUrl = import.meta.env.R_VITE_CHEATSHEET_URL
  if (typeof cheatsheetUrl === 'string' && cheatsheetUrl.length > 0) {
    horizon.addCardBrowser(cheatsheetUrl, position, { trigger: 'system' })
  } else {
    console.error('R_VITE_CHEATSHEET_URL is not defined or invalid.')
  }
}

const onboardingNote = `<h3>Welcome to your new horizon! 🚀</h3>
<p>Welcome aboard! We're thrilled to have you as one of the first to experience our new spatial browser. This project is close to our hearts, and your early insights are going to be a big part of its success.</p>
<p>Dive in, explore freely, and let us know what you think. Your feedback is not just valued – it's essential. Happy browsing!</p>
<p></p>`

export const initDemoHorizon = async (horizon: Horizon) => {
  console.log('CREATING DEMO CARDS')
  horizon.addCardText(
    onboardingNote,
    { x: 50, y: 50, width: 400, height: 300 },
    undefined,
    undefined,
    { trigger: 'system' }
  )

  createCheatSheetCard(horizon, {
    x: 550,
    y: 50,
    width: 600,
    height: 800
  })
}
