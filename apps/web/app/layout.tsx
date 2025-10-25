import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Fairlane DEX",
  description: "Deterministic batch auction DEX on Solana",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

