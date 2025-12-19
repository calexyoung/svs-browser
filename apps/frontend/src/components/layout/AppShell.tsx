import { Header } from "./Header";
import { Footer } from "./Footer";

interface AppShellProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
}

export function AppShell({
  children,
  showHeader = true,
  showFooter = true,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      {showHeader && <Header />}
      <main id="main-content" className="flex-1">
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
}
