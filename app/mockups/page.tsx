/* Standalone design-exploration gallery — visit /mockups.
   Six distinct UI directions for the portal (admin + client previews).
   Isolated inline styles so each option is true to its own aesthetic. */

type Opt = {
  n: string
  name: string
  vibe: string
  display: string
  body: string
  nav: "rail" | "list" | "topbar"
  radius: number
  shadow: string
  tokens: {
    bg: string
    surface: string
    sidebar: string
    sidebarText: string
    ink: string
    muted: string
    hairline: string
    accent: string
    accentText: string
    pillBg: string
    pillText: string
  }
}

const OPTIONS: Opt[] = [
  {
    n: "01",
    name: "Refined Legal",
    vibe: "Navy & serif. Quiet, trustworthy, established. (An elevated take on today's look.)",
    display: "'Playfair Display', Georgia, serif",
    body: "'Source Sans 3', system-ui, sans-serif",
    nav: "list",
    radius: 8,
    shadow: "none",
    tokens: { bg: "#ffffff", surface: "#f6f7f9", sidebar: "#ffffff", sidebarText: "#334155", ink: "#0f172a", muted: "#64748b", hairline: "#e2e8f0", accent: "#1a2a4a", accentText: "#ffffff", pillBg: "#dcfce7", pillText: "#15803d" },
  },
  {
    n: "02",
    name: "Warm Boutique",
    vibe: "Ivory paper, clay accent, Fraunces serif. Human, calming, high-touch.",
    display: "'Fraunces', Georgia, serif",
    body: "'Mulish', system-ui, sans-serif",
    nav: "list",
    radius: 16,
    shadow: "0 6px 24px rgba(120,80,50,0.08)",
    tokens: { bg: "#fbf7f1", surface: "#f4ece1", sidebar: "#f7efe4", sidebarText: "#5b4636", ink: "#3a2b20", muted: "#8a7563", hairline: "#e7dccd", accent: "#b65c3c", accentText: "#fff8f2", pillBg: "#e8d9bf", pillText: "#8a5a26" },
  },
  {
    n: "03",
    name: "Modern Slate",
    vibe: "Crisp SaaS. Indigo accent, icon rail, soft cards. Efficient and current.",
    display: "'Sora', system-ui, sans-serif",
    body: "'Sora', system-ui, sans-serif",
    nav: "rail",
    radius: 12,
    shadow: "0 1px 3px rgba(16,24,40,0.08), 0 1px 2px rgba(16,24,40,0.06)",
    tokens: { bg: "#f8fafc", surface: "#ffffff", sidebar: "#ffffff", sidebarText: "#475569", ink: "#0f172a", muted: "#64748b", hairline: "#eef2f6", accent: "#4f46e5", accentText: "#ffffff", pillBg: "#e0e7ff", pillText: "#4338ca" },
  },
  {
    n: "04",
    name: "Editorial Mono",
    vibe: "Black, white, one red. Mono + grotesk, sharp hairlines. Bold and distinctive.",
    display: "'Archivo', system-ui, sans-serif",
    body: "'IBM Plex Mono', ui-monospace, monospace",
    nav: "topbar",
    radius: 2,
    shadow: "none",
    tokens: { bg: "#ffffff", surface: "#fafafa", sidebar: "#111111", sidebarText: "#e5e5e5", ink: "#111111", muted: "#6b6b6b", hairline: "#111111", accent: "#e0241b", accentText: "#ffffff", pillBg: "#111111", pillText: "#ffffff" },
  },
  {
    n: "05",
    name: "Dark Luxe",
    vibe: "Charcoal sidebar, gold accent, Cormorant serif. Premium, formal, prestigious.",
    display: "'Cormorant Garamond', Georgia, serif",
    body: "'Mulish', system-ui, sans-serif",
    nav: "list",
    radius: 6,
    shadow: "0 8px 30px rgba(0,0,0,0.12)",
    tokens: { bg: "#faf9f7", surface: "#ffffff", sidebar: "#1c1f26", sidebarText: "#c9cdd6", ink: "#1c1f26", muted: "#8a8f9a", hairline: "#e6e3dd", accent: "#b8924a", accentText: "#1c1f26", pillBg: "#f1e7cf", pillText: "#8a6a22" },
  },
  {
    n: "06",
    name: "Soft Sage",
    vibe: "Off-white, sage green, rounded & gentle. Reassuring for stressed clients.",
    display: "'Fraunces', Georgia, serif",
    body: "'Mulish', system-ui, sans-serif",
    nav: "rail",
    radius: 20,
    shadow: "0 4px 20px rgba(60,80,60,0.06)",
    tokens: { bg: "#f4f6f2", surface: "#ffffff", sidebar: "#eef2ea", sidebarText: "#4a5a4a", ink: "#27332a", muted: "#6f7d6f", hairline: "#dde5d8", accent: "#5b7a5b", accentText: "#ffffff", pillBg: "#dfeAd9", pillText: "#3f5a3f" },
  },
]

