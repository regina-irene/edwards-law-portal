import type { Metadata } from "next"
import { Mulish, Fraunces } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "next-auth/react"

const mulish = Mulish({ subsets: ["latin"], variable: "--font-mulish" })
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-fraunces" })

export const metadata: Metadata = {
  title: "Edwards Family Law — Client Portal",
  description: "Secure client portal for Edwards Family Law",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${mulish.className} ${mulish.variable} ${fraunces.variable}`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
