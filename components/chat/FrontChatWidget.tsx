"use client"

import Script from "next/script"

export default function FrontChatWidget() {
  return (
    <Script
      src="https://chat-assets.frontapp.com/v1/chat.bundle.js"
      strategy="afterInteractive"
      onLoad={() => {
        // @ts-ignore
        window.FrontChat("init", {
          chatId: "4ba9a1366a0c3ac55355eceb11901b9e",
          useDefaultLauncher: true,
        })
      }}
    />
  )
}
