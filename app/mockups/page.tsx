/* /mockups — layout exploration.
   ONE aesthetic (warm ivory + navy + serif, a blend of "Refined Legal" and
   "Warm Boutique"); SIX different page LAYOUTS so the choice is structure,
   not color. Each shows an Admin and a Client preview. */

const T = {
  bg: "#FBF8F3",
  panel: "#FFFFFF",
  warm: "#F5EEE3",
  ink: "#33404C",
  head: "#1B2D45",
  muted: "#94897B",
  hairline: "#E8DFD2",
  navy: "#1B2D45",
  navyText: "#FBF8F3",
  clay: "#B45F3E",
  clayBg: "#EFE2D2",
  pillBg: "#E4EBD9",
  pillText: "#4F6B3C",
  display: "'Fraunces', Georgia, serif",
  body: "'Mulish', system-ui, sans-serif",
  r: 12,
}

const NAV = ["Dashboard", "Documents", "Status", "Tasks", "Messages", "Calendar"]
const ADMIN_NAV = ["Clients", "Tasks", "Pages", "Settings"]
const ICONS = ["▦", "📄", "📊", "✅", "✉", "📅"]

function Pill({ children, bg = T.pillBg, color = T.pillText }: { children: React.ReactNode; bg?: string; color?: string }) {
  return <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, padding: "2px 8px", borderRadius: 999, background: bg, color }}>{children}</span>
}

function TitleRow({ title, action }: { title: string; action: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 11 }}>
      <span style={{ fontFamily: T.display, fontSize: 19, fontWeight: 600, color: T.head }}>{title}</span>
      <span style={{ fontSize: 9, padding: "4px 10px", borderRadius: T.r, background: T.navy, color: T.navyText, fontWeight: 600 }}>{action}</span>
    </div>
  )
}

function AdminList() {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: T.r, overflow: "hidden" }}>
      {["Boatman, D", "Ofori-Darkwa, P", "Randalson, S"].map((n, i) => (
        <div key={n} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 11px", borderTop: i ? `1px solid ${T.hairline}` : "none" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: T.head }}>{n}</span>
            <div style={{ width: 56, height: 4, background: T.hairline, borderRadius: 999 }} />
          </div>
          <Pill>Active</Pill>
        </div>
      ))}
    </div>
  )
}

