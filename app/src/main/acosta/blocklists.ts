import type { FilterCategory } from '@deta/types'

/**
 * Remote blocklist sources per category. The StevenBlack hosts project curates
 * the large category lists; they are fetched on startup and cached on disk.
 */
export const REMOTE_BLOCKLIST_SOURCES: Partial<Record<FilterCategory, string>> = {
  adult: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn-only/hosts',
  gambling:
    'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/gambling-only/hosts',
  social: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/social-only/hosts'
}

/**
 * Embedded seed lists. These guarantee baseline protection on first launch
 * (before remote lists download) and cover categories StevenBlack does not
 * curate. The AI URL screening covers the long tail.
 */
export const SEED_BLOCKLISTS: Record<FilterCategory, string[]> = {
  adult: [
    'pornhub.com',
    'xvideos.com',
    'xnxx.com',
    'xhamster.com',
    'redtube.com',
    'youporn.com',
    'onlyfans.com',
    'chaturbate.com',
    'stripchat.com',
    'rule34.xxx',
    'e621.net',
    'f95zone.to',
    'spankbang.com',
    'eporner.com',
    'motherless.com'
  ],
  gambling: [
    'sportsbet.com.au',
    'tab.com.au',
    'ladbrokes.com.au',
    'neds.com.au',
    'pointsbet.com.au',
    'bet365.com',
    'betfair.com.au',
    'unibet.com.au',
    'bluebet.com.au',
    'dabble.com.au',
    'pokerstars.com',
    'stake.com',
    'roobet.com',
    'draftkings.com',
    'fanduel.com',
    '888casino.com',
    'crownmelbourne.com.au',
    'thelott.com',
    'ozlotteries.com'
  ],
  drugs: [
    'leafly.com',
    'weedmaps.com',
    'erowid.org',
    'shroomery.org',
    'grasscity.com',
    'rollitup.org',
    'drugs-forum.com',
    'bluelight.org',
    'psychonautwiki.org',
    'dankstop.com',
    'smokecartel.com',
    'vapingdaily.com',
    'vaporfi.com',
    'elementvape.com'
  ],
  violence: [
    'bestgore.fun',
    'theync.com',
    'kaotic.com',
    'crazyshit.com',
    'documentingreality.com',
    'goregrish.com',
    'watchpeopledie.tv',
    'hoodsite.com',
    'seegore.com',
    'deadhouse.org'
  ],
  social: [
    'facebook.com',
    'instagram.com',
    'tiktok.com',
    'snapchat.com',
    'twitter.com',
    'x.com',
    'reddit.com',
    'discord.com',
    'pinterest.com',
    'tumblr.com',
    'threads.net',
    'bereal.com',
    'twitch.tv',
    'kick.com',
    'omegle.com',
    'monkey.app'
  ],
  gaming: [
    'roblox.com',
    'minecraft.net',
    'steampowered.com',
    'epicgames.com',
    'fortnite.com',
    'leagueoflegends.com',
    'riotgames.com',
    'ea.com',
    'playstation.com',
    'xbox.com',
    'nintendo.com',
    'miniclip.com',
    'coolmathgames.com',
    'friv.com',
    'poki.com',
    'crazygames.com',
    'itch.io',
    'kongregate.com',
    'newgrounds.com',
    'agar.io',
    'slither.io',
    'krunker.io',
    'shellshock.io',
    '1v1.lol'
  ]
}

/** Hosts that must never be blocked regardless of list contents. */
export const NEVER_BLOCK_HOSTS = new Set([
  'acosta.ai',
  'api.acosta.ai',
  'platform.acosta-ai.com',
  'updates.acosta-ai.com',
  'heyacosta.com',
  'duckduckgo.com',
  'google.com',
  'www.google.com',
  'bing.com',
  'www.bing.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'accounts.google.com'
])

/**
 * Parse a hosts-file formatted blocklist (lines like `0.0.0.0 example.com`)
 * into a set of hostnames.
 */
export function parseHostsFile(contents: string): Set<string> {
  const hosts = new Set<string>()
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const parts = line.split(/\s+/)
    // hosts files map to 0.0.0.0 / 127.0.0.1; also accept bare domain lists
    const host = parts.length > 1 ? parts[1] : parts[0]
    if (!host || host === 'localhost' || host === 'localhost.localdomain' || host === 'local') {
      continue
    }
    if (host.includes('.')) hosts.add(host.toLowerCase())
  }
  return hosts
}
