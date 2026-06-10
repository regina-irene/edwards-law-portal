// lib/themes.ts — portal background themes clients can pick on the Settings
// page: 10 base looks, holiday backgrounds, and sports themes including every
// NFL and MLB team in team colors. `dark` themes flip the page text to light.

export interface PortalTheme {
  key: string
  label: string
  bg: string
  ink: string
  dark: boolean
}

export const BASE_THEMES: PortalTheme[] = [
  { key: "classic", label: "Classic Cream", bg: "#FBF8F3", ink: "#262220", dark: false },
  { key: "ocean", label: "Ocean Blue", bg: "linear-gradient(170deg, #eaf7fa 0%, #c8e8f0 35%, #9fd3e3 70%, #76b9d3 100%)", ink: "#0c2d3f", dark: false },
  { key: "sunrise", label: "Sunrise", bg: "linear-gradient(170deg, #fff7ed 0%, #ffedd5 50%, #fed7aa 100%)", ink: "#431407", dark: false },
  { key: "lavender", label: "Lavender", bg: "linear-gradient(170deg, #faf5ff 0%, #ede9fe 50%, #ddd6fe 100%)", ink: "#2e1065", dark: false },
  { key: "sage", label: "Sage Garden", bg: "linear-gradient(170deg, #f0fdf4 0%, #dcfce7 55%, #bbf7d0 100%)", ink: "#052e16", dark: false },
  { key: "blush", label: "Blush", bg: "linear-gradient(170deg, #fff1f2 0%, #ffe4e6 55%, #fecdd3 100%)", ink: "#4c0519", dark: false },
  { key: "sky", label: "Clear Sky", bg: "linear-gradient(170deg, #eff6ff 0%, #dbeafe 55%, #bfdbfe 100%)", ink: "#172554", dark: false },
  { key: "midnight", label: "Midnight Navy", bg: "linear-gradient(170deg, #0f1b2d 0%, #16263d 60%, #1d3050 100%)", ink: "#e8eef7", dark: true },
  { key: "charcoal", label: "Charcoal", bg: "#1d1f23", ink: "#ececec", dark: true },
  { key: "royal", label: "Royal Purple", bg: "linear-gradient(170deg, #1e1b4b 0%, #312e81 55%, #4c1d95 100%)", ink: "#ece9fe", dark: true },
]

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Team wallpaper: the team logo (ESPN's public logo images) tiled across the
// background, washed with the team color at 50% so it reads as a watermark.
// Most team primaries are dark, so team themes use light text.
function teamTheme(league: "nfl" | "mlb", name: string, abbr: string, c1: string, c2: string): PortalTheme {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const logo = `https://a.espncdn.com/i/teamlogos/${league}/500/${abbr}.png`
  return {
    key: `${league}-${slug}`,
    label: name,
    bg: `linear-gradient(${hexToRgba(c1, 0.5)}, ${hexToRgba(c1, 0.5)}), url("${logo}") center / 240px repeat, linear-gradient(170deg, ${c1} 0%, ${c2} 160%)`,
    ink: "#f5f7fa",
    dark: true,
  }
}

export const NFL_THEMES: PortalTheme[] = [
  teamTheme("nfl", "Arizona Cardinals", "ari", "#97233F", "#000000"),
  teamTheme("nfl", "Atlanta Falcons", "atl", "#A71930", "#000000"),
  teamTheme("nfl", "Baltimore Ravens", "bal", "#241773", "#9E7C0C"),
  teamTheme("nfl", "Buffalo Bills", "buf", "#00338D", "#C60C30"),
  teamTheme("nfl", "Carolina Panthers", "car", "#0085CA", "#101820"),
  teamTheme("nfl", "Chicago Bears", "chi", "#0B162A", "#C83803"),
  teamTheme("nfl", "Cincinnati Bengals", "cin", "#FB4F14", "#000000"),
  teamTheme("nfl", "Cleveland Browns", "cle", "#311D00", "#FF3C00"),
  teamTheme("nfl", "Dallas Cowboys", "dal", "#003594", "#869397"),
  teamTheme("nfl", "Denver Broncos", "den", "#FB4F14", "#002244"),
  teamTheme("nfl", "Detroit Lions", "det", "#0076B6", "#B0B7BC"),
  teamTheme("nfl", "Green Bay Packers", "gb", "#203731", "#FFB612"),
  teamTheme("nfl", "Houston Texans", "hou", "#03202F", "#A71930"),
  teamTheme("nfl", "Indianapolis Colts", "ind", "#002C5F", "#A2AAAD"),
  teamTheme("nfl", "Jacksonville Jaguars", "jax", "#006778", "#D7A22A"),
  teamTheme("nfl", "Kansas City Chiefs", "kc", "#E31837", "#FFB81C"),
  teamTheme("nfl", "Las Vegas Raiders", "lv", "#000000", "#A5ACAF"),
  teamTheme("nfl", "Los Angeles Chargers", "lac", "#0080C6", "#FFC20E"),
  teamTheme("nfl", "Los Angeles Rams", "lar", "#003594", "#FFA300"),
  teamTheme("nfl", "Miami Dolphins", "mia", "#008E97", "#FC4C02"),
  teamTheme("nfl", "Minnesota Vikings", "min", "#4F2683", "#FFC62F"),
  teamTheme("nfl", "New England Patriots", "ne", "#002244", "#C60C30"),
  teamTheme("nfl", "New Orleans Saints", "no", "#101820", "#D3BC8D"),
  teamTheme("nfl", "New York Giants", "nyg", "#0B2265", "#A71930"),
  teamTheme("nfl", "New York Jets", "nyj", "#125740", "#101820"),
  teamTheme("nfl", "Philadelphia Eagles", "phi", "#004C54", "#A5ACAF"),
  teamTheme("nfl", "Pittsburgh Steelers", "pit", "#101820", "#FFB612"),
  teamTheme("nfl", "San Francisco 49ers", "sf", "#AA0000", "#B3995D"),
  teamTheme("nfl", "Seattle Seahawks", "sea", "#002244", "#69BE28"),
  teamTheme("nfl", "Tampa Bay Buccaneers", "tb", "#D50A0A", "#34302B"),
  teamTheme("nfl", "Tennessee Titans", "ten", "#0C2340", "#4B92DB"),
  teamTheme("nfl", "Washington Commanders", "wsh", "#5A1414", "#FFB612"),
]

export const MLB_THEMES: PortalTheme[] = [
  teamTheme("mlb", "Arizona Diamondbacks", "ari", "#A71930", "#E3D4AD"),
  teamTheme("mlb", "Atlanta Braves", "atl", "#13274F", "#CE1141"),
  teamTheme("mlb", "Baltimore Orioles", "bal", "#DF4601", "#000000"),
  teamTheme("mlb", "Boston Red Sox", "bos", "#BD3039", "#0C2340"),
  teamTheme("mlb", "Chicago Cubs", "chc", "#0E3386", "#CC3433"),
  teamTheme("mlb", "Chicago White Sox", "chw", "#27251F", "#C4CED4"),
  teamTheme("mlb", "Cincinnati Reds", "cin", "#C6011F", "#000000"),
  teamTheme("mlb", "Cleveland Guardians", "cle", "#0C2340", "#E31937"),
  teamTheme("mlb", "Colorado Rockies", "col", "#333366", "#C4CED4"),
  teamTheme("mlb", "Detroit Tigers", "det", "#0C2340", "#FA4616"),
  teamTheme("mlb", "Houston Astros", "hou", "#002D62", "#EB6E1F"),
  teamTheme("mlb", "Kansas City Royals", "kc", "#004687", "#BD9B60"),
  teamTheme("mlb", "Los Angeles Angels", "laa", "#BA0021", "#003263"),
  teamTheme("mlb", "Los Angeles Dodgers", "lad", "#005A9C", "#A5ACAF"),
  teamTheme("mlb", "Miami Marlins", "mia", "#00A3E0", "#EF3340"),
  teamTheme("mlb", "Milwaukee Brewers", "mil", "#12284B", "#FFC52F"),
  teamTheme("mlb", "Minnesota Twins", "min", "#002B5C", "#D31145"),
  teamTheme("mlb", "New York Mets", "nym", "#002D72", "#FF5910"),
  teamTheme("mlb", "New York Yankees", "nyy", "#0C2340", "#C4CED3"),
  teamTheme("mlb", "Oakland Athletics", "oak", "#003831", "#EFB21E"),
  teamTheme("mlb", "Philadelphia Phillies", "phi", "#E81828", "#002D72"),
  teamTheme("mlb", "Pittsburgh Pirates", "pit", "#27251F", "#FDB827"),
  teamTheme("mlb", "San Diego Padres", "sd", "#2F241D", "#FFC425"),
  teamTheme("mlb", "San Francisco Giants", "sf", "#FD5A1E", "#27251F"),
  teamTheme("mlb", "Seattle Mariners", "sea", "#0C2C56", "#005C5C"),
  teamTheme("mlb", "St. Louis Cardinals", "stl", "#C41E3A", "#0C2340"),
  teamTheme("mlb", "Tampa Bay Rays", "tb", "#092C5C", "#8FBCE6"),
  teamTheme("mlb", "Texas Rangers", "tex", "#003278", "#C0111F"),
  teamTheme("mlb", "Toronto Blue Jays", "tor", "#134A8E", "#1D2D5C"),
  teamTheme("mlb", "Washington Nationals", "wsh", "#AB0003", "#14225A"),
]

export const THEMES: PortalTheme[] = [
  ...BASE_THEMES,
  ...NFL_THEMES,
  ...MLB_THEMES,
]

export function getTheme(key: string | null | undefined): PortalTheme {
  return THEMES.find((t) => t.key === key) ?? THEMES[0]
}
