import type { Metadata } from "next"
import { Inter, Libre_Baskerville } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "next-auth/react"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const baskerville = Libre_Baskerville({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-baskerville" })

export const metadata: Metadata = {
  title: "Edwards Family Law — Client Portal",
  description: "Secure client portal for Edwards Family Law",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${inter.variable} ${baskerville.variable}`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
