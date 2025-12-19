import { Metadata } from "next";
import { Heart } from "lucide-react";
import { FavoritesList } from "@/components/favorites";

export const metadata: Metadata = {
  title: "My Favorites | SVS Browser",
  description: "Your saved favorite pages from NASA's Scientific Visualization Studio archive.",
};

export default function FavoritesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-full bg-red-100 p-3">
            <Heart className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Favorites</h1>
            <p className="text-gray-600">
              Your saved pages from the SVS archive
            </p>
          </div>
        </div>

        {/* Content */}
        <FavoritesList />
      </div>
    </div>
  );
}
