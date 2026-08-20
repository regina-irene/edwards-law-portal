// lib/airtable-colors.ts - Airtable's select-option colors, carried into the
// portal so chips look the same as on Regina's Status board. Airtable's REST
// API returns only the option NAME, so the name→color mapping is baked in here
// (pulled from the base schema 2026-06-09). Unknown values fall back to gray.

const HEX: Record<string, { bg: string; text: string }> = {
  blueLight2: { bg: "#CFDFFF", text: "#102046" },
  blueLight1: { bg: "#9CC7FF", text: "#102046" },
  blueBright: { bg: "#2D7FF9", text: "#FFFFFF" },
  blueDark1: { bg: "#2750AE", text: "#FFFFFF" },
  cyanLight2: { bg: "#D0F0FD", text: "#04283F" },
  cyanLight1: { bg: "#77D1F3", text: "#04283F" },
  cyanBright: { bg: "#18BFFF", text: "#FFFFFF" },
  cyanDark1: { bg: "#0B76B7", text: "#FFFFFF" },
  tealLight2: { bg: "#C2F5E9", text: "#012524" },
  tealLight1: { bg: "#72DDC3", text: "#012524" },
  tealBright: { bg: "#20D9D2", text: "#012524" },
  tealDark1: { bg: "#06A09B", text: "#FFFFFF" },
  greenLight2: { bg: "#D1F7C4", text: "#0B1D05" },
  greenLight1: { bg: "#93E088", text: "#0B1D05" },
  greenBright: { bg: "#20C933", text: "#FFFFFF" },
  greenDark1: { bg: "#338A17", text: "#FFFFFF" },
  yellowLight2: { bg: "#FFEAB6", text: "#3B2501" },
  yellowLight1: { bg: "#FFD66E", text: "#3B2501" },
  yellowBright: { bg: "#FCB400", text: "#3B2501" },
  yellowDark1: { bg: "#B87503", text: "#FFFFFF" },
  orangeLight2: { bg: "#FEE2D5", text: "#6B2613" },
  orangeLight1: { bg: "#FFA981", text: "#6B2613" },
  orangeBright: { bg: "#FF6F2C", text: "#FFFFFF" },
  orangeDark1: { bg: "#D74D26", text: "#FFFFFF" },
  redLight2: { bg: "#FFDCE5", text: "#4C0C1C" },
  redLight1: { bg: "#FF9EB7", text: "#4C0C1C" },
  redBright: { bg: "#F82B60", text: "#FFFFFF" },
  redDark1: { bg: "#BA1E45", text: "#FFFFFF" },
  pinkLight2: { bg: "#FFDAF6", text: "#400832" },
  pinkLight1: { bg: "#F99DE2", text: "#400832" },
  pinkBright: { bg: "#FF08C2", text: "#FFFFFF" },
  pinkDark1: { bg: "#B2158B", text: "#FFFFFF" },
  purpleLight2: { bg: "#EDE2FE", text: "#280B42" },
  purpleLight1: { bg: "#CDB0FF", text: "#280B42" },
  purpleBright: { bg: "#8B46FF", text: "#FFFFFF" },
  purpleDark1: { bg: "#6B1CB0", text: "#FFFFFF" },
  grayLight2: { bg: "#EEEEEE", text: "#333333" },
  grayLight1: { bg: "#CCCCCC", text: "#333333" },
  grayBright: { bg: "#666666", text: "#FFFFFF" },
  grayDark1: { bg: "#444444", text: "#FFFFFF" },
}

