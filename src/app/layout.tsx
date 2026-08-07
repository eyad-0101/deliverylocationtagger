import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWASetup from "@/components/PWASetup";
import ThemeScript from "@/components/ThemeScript";

export const metadata: Metadata = {
  title: "تحديد مواقع التوصيل",
  description: "أداة داخلية لحفظ ومشاركة مواقع العملاء بين المندوبين",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
        {/* Runs before paint to avoid a light-mode flash for users who
            chose dark mode last time. */}
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <PWASetup />
        {children}
      </body>
    </html>
  );
}
