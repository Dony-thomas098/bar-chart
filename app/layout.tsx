import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { OfflineSyncProvider } from "@/components/OfflineSyncContext";
import { Navigation } from "@/components/Navigation";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Clypto UI",
  description: "A tool for creating and editing bar chart notations.",
  generator: "Next.js",
  manifest: "/manifest.json",
  keywords: ["music", "chord", "chart", "editor"],
  authors: [
    { name: "ChordCraft" }
  ],
  icons: [
    { rel: "apple-touch-icon", url: "icon-192x192.png" },
    { rel: "icon", url: "icon-192x192.png" },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Clypto UI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
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
      <body className="min-h-[100dvh] flex flex-col font-sans bg-bg text-text-primary selection:bg-accent-solid/30" suppressHydrationWarning>
        <AuthProvider>
          <OfflineSyncProvider>
          {/* Responsive Background Image */}
          <div 
            className="fixed inset-0 pointer-events-none -z-10 no-print bg-[#080414] bg-cover bg-center bg-no-repeat transform scale-[1.15] md:scale-100"
            style={{
              backgroundImage: 'url(/bg.png)',
            }}
          >
            {/* Dark overlay to ensure text remains readable over the image */}
            <div className="absolute inset-0 bg-black/60 mix-blend-multiply" />
          </div>
          {children}
          <Navigation />
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
