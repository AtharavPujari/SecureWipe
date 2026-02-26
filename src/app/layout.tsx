import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SecureWipe - Secure Data Erasure",
  description: "Professional secure data wiping application for storage devices. Built with Next.js, TypeScript, and modern security standards.",
  keywords: ["SecureWipe", "data erasure", "secure wipe", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui", "security", "React"],
  authors: [{ name: "SecureWipe Team" }],
  openGraph: {
    title: "SecureWipe - Secure Data Erasure",
    description: "Professional secure data wiping application for storage devices",
    url: "https://securewipe.app",
    siteName: "SecureWipe",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SecureWipe - Secure Data Erasure",
    description: "Professional secure data wiping application for storage devices",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
