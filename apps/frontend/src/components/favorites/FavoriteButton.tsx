"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsFavorite, useFavorites } from "@/hooks";
import type { FavoriteInput } from "@/types/favorites";

interface FavoriteButtonProps {
  svsId: number;
  title: string;
  thumbnailUrl?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  onToggle?: (isFavorite: boolean) => void;
  onEditClick?: () => void;
  className?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

const buttonSizeClasses = {
  sm: "p-1",
  md: "p-1.5",
  lg: "p-2",
};

export function FavoriteButton({
  svsId,
  title,
  thumbnailUrl,
  size = "md",
  showLabel = false,
  onToggle,
  onEditClick,
  className,
}: FavoriteButtonProps) {
  const { isFavorite } = useIsFavorite(svsId);
  const { toggleFavorite } = useFavorites();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const input: FavoriteInput = {
      svs_id: svsId,
      title,
      thumbnail_url: thumbnailUrl,
    };

    const newState = toggleFavorite(input);

    // Animate the heart
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    onToggle?.(newState);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onEditClick && isFavorite) {
      e.preventDefault();
      e.stopPropagation();
      onEditClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md transition-colors",
        buttonSizeClasses[size],
        isFavorite
          ? "text-red-500 hover:text-red-600 hover:bg-red-50"
          : "text-gray-400 hover:text-red-500 hover:bg-gray-100",
        className
      )}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFavorite}
    >
      <Heart
        className={cn(
          sizeClasses[size],
          "transition-transform",
          isFavorite && "fill-current",
          isAnimating && "scale-125"
        )}
      />
      {showLabel && (
        <span className="text-sm">
          {isFavorite ? "Favorited" : "Favorite"}
        </span>
      )}
    </button>
  );
}
