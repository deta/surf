import { getFormattedDate } from '@deta/utils/data'

/**
 * Turns the query into a usable note title
 */
export const formatAIQueryToTitle = (query: string, maxLength = 45) => {
  const formatted =
    query.trim().length > 0 ? query.trim() : `Untitled ${getFormattedDate(Date.now())}`
  return formatted.length > maxLength ? formatted.slice(0, maxLength) + '...' : formatted
}