// Option name → Airtable color name, per field. From the Status board schema.
const CASE_STAGE: Record<string, string> = {
  "0 - Pre  Litigation": "blueLight2",
  "1 - Uncontested": "cyanLight2",
  "2 - Filed / Awaiting Service": "orangeLight2",
  "3 - Served / wtg answer": "yellowLight2",
  "4 - GAL Investigation": "pinkLight2",
  "4 - Post Answer Dis.": "tealLight2",
  "4 - Special Master Investigation": "purpleLight2",
  "5 - Ready for Mediation": "greenLight2",
  "6 - Mediation Scheduled": "blueLight1",
  "6 - Settlement Negotiations": "blueLight1",
  "7 - Awtg Final Trial": "redLight2",
  "7 - Final Trial sched.": "pinkLight2",
  "8 - Awtg Final Docs from Ct": "redBright",
  "Cmpletd": "grayLight2",
  "Completed": "tealBright",
  "On Hold": "cyanLight1",
  "WDing from Case": "yellowLight1",
  "N/A": "redDark1",
  "Unfiled": "blueBright",
}

const CASE_TYPE: Record<string, string> = {
  "Contempt": "greenLight2",
  "Div w. Children": "redBright",
  "Divorce w/o Children": "cyanBright",
  "Legitimation": "orangeLight2",
  "Mod of Alimony": "pinkLight2",
  "Mod of Custody/ CS": "yellowLight2",
  "Modification of Custody / CS": "grayLight2",
  "Name Change": "cyanLight1",
  "Of Counsel": "orangeLight1",
  "Paternity / CS": "blueLight1",
  "Prenuptial Agreement": "yellowLight1",
  "Special Master": "cyanLight2",
  "TPO": "greenLight1",
  "UC Divorce": "blueLight2",
  "GAL": "purpleLight1",
  "Separate Maintenance w. children": "tealBright",
  "RIE Personal": "purpleDark1",
  "Postnuptial Agreement": "redLight1",
}

const COUNTY: Record<string, string> = {
  "*Clayton": "purpleBright",
  "*Cobb": "yellowLight2",
  "*Dekalb": "redBright",
  "*Fulton": "cyanBright",
  "*Gwinnett": "greenBright",
  "Athens-Clarke": "redLight1",
  "Bartow": "cyanBright",
  "Chatham": "orangeLight2",
  "Cherokee": "cyanDark1",
  "Clarke": "orangeLight1",
  "Clay": "purpleLight1",
  "Coweta": "grayLight1",
  "Douglas": "blueLight2",
  "Fannin": "grayLight2",
  "Fayette": "purpleLight2",
  "Forsyth": "orangeLight1",
  "Hall": "tealLight1",
  "Henry": "pinkLight2",
  "Newton": "greenLight2",
  "Oconee": "cyanLight1",
  "Paulding": "purpleLight2",
  "Rockdale": "greenLight1",
  "Spalding": "grayLight2",
  "Walton": "cyanLight1",
  "Bibb": "yellowDark1",
  "*Spalding": "blueLight1",
  "Crawford": "greenDark1",
  "*Douglas": "yellowLight1",
  "*Jackson": "orangeBright",
  "Barrow": "redDark1",
}

const PLF_DFT: Record<string, string> = {
  "Plaintiff": "yellowLight2",
  "Defendant": "cyanLight1",
  "Special Master": "blueLight2",
  "GAL": "cyanLight2",
  "Plf + Dft": "purpleLight1",
  "N/A": "tealLight1",
}

const PAYMENT_STATUS: Record<string, string> = {
  "Current": "greenLight1",
  "Owes $": "orangeBright",
  "Pro Bono": "orangeLight1",
}

// Judges: instead of baking in ~80 names, color by county prefix the way the
// board does (e.g. all "(Gw) ..." judges are greenLight2, "Cobb - ..." yellowLight2).
const JUDGE_PREFIX: [string, string][] = [
  ["(Ful", "blueLight2"],
  ["(Gw)", "greenLight2"],
  ["Cobb", "yellowLight2"],
  ["Dekalb", "redBright"],
  ["Clayton", "purpleBright"],
  ["Walton", "tealDark1"],
  ["Henry", "purpleLight1"],
  ["Forsyth", "orangeLight1"],
  ["Douglas", "pinkLight2"],
  ["Gwinnett", "greenLight2"],
]

export interface ChipColor {
  bg: string
  text: string
}

const GRAY: ChipColor = HEX.grayLight2

function fromName(colorName: string | undefined): ChipColor {
  return (colorName && HEX[colorName]) || GRAY
}

