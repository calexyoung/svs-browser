"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  Tag,
  Users,
  MessageSquare,
  Share2,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Link2,
  Compass,
} from "lucide-react";
import { getPage, SvsPageDetail } from "@/lib/api";
import { AssetGallery, RichContent } from "@/components/detail";
import { formatDate } from "@/lib/utils";
import { Header } from "@/components/layout";
import { FavoriteButton } from "@/components/favorites";
import { AddToGalleryMenu } from "@/components/galleries";

export default function SvsDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const svsId = parseInt(id, 10);

  const [page, setPage] = useState<SvsPageDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchPage() {
      if (isNaN(svsId)) {
        setError("Invalid SVS ID");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await getPage(svsId);
        setPage(data);
      } catch (err) {
        console.error("Failed to load page:", err);
        setError(err instanceof Error ? err.message : "Failed to load page");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPage();
  }, [svsId]);

  const handleCopyLink = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share && page) {
      try {
        await navigator.share({
          title: page.title,
          url: window.location.href,
        });
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  // Group tags by type
  const tagsByType = page?.tags.reduce(
    (acc, tag) => {
      if (!acc[tag.type]) acc[tag.type] = [];
      acc[tag.type].push(tag.value);
      return acc;
    },
    {} as Record<string, string[]>
  );

  // Group credits by role
  const creditsByRole = page?.credits.reduce(
    (acc, credit) => {
      const role = credit.role || "Contributor";
      if (!acc[role]) acc[role] = [];
      acc[role].push(credit);
      return acc;
    },
    {} as Record<string, typeof page.credits>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Back navigation */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to results
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="mt-4 text-lg font-semibold text-red-900">
              {error === "Invalid SVS ID" ? "Invalid SVS ID" : "Page Not Found"}
            </h2>
            <p className="mt-2 text-red-700">
              {error === "Invalid SVS ID"
                ? "The SVS ID in the URL is not valid."
                : "This visualization may have been removed or the ID is incorrect."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/search"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Search
              </Link>
              <Link
                href="/"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Browse recent
              </Link>
            </div>
          </div>
        )}

        {/* Page Content */}
        {page && !isLoading && (
          <article>
            {/* Header Section */}
            <header className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                      SVS-{page.svs_id}
                    </span>
                    {page.published_date && (
                      <span className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        {formatDate(page.published_date)}
                      </span>
                    )}
                  </div>
                  <h1 className="mt-3 text-2xl font-bold text-gray-900 lg:text-3xl">
                    {page.title}
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <FavoriteButton
                    svsId={page.svs_id}
                    title={page.title}
                    thumbnailUrl={page.assets[0]?.thumbnail_url}
                    size="lg"
                    className="rounded-lg bg-gray-100 hover:bg-gray-200"
                  />
                  <AddToGalleryMenu
                    svsId={page.svs_id}
                    title={page.title}
                    thumbnailUrl={page.assets[0]?.thumbnail_url}
                    size="md"
                    className="rounded-lg bg-gray-100 p-2.5 hover:bg-gray-200"
                  />
                  <button
                    onClick={handleShare}
                    className="rounded-lg bg-gray-100 p-2.5 text-gray-600 hover:bg-gray-200"
                    title="Share"
                  >
                    {copied ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <Share2 className="h-5 w-5" />
                    )}
                  </button>
                  <Link
                    href={`/chat?svs=${page.svs_id}`}
                    className="rounded-lg bg-blue-600 p-2.5 text-white hover:bg-blue-700"
                    title="Ask AI about this"
                  >
                    <MessageSquare className="h-5 w-5" />
                  </Link>
                </div>
              </div>

              {/* Summary / Description */}
              {(page.content || page.summary) && (
                <div className="mt-6 rounded-lg bg-gray-50 p-4 lg:p-6">
                  <RichContent
                    content={page.content}
                    fallbackText={page.summary}
                    className="space-y-4"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={page.canonical_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  View on NASA SVS
                </a>
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Link
                    </>
                  )}
                </button>
                <Link
                  href={`/chat?svs=${page.svs_id}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <MessageSquare className="h-4 w-4" />
                  Ask AI About This
                </Link>
              </div>
            </header>

            {/* Media Assets */}
            {page.assets.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-4 text-xl font-bold text-gray-900">Media Assets</h2>
                <AssetGallery assets={page.assets} />
              </section>
            )}

            {/* For More Information (External Link) */}
            <section className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-blue-900">
                <ExternalLink className="h-5 w-5" />
                For More Information
              </h2>
              <p className="mt-2 text-blue-800">
                View the complete visualization with all available formats, captions, and download options on the official NASA SVS website.
              </p>
              <a
                href={page.canonical_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Visit NASA SVS Page
                <ExternalLink className="h-4 w-4" />
              </a>
            </section>

            {/* Credits Section */}
            {page.credits.length > 0 && creditsByRole && (
              <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                  <Users className="h-5 w-5" />
                  Credits
                </h2>
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(creditsByRole).map(([role, credits]) => (
                    <div key={role}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {role}
                      </h3>
                      <ul className="space-y-2">
                        {credits.map((credit, i) => (
                          <li key={i}>
                            <p className="font-medium text-gray-900">{credit.name}</p>
                            {credit.organization && (
                              <p className="text-sm text-gray-500">{credit.organization}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Tags Section */}
            {page.tags.length > 0 && tagsByType && (
              <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                  <Tag className="h-5 w-5" />
                  Tags & Categories
                </h2>
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(tagsByType).map(([type, values]) => (
                    <div key={type}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {type}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {values.map((value) => (
                          <Link
                            key={value}
                            href={`/search?q=${encodeURIComponent(value)}`}
                            className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                          >
                            {value}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Related Visualizations */}
            {page.related_pages.length > 0 && (
              <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                  <Link2 className="h-5 w-5" />
                  Related Visualizations
                </h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {page.related_pages.slice(0, 6).map((related) => (
                    <Link
                      key={related.svs_id}
                      href={`/svs/${related.svs_id}`}
                      className="group rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 group-hover:bg-blue-100">
                          <Compass className="h-5 w-5 text-gray-500 group-hover:text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 group-hover:text-blue-700 line-clamp-2">
                            {related.title}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            SVS-{related.svs_id}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                {page.related_pages.length > 6 && (
                  <p className="mt-4 text-center text-sm text-gray-500">
                    +{page.related_pages.length - 6} more related visualizations
                  </p>
                )}
              </section>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
