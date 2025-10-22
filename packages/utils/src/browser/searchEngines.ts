export const DEFAULT_SEARCH_ENGINE = 'google'
export const SEARCH_ENGINES: {
  key: string
  title: string
  shortcuts: string[]
  getUrl: (query: string) => string
  getCompletions?: (query: string) => Promise<string[]>
}[] = [
  {
    key: 'google',
    title: 'Search with Google',
    shortcuts: ['gg', 'google'],
    getUrl: (query: string) => `https://www.google.com/search?q=${query}`,
    getCompletions: async (query: string) => {
      // @ts-ignore
      const data = await window.api.fetchJSON(
        `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(
          query
        )}`,
        {
          // HACK: this is needed to get Google to properly encode the suggestions, without this Umlaute are not encoded properly
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
          }
        }
      )
      return data[1]
    }
  },
  {
    key: 'perplexity',
    title: 'Use Perplexity',
    shortcuts: ['ppx', 'perplexity'],
    getUrl: (query: string) => `https://www.perplexity.ai/?q=${query}`
  },
  {
    key: 'bing',
    title: 'Search with Bing',
    shortcuts: ['bing'],
    getUrl: (query: string) => `https://www.bing.com/search?q=${query}`
  },
  {
    key: 'copilot',
    title: 'Use Bing Copilot',
    shortcuts: ['bing', 'copilot'],
    getUrl: (query: string) =>
      `https://www.bing.com/search?q=${query}&qs=SYC&showconv=1&sendquery=1&FORM=ASCHT2&sp=2&lq=0`
  },
  {
    key: 'duckduckgo',
    title: 'Search with Duckduckgo',
    shortcuts: ['ddgo', 'duckduckgo'],
    getUrl: (query: string) => `https://duckduckgo.com/?q=${query}`
  },
  {
    key: 'ecosia',
    title: 'Search with Ecosia',
    shortcuts: ['ecosia'],
    getUrl: (query: string) => `https://www.ecosia.org/search?method=index&q=${query}`
  },
  {
    key: 'brave',
    title: 'Search with Brave',
    shortcuts: ['brave'],
    getUrl: (query: string) => `https://search.brave.com/search?source=web&q=${query}`
  },
  /*{
        key: 'startpage',
        title: 'Search with Startpage',
        shortcuts: ['startpage'],
        getUrl: (query: string) => `https://www.startpage.com/sp/search?query=${query}`
      },*/
  {
    key: 'wolframalpha',
    title: 'Search WolframAlpha',
    shortcuts: ['wolframalpha'],
    getUrl: (query: string) => `https://www.wolframalpha.com/input?i=${query}`
  },
  {
    key: 'twitter',
    title: 'Search X (Twitter)',
    shortcuts: ['tw', 'x.com', 'twitter'],
    getUrl: (query: string) => `https://twitter.com/search?q=${query}&src=typed_query`
  },
  {
    key: 'reddit',
    title: 'Search Reddit',
    shortcuts: ['reddit'],
    getUrl: (query: string) => `https://www.reddit.com/search/?q=${query}`
  },
  {
    key: 'unsplash',
    title: 'Search Unsplash',
    shortcuts: ['unsplash'],
    getUrl: (query: string) => `https://unsplash.com/s/photos/${query}`
  },
  {
    key: 'pinterest',
    title: 'Search Pinterest',
    shortcuts: ['pinterest'],
    getUrl: (query: string) => `https://www.pinterest.com/search/pins/?q=${query}&rs=typed`
  },
  {
    key: 'youtube',
    title: 'Search YouTube',
    shortcuts: ['yt', 'youtube'],
    getUrl: (query: string) => `https://www.youtube.com/results?search_query=${query}`
  },
  {
    key: 'gmail',
    title: 'Search Gmail',
    shortcuts: ['gmail', 'googlemail', 'mail'],
    getUrl: (query: string) => `https://mail.google.com/mail/u/0/#search/${query}`
  },
  {
    key: 'kagi',
    title: 'Search with Kagi',
    shortcuts: ['kagi'],
    getUrl: (query: string) => `https://kagi.com/search?q=${query}`
  }
]
