"use client"
// components/dashboard/DemoVideo.tsx — the portal demo video, collapsible.
// Collapsed state is remembered per device (localStorage) so returning
// clients who've watched it keep it tucked away.

import { useEffect, useState } from "react"

const STORAGE_KEY = "demoVideoCollapsed"

export default function DemoVideo({ embedUrl }: { embedUrl: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1")
    } catch {}
    setReady(true)
  }, [])

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
    } catch {}
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-gray-900">▶ New here? Watch a quick demo of your portal</p>
        <button
          type="button"
          onClick={toggle}
          className="text-sm text-blue-600 hover:underline shrink-0"
        >
          {collapsed ? "Show video ▾" : "Hide video ▴"}
        </button>
      </div>
      {ready && !collapsed && (
        <div className="mt-3 rounded-lg overflow-hidden aspect-video max-w-2xl">
          <iframe
            src={embedUrl}
            title="Portal demo video"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}
    </div>
  )
}
