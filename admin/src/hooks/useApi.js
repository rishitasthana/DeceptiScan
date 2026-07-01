/**
 * useApi — generic async data fetching hook.
 */

import { useState, useEffect, useCallback } from "react";

/**
 * @param {Function} fetcher - Async function that returns data.
 * @param {Array} deps - Dependencies array for refetching.
 * @returns {{ data, loading, error, refetch }}
 */
export function useApi(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch_(); }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}
