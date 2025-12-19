import Link from "next/link";
import { Compass } from "lucide-react";

interface FooterProps {
  indexedCount?: number;
  lastUpdated?: string;
}

export function Footer({ indexedCount = 0, lastUpdated }: FooterProps) {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <Compass className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">SVS Browser</span>
            </Link>
            <p className="mt-3 text-sm text-gray-600">
              Explore NASA&apos;s Scientific Visualization Studio content with enhanced search and AI-powered insights.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Explore</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/search" className="text-sm text-gray-600 hover:text-blue-600">
                  Advanced Search
                </Link>
              </li>
              <li>
                <Link href="/browse" className="text-sm text-gray-600 hover:text-blue-600">
                  Browse Collections
                </Link>
              </li>
              <li>
                <Link href="/chat" className="text-sm text-gray-600 hover:text-blue-600">
                  AI Assistant
                </Link>
              </li>
              <li>
                <Link href="/search?sort=date_desc" className="text-sm text-gray-600 hover:text-blue-600">
                  Recent Releases
                </Link>
              </li>
            </ul>
          </div>

          {/* Help */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Help</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/about" className="text-sm text-gray-600 hover:text-blue-600">
                  About
                </Link>
              </li>
              <li>
                <Link href="/guide" className="text-sm text-gray-600 hover:text-blue-600">
                  User Guide
                </Link>
              </li>
              <li>
                <Link href="/api-docs" className="text-sm text-gray-600 hover:text-blue-600">
                  API Documentation
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-gray-600 hover:text-blue-600">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* NASA Resources */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">NASA Resources</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <a
                  href="https://svs.gsfc.nasa.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-blue-600"
                >
                  Official SVS Site
                </a>
              </li>
              <li>
                <a
                  href="https://www.nasa.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-blue-600"
                >
                  NASA.gov
                </a>
              </li>
              <li>
                <a
                  href="https://www.nasa.gov/about/highlights/HP_Privacy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-blue-600"
                >
                  Privacy Policy
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-8 md:flex-row">
          <p className="text-sm text-gray-500">
            {lastUpdated && `Data last updated: ${lastUpdated} | `}
            {indexedCount > 0 && `Indexed: ${indexedCount.toLocaleString()} visualizations`}
          </p>
          <p className="text-sm text-gray-500">
            Built for NASA&apos;s Scientific Visualization Studio
          </p>
        </div>
      </div>
    </footer>
  );
}
