"use client";

import { useState, useCallback } from "react";
import { search as searchApi, type SearchParams, type SearchResponse } from "@/lib/api";

interface UseSearchState {
  data: SearchResponse | null;
  isLoading: boolean;
  error: Error | null;
}

interface UseSearchReturn extends UseSearchState {
  search: (params: SearchParams) => Promise<void>;
  reset: () => void;
}

const initialState: UseSearchState = {
  data: null,
  isLoading: false,
  error: null,
};

export function useSearch(): UseSearchReturn {
  const [state, setState] = useState<UseSearchState>(initialState);

  const search = useCallback(async (params: SearchParams) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await searchApi(params);
      setState({ data, isLoading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        isLoading: false,
        error: err instanceof Error ? err : new Error("Search failed"),
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    search,
    reset,
  };
}
