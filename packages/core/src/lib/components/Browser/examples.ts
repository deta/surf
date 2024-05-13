export const EXAMPLE_TABS = [
  'https://www.gls-pakete.de/sendungsverfolgung?trackingNumber=40606676384',
  'https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation/#H1021620028346001067',
  'https://www.google.com/search?q=normale+bettdecke+ma%C3%9Fe&oq=normale+bettd&sourceid=chrome&ie=UTF-8',
  'https://www2.hm.com/de_de/productpage.0458563022.html',
  'https://www.ikea.com/de/de/cat/bettlaken-spannbettlaken-10681/?filters=f-typed-reference-measurement:180x200%20cm_sheets&sort=PRICE_LOW_TO_HIGH',
  'https://www.obelink.de/salora-wmr5350-mini-waschmaschine-8719325154528.html',
  'https://www.libble.de/salora-wmr5350/download/862151/',
  'https://www.youtube.com/watch?v=I_wc3DfgQvs'
]

export const EXAMPLE_CHAT = [
  {
    id: '1',
    title: 'Chat 1',
    createdAt: '2021-01-01T00:00:00.000Z',
    updatedAt: '2021-01-01T00:00:00.000Z',
    messageIds: ['1', '2', '3', '4']
  }
]

export const EXAMPLE_CHAT_MESSAGE = [
  {
    id: '1',
    createdAt: '2021-01-01T00:00:00.000Z',
    updatedAt: '2021-01-01T00:00:00.000Z',
    role: 'assistant',
    content:
      'Here are the items you marked earlier to continue reading. Here are the items you marked earlier to continue reading. Here are the items you marked earlier to continue reading. Here are the items you marked earlier to continue reading. Here are the items you marked earlier to continue reading. Here are the items you marked earlier to continue reading. ',
    resourceIDs: ['test']
  },
  {
    id: '2',
    createdAt: '2021-01-01T00:00:00.000Z',
    updatedAt: '2021-01-01T00:00:00.000Z',
    role: 'assistant',
    content: 'Resource',
    resourceIDs: []
  },
  {
    id: '3',
    createdAt: '2021-01-01T00:00:00.000Z',
    updatedAt: '2021-01-01T00:00:00.000Z',
    role: 'user',
    content:
      'What was Christopher Alexanders real-life approach to his concept of timeless building?',
    resourceIDs: []
  },
  {
    id: '4',
    createdAt: '2021-01-01T00:00:00.000Z',
    updatedAt: '2021-01-01T00:00:00.000Z',
    role: 'assistant',
    content:
      'His approach was not based on rigid formulas or trends, but on an intuitive understanding of the fundamental principles that make a space feel alive and meaningful. You once watched a video about him.',
    resourceIDs: []
  }
]

// Create

// export a function that is collectiing all of the chat data based on the chat id
export function getChatData(chatId: string) {
  const chat = EXAMPLE_CHAT.find((chat) => chat.id === chatId)
  if (!chat) return null // Or a sensible default

  const messages = chat.messageIds
    .map((messageId) => EXAMPLE_CHAT_MESSAGE.find((message) => message.id === messageId))
    .filter((message): message is ChatMessage => !!message) // This removes any undefined messages

  return { chat, messages }
}
