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
  keywords: ["music", "chord", "chart", "editor", "musician", "piascore", "setlist"],
  authors: [
    { name: "Chordly" }
  ],
  icons: [
    { rel: "apple-touch-icon", url: "/icon-192x192.png" },
    { rel: "icon", url: "/icon-192x192.png" },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Chordly",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ececee",
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
            `,
          }}
        />
      </head>
      <body className="min-h-[100dvh] flex flex-col font-sans bg-[var(--bg-canvas)] text-text-primary selection:bg-orange-500/20" suppressHydrationWarning>
        <AuthProvider>
          <SplashScreen />
          <OfflineSyncProvider>
            <ThemeSync />
            {/* Soft Glass Decorative Canvas Blobs */}
            <BackgroundBlobs />
            
            {children}
            <Navigation />
            <InstallPrompt />
            <OnboardingModal />
          </OfflineSyncProvider>
        </AuthProvider>
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                // In dev mode, unregister any active service worker to avoid stale chunk caching & localhost latency
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for (let registration of registrations) {
                    registration.unregister();
                  }
                });
              } else {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('Service Worker registration successful with scope: ', registration.scope);
                    },
                    function(err) {
                      console.log('Service Worker registration failed: ', err);
                    }
                  );
                });
              }
            }
          `}
        </Script>
      </body>
    </html>
  );
}

