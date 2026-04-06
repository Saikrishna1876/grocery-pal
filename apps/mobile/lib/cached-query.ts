import * as React from 'react';

type QueryCacheRecord<T> = {
  data: T;
  updatedAt: number;
};

type CachedQueryOptions<T> = {
  queryName: string;
  args?: unknown;
  liveData: T | undefined;
  loaderDelayMs?: number;
};

type CachedQueryResult<T> = {
  data: T | undefined;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  showLoader: boolean;
  hasCachedData: boolean;
  lastUpdatedAt: number | null;
};

const QUERY_CACHE = new Map<string, QueryCacheRecord<unknown>>();

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(objectValue[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

export function createQueryCacheKey(queryName: string, args?: unknown) {
  return `${queryName}:${stableSerialize(args ?? null)}`;
}

export function useDelayedLoader(active: boolean, delayMs = 900) {
  const [showLoader, setShowLoader] = React.useState(false);

  React.useEffect(() => {
    if (!active) {
      setShowLoader(false);
      return;
    }

    const timeout = setTimeout(() => setShowLoader(true), delayMs);
    return () => clearTimeout(timeout);
  }, [active, delayMs]);

  return showLoader;
}

export function useCachedQueryValue<T>(options: CachedQueryOptions<T>): CachedQueryResult<T> {
  const { queryName, args, liveData, loaderDelayMs } = options;
  const cacheKey = React.useMemo(() => createQueryCacheKey(queryName, args), [args, queryName]);

  const [cachedData, setCachedData] = React.useState<T | undefined>(() => {
    const cached = QUERY_CACHE.get(cacheKey) as QueryCacheRecord<T> | undefined;
    return cached?.data;
  });
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<number | null>(() => {
    const cached = QUERY_CACHE.get(cacheKey) as QueryCacheRecord<T> | undefined;
    return cached?.updatedAt ?? null;
  });

  React.useEffect(() => {
    const cached = QUERY_CACHE.get(cacheKey) as QueryCacheRecord<T> | undefined;
    setCachedData(cached?.data);
    setLastUpdatedAt(cached?.updatedAt ?? null);
  }, [cacheKey]);

  React.useEffect(() => {
    if (liveData === undefined) {
      return;
    }

    const updatedAt = Date.now();
    QUERY_CACHE.set(cacheKey, { data: liveData, updatedAt });
    setCachedData(liveData);
    setLastUpdatedAt(updatedAt);
  }, [cacheKey, liveData]);

  const data = liveData ?? cachedData;
  const hasCachedData = cachedData !== undefined;
  const isInitialLoading = liveData === undefined && !hasCachedData;
  const isRefreshing = liveData === undefined && hasCachedData;
  const showLoader = useDelayedLoader(isInitialLoading, loaderDelayMs);

  return {
    data,
    isInitialLoading,
    isRefreshing,
    showLoader,
    hasCachedData,
    lastUpdatedAt,
  };
}
