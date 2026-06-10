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

export const HOLIDAY_THEMES: PortalTheme[] = [
  { key: "thanksgiving", label: "Thanksgiving 🦃", bg: "linear-gradient(170deg, #fff7ed 0%, #fed7aa 40%, #ea8c3c 80%, #9a3412 130%)", ink: "#431407", dark: false },
  { key: "halloween", label: "Halloween 🎃", bg: "linear-gradient(170deg, #18122b 0%, #3b0764 55%, #c2410c 130%)", ink: "#fde8d7", dark: true },
  { key: "july4", label: "4th of July 🎆", bg: "linear-gradient(170deg, #dbe7ff 0%, #f8fafc 45%, #ffd5dc 75%, #b91c1c 140%)", ink: "#0f172a", dark: false },
  { key: "valentine", label: "Valentine's Day 💝", bg: "linear-gradient(170deg, #fff1f2 0%, #fda4af 60%, #e11d48 130%)", ink: "#4c0519", dark: false },
  { key: "winter-holiday", label: "Winter Holidays 🎄", bg: "linear-gradient(170deg, #0f3d2e 0%, #14532d 55%, #7f1d1d 120%)", ink: "#ecfdf5", dark: true },
]

export const SPORT_THEMES: PortalTheme[] = [
  { key: "football", label: "Football 🏈", bg: "linear-gradient(170deg, #1a2e05 0%, #365314 45%, #4d7c0f 100%)", ink: "#f3f8e8", dark: true },
  { key: "soccer", label: "Soccer ⚽", bg: "linear-gradient(170deg, #052e16 0%, #14532d 50%, #16a34a 110%)", ink: "#effdf4", dark: true },
]

// Team colors → gradient. Most team primaries are dark, so team themes use
// light text. Names/colors only — no logos.
function teamTheme(prefix: "nfl" | "mlb", name: string, c1: string, c2: string): PortalTheme {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  return {
    key: `${prefix}-${slug}`,
    label: name,
    bg: `linear-gradient(170deg, ${c1} 0%, ${c1} 50%, ${c2} 135%)`,
    ink: "#f5f7fa",
    dark: true,
  }
}

export const NFL_THEMES: PortalTheme[] = [
  teamTheme("nfl", "Arizona Cardinals", "#97233F", "#000000"),
  teamTheme("nfl", "Atlanta Falcons", "#A71930", "#000000"),
  teamTheme("nfl", "Baltimore Ravens", "#241773", "#9E7C0C"),
  teamTheme("nfl", "Buffalo Bills", "#00338D", "#C60C30"),
  teamTheme("nfl", "Carolina Panthers", "#0085CA", "#101820"),
  teamTheme("nfl", "Chicago Bears", "#0B162A", "#C83803"),
  teamTheme("nfl", "Cincinnati Bengals", "#FB4F14", "#000000"),
  teamTheme("nfl", "Cleveland Browns", "#311D00", "#FF3C00"),
  teamTheme("nfl", "Dallas Cowboys", "#003594", "#869397"),
  teamTheme("nfl", "Denver Broncos", "#FB4F14", "#002244"),
  teamTheme("nfl", "Detroit Lions", "#0076B6", "#B0B7BC"),
  teamTheme("nfl", "Green Bay Packers", "#203731", "#FFB612"),
  teamTheme("nfl", "Houston Texans", "#03202F", "#A71930"),
  teamTheme("nfl", "Indianapolis Colts", "#002C5F", "#A2AAAD"),
  teamTheme("nfl", "Jacksonville Jaguars", "#006778", "#D7A22A"),
  teamTheme("nfl", "Kansas City Chiefs", "#E31837", "#FFB81C"),
  teamTheme("nfl", "Las Vegas Raiders", "#000000", "#A5ACAF"),
  teamTheme("nfl", "Los Angeles Chargers", "#0080C6", "#FFC20E"),
  teamTheme("nfl", "Los Angeles Rams", "#003594", "#FFA300"),
  teamTheme("nfl", "Miami Dolphins", "#008E97", "#FC4C02"),
  teamTheme("nfl", "Minnesota Vikings", "#4F2683", "#FFC62F"),
  teamTheme("nfl", "New England Patriots", "#002244", "#C60C30"),
  teamTheme("nfl", "New Orleans Saints", "#101820", "#D3BC8D"),
  teamTheme("nfl", "New York Giants", "#0B2265", "#A71930"),
  teamTheme("nfl", "New York Jets", "#125740", "#101820"),
  teamTheme("nfl", "Philadelphia Eagles", "#004C54", "#A5ACAF"),
  teamTheme("nfl", "Pittsburgh Steelers", "#101820", "#FFB612"),
  teamTheme("nfl", "San Francisco 49ers", "#AA0000", "#B3995D"),
  teamTheme("nfl", "Seattle Seahawks", "#002244", "#69BE28"),
  teamTheme("nfl", "Tampa Bay Buccaneers", "#D50A0A", "#34302B"),
  teamTheme("nfl", "Tennessee Titans", "#0C2340", "#4B92DB"),
  teamTheme("nfl", "Washington Commanders", "#5A1414", "#FFB612"),
]

