import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gray-200",
        className
      )}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="card p-4">
      <div className="flex gap-4">
        <Skeleton className="h-24 w-32 flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SearchResultsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