export function stageColor(name: string): ChipColor {
  return fromName(CASE_STAGE[name])
}

export function caseTypeColor(name: string): ChipColor {
  return fromName(CASE_TYPE[name])
}

export function countyColor(name: string): ChipColor {
  return fromName(COUNTY[name])
}

export function plfDftColor(name: string): ChipColor {
  return fromName(PLF_DFT[name])
}

export function paymentStatusColor(name: string): ChipColor {
  return fromName(PAYMENT_STATUS[name])
}

/**
 * "Filed by:" on the per-client Pleadings tables.
 *
 * A guess by keyword, used where the base's real schema colours aren't to hand.
 * Choice names vary between bases, and several pair the party with the spouse:
 * "Plaintiff / Husband", "Defendant / Wife".
 *
 * ORDER MATTERS, and getting it wrong was a real bug (2026-08-20). The party
 * word is tested BEFORE the spouse word. Phillander's board has
 * "Defendant / Wife" in cyan, but the old version tested "wife" first and
 * painted it yellow, because it assumed plaintiff went with wife and defendant
 * with husband. That holds in some cases and not in others, so the spouse words
 * are now only a fallback for a choice that names no party at all.
 *
 * Where the base's own schema can be read, use the colour it actually defines
 * instead of this: see chipFromColorName and lib/doc-board.
 */
export function filedByColor(name: string): ChipColor {
  const n = name.toLowerCase()
  if (n.includes("court")) return fromName("redBright")
  if (n.includes("plaintiff")) return fromName("yellowLight2")
  if (n.includes("defendant")) return fromName("cyanLight1")
  // No party named, so fall back to the spouse word on its own.
  if (n.includes("wife")) return fromName("yellowLight2")
  if (n.includes("husband")) return fromName("cyanLight1")
  return GRAY
}

/**
 * The chip for an Airtable colour name straight from a base's schema
 * ("cyanLight1", "yellowLight2"). Authoritative, where the schema is readable:
 * it is the colour the board itself shows, not a guess from the option's words.
 */
export function chipFromColorName(colorName: string | undefined): ChipColor {
  return fromName(colorName)
}

// "Sent by:" on the per-client Correspondence tables. The real choices are
// "Us" / "Them " (trailing space on the board) / "Court" / "Mediator", with
// these colors. filedByColor doesn't fit - it matches party words like
// "plaintiff", so everything except Court would have come out gray.
const SENT_BY: Record<string, string> = {
  us: "greenLight2",
  them: "yellowLight2",
  court: "redBright",
  mediator: "purpleLight1",
}

export function sentByColor(name: string): ChipColor {
  return fromName(SENT_BY[name.trim().toLowerCase()])
}

/**
 * "Us" and "Them" are the firm's shorthand on the board. A client reading their
 * own correspondence log shouldn't have to work out who "Them" is, so the chip
 * says it plainly. Anything unrecognised is shown as-is rather than guessed at.
 */
export function sentByLabel(name: string): string {
  switch (name.trim().toLowerCase()) {
    case "us":
      return "Your legal team"
    case "them":
      return "Opposing counsel"
    case "court":
      return "Court"
    case "mediator":
      return "Mediator"
    default:
      return name.trim()
  }
}

// Pleadings that live in a Drive subfolder ("TPO", "FV matter") get a tag and a
// tinted row. Folder names are free-form per client, so pick a stable color from
// a light rotation by hashing the name - the same folder is always the same color.
const FOLDER_ROTATION = [
  "purpleLight2",
  "tealLight2",
  "orangeLight2",
  "blueLight2",
  "pinkLight2",
  "greenLight2",
  "yellowLight2",
  "cyanLight2",
]

export function folderColor(name: string): ChipColor {
  const key = name.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return fromName(FOLDER_ROTATION[hash % FOLDER_ROTATION.length])
}

export function judgeColor(name: string): ChipColor {
  const match = JUDGE_PREFIX.find(([prefix]) => name.startsWith(prefix))
  return fromName(match?.[1])
}
