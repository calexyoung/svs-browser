"use client";

import { ChevronDown, ChevronUp, Lightbulb, Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { FilterState, FacetCounts } from "@/types";

interface SearchFiltersProps {
  filters: FilterState;
  facets?: FacetCounts;
  onChange: (filters: FilterState) => void;
  onClear: () => void;
  isOpen?: boolean;
  onToggle?: () => void;
  className?: string;
}

const mediaTypes = [
  { value: "video", label: "Video" },
  { value: "image", label: "Image" },
  { value: "data", label: "Data" },
  { value: "other", label: "Other" },
] as const;

const domainTopics = [
  { value: "earth_science", label: "Earth Science" },
  { value: "planetary", label: "Planetary" },
  { value: "astrophysics", label: "Astrophysics" },
  { value: "heliophysics", label: "Heliophysics" },
] as const;

const popularMissions = [
  "Hubble",
  "JWST",
  "Landsat",
  "Mars Rovers",
  "MAVEN",
  "SDO",
];

export function SearchFilters({
  filters,
  facets,
  onChange,
  onClear,
  isOpen = true,
  onToggle,
  className,
}: SearchFiltersProps) {
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [missionSearch, setMissionSearch] = useState("");

  const handleMediaTypeChange = (type: string, checked: boolean) => {
    const currentTypes = filters.media_types || [];
    const newTypes = checked
      ? [...currentTypes, type as FilterState["media_types"][number]]
      : currentTypes.filter((t) => t !== type);
    onChange({ ...filters, media_types: newTypes });
  };

  const handleDomainChange = (domain: string, checked: boolean) => {
    const currentDomains = filters.domains || [];
    const newDomains = checked
      ? [...currentDomains, domain]
      : currentDomains.filter((d) => d !== domain);
    onChange({ ...filters, domains: newDomains });
  };

  const handleMissionChange = (mission: string, checked: boolean) => {
    const currentMissions = filters.missions || [];
    const newMissions = checked
      ? [...currentMissions, mission]
      : currentMissions.filter((m) => m !== mission);
    onChange({ ...filters, missions: newMissions });
  };

  const hasActiveFilters =
    (filters.media_types?.length || 0) > 0 ||
    filters.date_from ||
    filters.date_to ||
    (filters.domains?.length || 0) > 0 ||
    (filters.missions?.length || 0) > 0;

  // Get missions to display (from facets or default list)
  const displayMissions = facets?.missions
    ? Object.keys(facets.missions).slice(0, 10)
    : popularMissions;

  const filteredMissions = missionSearch
    ? displayMissions.filter((m) =>
        m.toLowerCase().includes(missionSearch.toLowerCase())
      )
    : displayMissions;

  return (
    <aside className={cn("w-full", className)}>
      <div className={cn("space-y-6", !isOpen && "hidden lg:block")}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          {hasActiveFilters && (
            <button
              onClick={onClear}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Media Type */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-gray-900">Media Type</h3>
          <div className="space-y-2">
            {mediaTypes.map((type) => {
              const count = facets?.media_types?.[type.value] || 0;
              return (
                <label
                  key={type.value}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <input
                    type="checkbox"
                    checked={filters.media_types?.includes(type.value as any) || false}
                    onChange={(e) =>
                      handleMediaTypeChange(type.value, e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{type.label}</span>
                  {count > 0 && (
                    <span className="text-sm text-gray-400">{count.toLocaleString()}</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <button
            onClick={() => setDateRangeOpen(!dateRangeOpen)}
            className="flex w-full items-center justify-between"
          >
            <h3 className="text-sm font-medium text-gray-900">Date Range</h3>
            {dateRangeOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>
          {dateRangeOpen && (
            <div className="mt-3 space-y-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">From</label>
                <input
                  type="date"
                  value={filters.date_from || ""}
                  onChange={(e) =>
                    onChange({ ...filters, date_from: e.target.value || null })
                  }
                  className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">To</label>
                <input
                  type="date"
                  value={filters.date_to || ""}
                  onChange={(e) =>
                    onChange({ ...filters, date_to: e.target.value || null })
                  }
                  className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Domain / Topic */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-gray-900">Domain / Topic</h3>
          <div className="space-y-2">
            {domainTopics.map((topic) => (
              <label
                key={topic.value}
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  type="checkbox"
                  checked={filters.domains?.includes(topic.value) || false}
                  onChange={(e) =>
                    handleDomainChange(topic.value, e.target.checked)
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{topic.label}</span>
              </label>
            ))}
            <button className="text-sm text-blue-600 hover:text-blue-700">
              + Show more
            </button>
          </div>
        </div>

        {/* Mission */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-gray-900">Mission</h3>
          <div className="relative mb-3">
            <input
              type="text"
              value={missionSearch}
              onChange={(e) => setMissionSearch(e.target.value)}
              placeholder="Search missions..."
              className="h-9 w-full rounded-md border border-gray-300 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {filteredMissions.map((mission) => (
              <label
                key={mission}
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  type="checkbox"
                  checked={filters.missions?.includes(mission) || false}
                  onChange={(e) =>
                    handleMissionChange(mission, e.target.checked)
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{mission}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Apply Filters Button */}
        <button className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
          Apply Filters
        </button>

        {/* Quick Tips */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <Lightbulb className="h-4 w-4" />
            <span className="text-sm font-medium">Quick Tips</span>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-amber-700">
            <li>• Search by SVS ID for direct access</li>
            <li>• Use mission names (Mars, Hubble)</li>
            <li>• Try event keywords (eclipse, aurora)</li>
            <li>• Filter by media type for faster results</li>
          </ul>
        </div>
      </div>
    </aside>
  );
}
