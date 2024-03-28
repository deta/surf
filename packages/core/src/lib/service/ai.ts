import log from '../utils/log'

export const summarizeText = async (text: string) => {
  // @ts-expect-error
  const summary = await window.api.createAIChatCompletion(
    text,
    'You are a summarizer, summarize the text given to you. Only respond with the summarization.'
  )

  log.debug('Summarized text', summary)

  return summary
}
