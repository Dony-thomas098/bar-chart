export function generateStaticParams() {
  return [{ code: 'demo' }];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
