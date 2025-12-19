"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Menu, X, Compass, Heart, FolderOpen } from "lucide-react";
import { useState, useRef } from "react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Search", href: "/search" },
  { name: "Browse", href: "/browse" },
  { name: "Chat", href: "/chat" },
  { name: "Favorites", href: "/favorites", icon: Heart },
  { name: "Galleries", href: "/galleries", icon: FolderOpen },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickSearchValue, setQuickSearchValue] = useState("");
  const quickSearchRef = useRef<HTMLInputElement>(null);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearchValue.trim()) {
      router.push(`/search?q=${encodeURIComponent(quickSearchValue.trim())}`);
      setQuickSearchValue("");
    }
  };

  // Don't show header on home page (it has its own design)
  const isHomePage = pathname === "/";

  return (
    <header className={cn(
      "sticky top-0 z-50 border-b bg-white",
      isHomePage ? "border-transparent" : "border-gray-200"
    )}>
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
                <Compass className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold leading-tight text-gray-900">SVS Browser</span>
                <span className="text-xs leading-tight text-gray-500">Scientific Visualization Studio</span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href));
              const Icon = (item as { icon?: React.ElementType }).icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors rounded-md",
                    isActive
                      ? "text-blue-600"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Quick Search (Desktop) */}
          <div className="hidden md:flex md:items-center md:gap-4">
            <form onSubmit={handleQuickSearch} className="relative">
              <input
                ref={quickSearchRef}
                type="search"
                value={quickSearchValue}
                onChange={(e) => setQuickSearchValue(e.target.value)}
                placeholder="Quick search..."
                className="h-9 w-48 rounded-md border border-gray-300 bg-gray-50 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </form>

            {/* Hamburger menu for additional options */}
            <button
              type="button"
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              type="button"
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
            >
              <span className="sr-only">
                {mobileMenuOpen ? "Close menu" : "Open menu"}
              </span>
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="border-t border-gray-200 md:hidden">
            <div className="space-y-1 py-3">
              {/* Mobile Search */}
              <form onSubmit={handleQuickSearch} className="px-2 pb-3">
                <div className="relative">
                  <input
                    type="search"
                    value={quickSearchValue}
                    onChange={(e) => setQuickSearchValue(e.target.value)}
                    placeholder="Search visualizations..."
                    className="h-10 w-full rounded-md border border-gray-300 bg-gray-50 pl-10 pr-4 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </form>

              {navigation.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== "/" && pathname?.startsWith(item.href));
                const Icon = (item as { icon?: React.ElementType }).icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-base font-medium",
                      isActive
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {Icon && <Icon className="h-5 w-5" />}
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