const ICONS = ["▦", "✓", "▤", "◷", "✉", "◆"]

function Bar({ w, h = 8, c }: { w: number | string; h?: number; c: string }) {
  return <div style={{ width: w, height: h, background: c, borderRadius: 999 }} />
}

function Screen({ opt, kind }: { opt: Opt; kind: "admin" | "client" }) {
  const t = opt.tokens
  const title = kind === "admin" ? "Clients" : "Dashboard"
  const labels = kind === "admin" ? ["Clients", "Tasks", "Pages", "Settings"] : ["Home", "Documents", "Status", "Tasks", "Messages"]

  const card: React.CSSProperties = { background: t.surface, border: `1px solid ${t.hairline}`, borderRadius: opt.radius, boxShadow: opt.shadow }

  const Rail = (
    <div style={{ width: 52, background: t.sidebar, borderRight: `1px solid ${t.hairline}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 0" }}>
      <div style={{ width: 26, height: 26, borderRadius: opt.radius / 1.5, background: t.accent, color: t.accentText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>E</div>
      {labels.slice(0, 5).map((l, i) => (
        <div key={l} style={{ width: 40, padding: "5px 0", borderRadius: opt.radius / 1.5, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: i === 0 ? t.accent : "transparent", color: i === 0 ? t.accentText : t.sidebarText }}>
          <span style={{ fontSize: 13 }}>{ICONS[i]}</span>
          <span style={{ fontSize: 7 }}>{l}</span>
        </div>
      ))}
    </div>
  )

  const List = (
    <div style={{ width: 116, background: t.sidebar, borderRight: `1px solid ${t.hairline}`, padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{ width: 22, height: 22, borderRadius: opt.radius / 1.5, background: t.accent, color: t.accentText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>E</div>
        <span style={{ fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase", color: t.muted }}>Edwards</span>
      </div>
      {labels.map((l, i) => (
        <div key={l} style={{ fontSize: 10, padding: "5px 8px", borderRadius: opt.radius / 2, background: i === 0 ? t.accent : "transparent", color: i === 0 ? t.accentText : t.sidebarText }}>{l}</div>
      ))}
    </div>
  )

  const Topbar = (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 34, background: t.sidebar, color: t.sidebarText, display: "flex", alignItems: "center", gap: 14, padding: "0 12px", borderBottom: `2px solid ${t.accent}` }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>EFL</span>
      {labels.map((l, i) => (
        <span key={l} style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: i === 0 ? t.accent : t.sidebarText, fontWeight: i === 0 ? 700 : 400 }}>{l}</span>
      ))}
    </div>
  )

  const content = (
    <div style={{ flex: 1, padding: 14, paddingTop: opt.nav === "topbar" ? 44 : 14, background: t.bg, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontFamily: opt.display, fontSize: 20, fontWeight: 700, color: t.ink, letterSpacing: opt.display.includes("Archivo") ? -0.5 : 0 }}>{title}</span>
        <span style={{ fontSize: 9, padding: "4px 10px", borderRadius: opt.radius, background: t.accent, color: t.accentText, fontWeight: 600 }}>{kind === "admin" ? "+ Add" : "Refresh"}</span>
      </div>

      {kind === "client" && (
        <div style={{ ...card, padding: 9, marginBottom: 10, fontSize: 9, color: t.ink, background: opt.n === "04" ? t.surface : t.pillBg, borderColor: t.hairline }}>
          📣 Welcome — your next hearing is Apr 22.
        </div>
      )}

      {kind === "admin" ? (
        <div style={{ ...card, overflow: "hidden" }}>
          {["Boatman, D", "Ofori-Darkwa, P", "Randalson, S"].map((nme, i) => (
            <div key={nme} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 11px", borderTop: i ? `1px solid ${t.hairline}` : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: t.ink }}>{nme}</span>
                <Bar w={54} h={5} c={t.hairline} />
              </div>
              <span style={{ fontSize: 8, padding: "2px 8px", borderRadius: 999, background: t.pillBg, color: t.pillText, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Active</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ ...card, padding: 11 }}>
            <span style={{ fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: t.muted, fontWeight: 700 }}>Your Tasks</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {["Upload financials", "Sign engagement", "Complete intake form"].map((task, i) => (
                <div key={task} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 13, height: 13, borderRadius: 999, border: `2px solid ${i === 0 ? t.accent : t.hairline}`, background: i === 0 ? t.accent : "transparent", color: t.accentText, fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>{i === 0 ? "✓" : ""}</span>
                  <span style={{ fontSize: 9.5, color: i === 0 ? t.muted : t.ink, textDecoration: i === 0 ? "line-through" : "none" }}>{task}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...card, height: 46, display: "flex", alignItems: "center", justifyContent: "center", color: t.muted, fontSize: 9 }}>▦ Embedded case board</div>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ position: "relative", display: "flex", height: 300, border: `1px solid ${t.hairline}`, borderRadius: opt.radius, overflow: "hidden", background: t.bg, boxShadow: opt.shadow }}>
      {opt.nav === "rail" && Rail}
      {opt.nav === "list" && List}
      {opt.nav === "topbar" && Topbar}
      {content}
    </div>
  )
}

export default function MockupsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "'Source Sans 3', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Sora:wght@400;600;700&family=Archivo:wght@600;800&family=IBM+Plex+Mono:wght@400;600&family=Cormorant+Garamond:wght@600;700&family=Source+Sans+3:wght@400;600;700&family=Mulish:wght@400;600;700&display=swap');`}</style>

      <header style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 24px" }}>
        <p style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#94a3b8", fontWeight: 700 }}>Edwards Family Law · Portal</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 700, margin: "8px 0 6px", color: "#fff" }}>Choose a look</h1>
        <p style={{ fontSize: 15, color: "#94a3b8", maxWidth: 640 }}>Six directions for the client portal and admin. Each shows an <strong style={{ color: "#cbd5e1" }}>Admin</strong> and a <strong style={{ color: "#cbd5e1" }}>Client</strong> preview. Tell me the number you like (or mix elements) and I&apos;ll build it for real across the whole portal.</p>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px", display: "flex", flexDirection: "column", gap: 40 }}>
        {OPTIONS.map((opt) => (
          <section key={opt.n} style={{ background: "#1e293b", borderRadius: 18, padding: 24, border: "1px solid #334155" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, color: "#475569", fontWeight: 700 }}>{opt.n}</span>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>{opt.name}</h2>
                  <p style={{ fontSize: 13, color: "#94a3b8", margin: "3px 0 0", maxWidth: 520 }}>{opt.vibe}</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[opt.tokens.accent, opt.tokens.sidebar, opt.tokens.surface, opt.tokens.ink, opt.tokens.pillBg].map((c, i) => (
                  <span key={i} title={c} style={{ width: 22, height: 22, borderRadius: 6, background: c, border: "1px solid rgba(255,255,255,0.15)" }} />
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <p style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#64748b", fontWeight: 700, marginBottom: 8 }}>Admin</p>
                <Screen opt={opt} kind="admin" />
              </div>
              <div>
                <p style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#64748b", fontWeight: 700, marginBottom: 8 }}>Client</p>
                <Screen opt={opt} kind="client" />
              </div>
            </div>
          </section>
        ))}
      </main>

      <footer style={{ textAlign: "center", padding: "0 24px 60px", color: "#64748b", fontSize: 13 }}>
        Reply with the option number (e.g. &quot;build #3&quot;) — or pick the nav from one and the colors from another.
      </footer>
    </div>
  )
}
