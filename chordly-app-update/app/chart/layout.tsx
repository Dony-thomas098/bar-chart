import type { Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ececee" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 10,
  userScalable: true,
  viewportFit: "cover",
};

export default function ChartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
