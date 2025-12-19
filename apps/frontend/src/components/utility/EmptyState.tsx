import { Search, AlertCircle, FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateVariant = "no-results" | "error" | "not-found";

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const icons = {
  "no-results": Search,
  error: AlertCircle,
  "not-found": FileQuestion,
};

export function EmptyState({
  variant = "no-results",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const Icon = icons[variant];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-4 py-12 text-center",
        className
      )}
    >
      <div
        className={cn(
          "mb-4 rounded-full p-3",
          variant === "error" ? "bg-red-100" : "bg-gray-100"
        )}
      >
        <Icon
          className={cn(
            "h-8 w-8",
            variant === "error" ? "text-red-500" : "text-gray-400"
          )}
          aria-hidden="true"
        />
      </div>
      <h2 className="text-lg font-medium text-gray-900">{title}</h2>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
