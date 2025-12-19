import { Metadata } from "next";
import { FolderOpen } from "lucide-react";
import { GalleriesList } from "@/components/galleries";

export const metadata: Metadata = {
  title: "My Galleries | SVS Browser",
  description: "Your curated collections of NASA Scientific Visualization Studio pages.",
};

export default function GalleriesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-full bg-blue-100 p-3">
            <FolderOpen className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Galleries</h1>
            <p className="text-gray-600">
              Curated collections of SVS pages
            </p>
          </div>
        </div>

        {/* Content */}
        <GalleriesList />
      </div>
    </div>
  );
}
