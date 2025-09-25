import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContextOptimized";
import Header from "@/components/Header";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "@/services/authService"; // authServiceを初期化（インターセプター有効化）

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "心のログ - Kokoro Log",
  description: "AI VTuber-powered emotional journaling application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>
          <AuthProvider>
            <Header />
            {children}
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