function ClientBody() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: T.clayBg, border: `1px solid ${T.hairline}`, borderRadius: T.r, padding: 9, fontSize: 9, color: T.head }}>📣 Your next hearing is Apr 22.</div>
      <div style={{ background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: T.r, padding: 11 }}>
        <span style={{ fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: T.muted, fontWeight: 700 }}>Your Tasks</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
          {["Upload financials", "Sign engagement", "Complete intake"].map((task, i) => (
            <div key={task} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 13, height: 13, borderRadius: 999, border: `2px solid ${i === 0 ? T.clay : T.hairline}`, background: i === 0 ? T.clay : "transparent", color: "#fff", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>{i === 0 ? "✓" : ""}</span>
              <span style={{ fontSize: 9.5, color: i === 0 ? T.muted : T.ink, textDecoration: i === 0 ? "line-through" : "none" }}>{task}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Main({ kind, pad = 14 }: { kind: "admin" | "client"; pad?: number }) {
  return (
    <div style={{ flex: 1, padding: pad, background: T.bg, overflow: "hidden" }}>
      <TitleRow title={kind === "admin" ? "Clients" : "Dashboard"} action={kind === "admin" ? "+ Add" : "Refresh"} />
      {kind === "admin" ? <AdminList /> : <ClientBody />}
    </div>
  )
}

function Brand({ size = 26 }: { size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: T.r / 1.6, background: T.navy, color: T.navyText, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.display, fontWeight: 700, fontSize: size * 0.42 }}>E</div>
}

function Screen({ layout, kind }: { layout: string; kind: "admin" | "client" }) {
  const items = kind === "admin" ? ADMIN_NAV : NAV
  const frame: React.CSSProperties = { position: "relative", height: 300, border: `1px solid ${T.hairline}`, borderRadius: T.r, overflow: "hidden", background: T.bg, display: "flex", flexDirection: "column" }

  if (layout === "rail") {
    return (
      <div style={{ ...frame, flexDirection: "row" }}>
        <div style={{ width: 50, background: T.warm, borderRight: `1px solid ${T.hairline}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "9px 0" }}>
          <Brand size={24} />
          {items.slice(0, 5).map((l, i) => (
            <div key={l} style={{ width: 40, padding: "4px 0", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: i === 0 ? T.navy : "transparent", color: i === 0 ? T.navyText : T.ink }}>
              <span style={{ fontSize: 12 }}>{kind === "admin" ? ICONS[i + 1] : ICONS[i]}</span>
              <span style={{ fontSize: 6.5 }}>{l}</span>
            </div>
          ))}
        </div>
        <Main kind={kind} />
      </div>
    )
  }

  if (layout === "sidebar") {
    return (
      <div style={{ ...frame, flexDirection: "row" }}>
        <div style={{ width: 124, background: T.warm, borderRight: `1px solid ${T.hairline}`, padding: 11, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}><Brand size={22} /><span style={{ fontFamily: T.display, fontSize: 11, color: T.head, fontWeight: 600 }}>Edwards</span></div>
          {items.map((l, i) => (
            <div key={l} style={{ fontSize: 10, padding: "6px 9px", borderRadius: 8, background: i === 0 ? T.navy : "transparent", color: i === 0 ? T.navyText : T.ink }}>{l}</div>
          ))}
        </div>
        <Main kind={kind} />
      </div>
    )
  }

  if (layout === "topbar") {
    return (
      <div style={frame}>
        <div style={{ height: 40, background: T.panel, borderBottom: `1px solid ${T.hairline}`, display: "flex", alignItems: "center", gap: 16, padding: "0 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Brand size={20} /><span style={{ fontFamily: T.display, fontSize: 12, color: T.head, fontWeight: 600 }}>Edwards Family Law</span></div>
          <div style={{ display: "flex", gap: 14, marginLeft: 8 }}>
            {items.map((l, i) => (
              <span key={l} style={{ fontSize: 9.5, color: i === 0 ? T.head : T.muted, fontWeight: i === 0 ? 700 : 500, borderBottom: i === 0 ? `2px solid ${T.clay}` : "2px solid transparent", paddingBottom: 11 }}>{l}</span>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", justifyContent: "center", background: T.bg }}>
          <div style={{ width: "100%", maxWidth: 360, padding: 16 }}><TitleRow title={kind === "admin" ? "Clients" : "Dashboard"} action={kind === "admin" ? "+ Add" : "Refresh"} />{kind === "admin" ? <AdminList /> : <ClientBody />}</div>
        </div>
      </div>
    )
  }

  if (layout === "split") {
    const list = kind === "admin" ? ["Boatman, D", "Ofori-Darkwa, P", "Randalson, S", "Kilgus, D"] : ["Upload financials", "Sign engagement", "Complete intake", "Review draft"]
    return (
      <div style={frame}>
        <div style={{ height: 34, background: T.panel, borderBottom: `1px solid ${T.hairline}`, display: "flex", alignItems: "center", gap: 8, padding: "0 12px" }}><Brand size={18} /><span style={{ fontFamily: T.display, fontSize: 12, color: T.head, fontWeight: 600 }}>{kind === "admin" ? "Clients" : "Tasks"}</span></div>
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ width: 130, borderRight: `1px solid ${T.hairline}`, background: T.bg }}>
            {list.map((n, i) => (
              <div key={n} style={{ padding: "10px 11px", borderBottom: `1px solid ${T.hairline}`, borderLeft: `2px solid ${i === 0 ? T.clay : "transparent"}`, background: i === 0 ? T.warm : "transparent" }}>
                <div style={{ fontSize: 9.5, fontWeight: 600, color: T.head }}>{n}</div>
                <div style={{ fontSize: 7.5, color: T.muted, marginTop: 2 }}>{kind === "admin" ? "Updated 2d ago" : "Due Apr 22"}</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, padding: 14, background: T.bg }}>
            <span style={{ fontFamily: T.display, fontSize: 16, fontWeight: 600, color: T.head }}>{list[0]}</span>
            <div style={{ marginTop: 10, background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: T.r, padding: 11, display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ height: 6, width: "80%", background: T.hairline, borderRadius: 999 }} />
              <div style={{ height: 6, width: "60%", background: T.hairline, borderRadius: 999 }} />
              <div style={{ height: 6, width: "70%", background: T.hairline, borderRadius: 999 }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (layout === "hub") {
    const tiles = kind === "admin" ? [["Clients", "👥", "33"], ["Tasks", "✅", "12"], ["Pages", "📄", "9"], ["Settings", "⚙️", ""]] : [["Documents", "📄", "3 due"], ["Status", "📊", ""], ["Tasks", "✅", "2 left"], ["Messages", "✉️", "1"], ["Calendar", "📅", ""], ["Chat", "💬", ""]]
    return (
      <div style={frame}>
        <div style={{ padding: "14px 16px 8px", background: T.bg }}>
          <span style={{ fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: T.muted, fontWeight: 700 }}>{kind === "admin" ? "Admin" : "Welcome back"}</span>
          <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 600, color: T.head, marginTop: 2 }}>{kind === "admin" ? "Overview" : "Deja Boatman"}</div>
        </div>
        <div style={{ flex: 1, padding: "4px 16px 16px", background: T.bg, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignContent: "start" }}>
          {tiles.map(([l, ic, meta]) => (
            <div key={l} style={{ background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: T.r, padding: 11, display: "flex", flexDirection: "column", gap: 6, minHeight: 56 }}>
              <span style={{ fontSize: 16 }}>{ic}</span>
              <span style={{ fontFamily: T.display, fontSize: 12, color: T.head, fontWeight: 600 }}>{l}</span>
              {meta ? <Pill bg={T.clayBg} color={T.clay}>{meta}</Pill> : null}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // focused
  return (
    <div style={{ ...frame, background: T.warm }}>
      <div style={{ height: 38, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderBottom: `1px solid ${T.hairline}`, background: T.bg }}>
        <Brand size={20} /><span style={{ fontFamily: T.display, fontSize: 13, color: T.head, fontWeight: 600 }}>Edwards Family Law</span>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", justifyContent: "center", paddingTop: 16 }}>
        <div style={{ width: 300, background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: T.r, padding: 16, height: "fit-content" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 12 }}>
            {items.slice(0, 4).map((l, i) => <span key={l} style={{ fontSize: 9, color: i === 0 ? T.clay : T.muted, fontWeight: i === 0 ? 700 : 500 }}>{l}</span>)}
          </div>
          <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 600, color: T.head, textAlign: "center", marginBottom: 10 }}>{kind === "admin" ? "Clients" : "Dashboard"}</div>
          {kind === "admin" ? <AdminList /> : <ClientBody />}
        </div>
      </div>
    </div>
  )
}

const LAYOUTS = [
  { key: "rail", name: "Icon Rail", desc: "Compact vertical icon nav. App-like and space-efficient (today's structure)." },
  { key: "sidebar", name: "Classic Sidebar", desc: "Labeled left menu — the most familiar, easy to scan." },
  { key: "topbar", name: "Top Navigation", desc: "Horizontal menu across the top, roomy centered content. Feels like a polished website." },
  { key: "split", name: "Split View", desc: "List on the left, detail on the right (the 'inbox' pattern). Excellent for clients & records." },
  { key: "hub", name: "Card Hub", desc: "Home is a grid of large section tiles with counts. Visual and welcoming." },
  { key: "focused", name: "Focused Column", desc: "One calm, centered column with a slim top bar. Minimal and reassuring for clients." },
]

export default function MockupsPage() {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, fontFamily: T.body }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Mulish:wght@400;600;700&display=swap');`}</style>

      <header style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px 22px" }}>
        <p style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: T.clay, fontWeight: 700 }}>Edwards Family Law</p>
        <h1 style={{ fontFamily: T.display, fontSize: 40, fontWeight: 600, margin: "8px 0 8px", color: T.head }}>Six layouts, one look</h1>
        <p style={{ fontSize: 15, color: T.muted, maxWidth: 660, lineHeight: 1.5 }}>
          All in the warm-ivory + navy serif style you liked (a blend of #1 and #2). What changes here is the <strong style={{ color: T.head }}>layout</strong> — how the portal is organized. Each shows an <strong style={{ color: T.head }}>Admin</strong> and a <strong style={{ color: T.head }}>Client</strong> view. Reply with the layout you want (e.g. &quot;Split for clients, Sidebar for admin&quot;).
        </p>
        <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
          {[T.navy, T.clay, T.warm, T.panel, T.pillBg].map((c, i) => <span key={i} style={{ width: 22, height: 22, borderRadius: 6, background: c, border: `1px solid ${T.hairline}` }} />)}
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 80px", display: "flex", flexDirection: "column", gap: 34 }}>
        {LAYOUTS.map((L, idx) => (
          <section key={L.key} style={{ background: T.panel, borderRadius: 16, padding: 22, border: `1px solid ${T.hairline}`, boxShadow: "0 6px 24px rgba(120,80,50,0.05)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
              <span style={{ fontFamily: T.display, fontSize: 26, color: T.clay, fontWeight: 700 }}>{String(idx + 1).padStart(2, "0")}</span>
              <div>
                <h2 style={{ fontFamily: T.display, fontSize: 20, fontWeight: 600, color: T.head, margin: 0 }}>{L.name}</h2>
                <p style={{ fontSize: 13, color: T.muted, margin: "2px 0 0", maxWidth: 560 }}>{L.desc}</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <p style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: T.muted, fontWeight: 700, marginBottom: 8 }}>Admin</p>
                <Screen layout={L.key} kind="admin" />
              </div>
              <div>
                <p style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: T.muted, fontWeight: 700, marginBottom: 8 }}>Client</p>
                <Screen layout={L.key} kind="client" />
              </div>
            </div>
          </section>
        ))}
      </main>

      <footer style={{ textAlign: "center", padding: "0 24px 60px", color: T.muted, fontSize: 13 }}>
        Tell me the layout(s) to build — admin and client can use different ones.
      </footer>
    </div>
  )
}
