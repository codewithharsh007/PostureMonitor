import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#22c55e",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://your-domain.vercel.app"),
  title: {
    default: "Posture Monitor — Real-Time Posture Tracking",
    template: "%s | Posture Monitor",
  },
  description:
    "AI-powered posture monitoring that tracks your neck, spine, shoulders, and head alignment in real time. Stay healthy while you work.",
  keywords: [
    "posture monitor",
    "posture tracker",
    "real-time posture",
    "neck alignment",
    "spine health",
    "AI posture correction",
    "work from home health",
    "sitting posture",
  ],
  authors: [{ name: "Harsh" }],
  applicationName: "Posture Monitor",
  robots: {
    index: true,
    follow: true,
    googleBot: "index, follow",
  },
  openGraph: {
    type: "website",
    url: "https://your-domain.vercel.app",
    title: "Posture Monitor — Real-Time AI Posture Tracking",
    description:
      "Monitor your posture live with AI. Get instant feedback on neck, spine, shoulder, and head alignment while you work.",
    siteName: "Posture Monitor",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Posture Monitor Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Posture Monitor — Real-Time AI Posture Tracking",
    description:
      "Monitor your posture live with AI. Get instant feedback on neck, spine, shoulder, and head alignment.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
