export function generateStaticParams() {
  return [{ id: 'demo' }];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
