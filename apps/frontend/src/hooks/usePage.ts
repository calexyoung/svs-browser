"use client";

import { useState, useCallback, useEffect } from "react";
import { getPage, type SvsPageDetail } from "@/lib/api";

interface UsePageState {
  data: SvsPageDetail | null;
  isLoading: boolean;
  error: Error | null;
}

interface UsePageReturn extends UsePageState {
  refetch: () => Promise<void>;
}

export function usePage(svsId: number | null): UsePageReturn {
  const [state, setState] = useState<UsePageState>({
    data: null,
    isLoading: false,
    error: null,
  });

  const fetchPage = useCallback(async () => {
    if (!svsId) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await getPage(svsId);
      setState({ data, isLoading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        isLoading: false,
        error: err instanceof Error ? err : new Error("Failed to fetch page"),
      });
    }
  }, [svsId]);

  useEffect(() => {
    if (svsId) {
      fetchPage();
    }
  }, [svsId, fetchPage]);

  return {
    ...state,
    refetch: fetchPage,
  };
}
