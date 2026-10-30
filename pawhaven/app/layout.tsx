import './business.css';
import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Petify — A happier life, together",
  description: "Thoughtful care for your favourite companion. Explore pet grooming, vet consultations, boarding, walking, adoption and everyday essentials with Petify.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head><link rel="stylesheet" href="/fonts/fonts.css" /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
