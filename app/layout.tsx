import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { OfflineSyncProvider } from "@/components/OfflineSyncContext";
import { Navigation } from "@/components/Navigation";
import { InstallPrompt } from "@/components/InstallPrompt";
import { OnboardingModal } from "@/components/OnboardingModal";
import { BackgroundBlobs } from "@/components/ui/primitives";
import { ThemeSync } from "@/components/ThemeSync";
import { SplashScreen } from "@/components/SplashScreen";
import { CapacitorInit } from "@/components/CapacitorInit";
import { LiveUpdateNotification } from "@/components/LiveUpdateNotification";
import { SWRegister } from "@/components/SWRegister";
import Script from "next/script";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Chordly - Bar Chart Notations",
  description: "A professional tool for creating, editing, and performing bar chart chord progressions and lyrics.",
  generator: "Next.js",
  manifest: "/manifest.json",
  keywords: ["music", "chord", "chart", "lyrics", "editor", "musician", "setlist"],
  authors: [
    { name: "Chordly" }
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Chordly",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ececee" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('chord-grid-theme') || 'system';
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var isDark = theme === 'dark' || (theme === 'system' && prefersDark);
                  var root = document.documentElement;
                  if (isDark) {
                    root.classList.add('dark');
                    root.setAttribute('data-theme', 'dark');
                  } else {
                    root.classList.remove('dark');
                    root.setAttribute('data-theme', 'light');
                  }
                  root.classList.remove('no-splash');
                } catch (e) {}
              })();
              window.addEventListener('error', function(e) {
                if (e && e.message && (e.message.indexOf('Loading chunk') !== -1 || e.message.indexOf('ChunkLoadError') !== -1)) {
                  window.location.reload();
                }
              });
              window.addEventListener('unhandledrejection', function(e) {
                if (e && e.reason && (e.reason.name === 'ChunkLoadError' || (e.reason.message && e.reason.message.indexOf('Loading chunk') !== -1))) {
                  window.location.reload();
                }
              });
              if ('serviceWorker' in navigator) {
                try {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('[SW] Registered successfully:', reg.scope);
                  }).catch(function(err) {
                    console.warn('[SW] Registration failed:', err);
                  });
                } catch (e) {}
              }
            `,
          }}
        />
      </head>
      <body className="min-h-[100dvh] flex flex-col font-sans bg-[var(--bg-canvas)] text-text-primary selection:bg-orange-500/20" suppressHydrationWarning>
        <AuthProvider>
          <SplashScreen />
          <CapacitorInit />
          <LiveUpdateNotification />
          <OfflineSyncProvider>
            <ThemeSync />
            {/* Soft Glass Decorative Canvas Blobs */}
            <BackgroundBlobs />
            
            {children}
            <Navigation />
            <InstallPrompt />
            <OnboardingModal />
            <SWRegister />
          </OfflineSyncProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

