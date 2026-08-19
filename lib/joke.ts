// lib/joke.ts - clean joke of the day from icanhazdadjoke.com (family-friendly
// dad jokes). Next caches the fetch for 4 hours, so everyone sees the same
// joke and it rotates every 4 hours. Fails soft to null.

export async function getJokeOfTheDay(): Promise<string | null> {
  try {
    const res = await fetch("https://icanhazdadjoke.com/", {
      headers: {
        Accept: "application/json",
        "User-Agent": "Edwards Family Law client portal (https://edwards-law-portal.vercel.app)",
      },
      next: { revalidate: 14400 }, // 4 hours
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.joke === "string" && data.joke.trim() ? data.joke.trim() : null
  } catch {
    return null
  }
}
