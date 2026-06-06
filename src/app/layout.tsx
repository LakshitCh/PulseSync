import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulseSync: Kinetic Playlist Architect",
  description:
    "AI-powered workout playlist generator. Select your gym split, seed tracks, and surface perfect sonic matches for any training session.",
  keywords: ["workout playlist", "music AI", "BPM matcher", "gym music", "playlist generator"],
  authors: [{ name: "PulseSync" }],
  openGraph: {
    title: "PulseSync: Kinetic Playlist Architect",
    description: "Build your perfect workout playlist with AI-powered audio vector matching.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
