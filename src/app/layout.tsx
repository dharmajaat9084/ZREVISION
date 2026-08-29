import type { Metadata, Viewport } from "next";
import { Caveat, Nunito, Patrick_Hand } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const caveat = Caveat({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const patrickHand = Patrick_Hand({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: "400",
});

const nunito = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "StudyNest — Your Study Notebook",
  description:
    "A private study notebook for organising subjects, chapters, topics, notes, questions and practice sheets — with spaced-repetition revision built in. Everything stays on your device.",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f0e1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${caveat.variable} ${patrickHand.variable} ${nunito.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
