export const DEFAULT_SEARCH_ENGINE = 'google'
export const SEARCH_ENGINES = [
  {
    key: 'google',
    title: 'Search with Google',
    shortcuts: ['gg', 'google'],
    getUrl: (query: string) => `https://google.com/search?q=${query}`
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
    key: 'startpage',
    title: 'Search with Startpage',
    shortcuts: ['startpage'],
    getUrl: (query: string) => `https://www.startpage.com/sp/search?query=${query}`
  },
  {
    key: 'phind',
    title: 'Search with Phind',
    shortcuts: ['phind'],
    getUrl: (query: string) => `https://www.phind.com/search?q=${query}&ignoreSearchResults=false`
  },
  {
    key: 'wolframalpha',
    title: 'Search WolframAlpha',
    shortcuts: ['wolframalpha'],
    getUrl: (query: string) => `https://www.wolframalpha.com/input?i=${query}`
  },
  {
    key: 'lycos',
    title: 'Search Lycos',
    shortcuts: ['lycos'],
    getUrl: (query: string) => `https://search.lycos.com/web/?q=${query}`
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
  }
]