export const MLB_THEMES: PortalTheme[] = [
  teamTheme("mlb", "Arizona Diamondbacks", "#A71930", "#E3D4AD"),
  teamTheme("mlb", "Atlanta Braves", "#13274F", "#CE1141"),
  teamTheme("mlb", "Baltimore Orioles", "#DF4601", "#000000"),
  teamTheme("mlb", "Boston Red Sox", "#BD3039", "#0C2340"),
  teamTheme("mlb", "Chicago Cubs", "#0E3386", "#CC3433"),
  teamTheme("mlb", "Chicago White Sox", "#27251F", "#C4CED4"),
  teamTheme("mlb", "Cincinnati Reds", "#C6011F", "#000000"),
  teamTheme("mlb", "Cleveland Guardians", "#0C2340", "#E31937"),
  teamTheme("mlb", "Colorado Rockies", "#333366", "#C4CED4"),
  teamTheme("mlb", "Detroit Tigers", "#0C2340", "#FA4616"),
  teamTheme("mlb", "Houston Astros", "#002D62", "#EB6E1F"),
  teamTheme("mlb", "Kansas City Royals", "#004687", "#BD9B60"),
  teamTheme("mlb", "Los Angeles Angels", "#BA0021", "#003263"),
  teamTheme("mlb", "Los Angeles Dodgers", "#005A9C", "#A5ACAF"),
  teamTheme("mlb", "Miami Marlins", "#00A3E0", "#EF3340"),
  teamTheme("mlb", "Milwaukee Brewers", "#12284B", "#FFC52F"),
  teamTheme("mlb", "Minnesota Twins", "#002B5C", "#D31145"),
  teamTheme("mlb", "New York Mets", "#002D72", "#FF5910"),
  teamTheme("mlb", "New York Yankees", "#0C2340", "#C4CED3"),
  teamTheme("mlb", "Oakland Athletics", "#003831", "#EFB21E"),
  teamTheme("mlb", "Philadelphia Phillies", "#E81828", "#002D72"),
  teamTheme("mlb", "Pittsburgh Pirates", "#27251F", "#FDB827"),
  teamTheme("mlb", "San Diego Padres", "#2F241D", "#FFC425"),
  teamTheme("mlb", "San Francisco Giants", "#FD5A1E", "#27251F"),
  teamTheme("mlb", "Seattle Mariners", "#0C2C56", "#005C5C"),
  teamTheme("mlb", "St. Louis Cardinals", "#C41E3A", "#0C2340"),
  teamTheme("mlb", "Tampa Bay Rays", "#092C5C", "#8FBCE6"),
  teamTheme("mlb", "Texas Rangers", "#003278", "#C0111F"),
  teamTheme("mlb", "Toronto Blue Jays", "#134A8E", "#1D2D5C"),
  teamTheme("mlb", "Washington Nationals", "#AB0003", "#14225A"),
]

export const THEMES: PortalTheme[] = [
  ...BASE_THEMES,
  ...HOLIDAY_THEMES,
  ...SPORT_THEMES,
  ...NFL_THEMES,
  ...MLB_THEMES,
]

export function getTheme(key: string | null | undefined): PortalTheme {
  return THEMES.find((t) => t.key === key) ?? THEMES[0]
}
