/**
 * Location: src/lib/queryClient.ts
 * Purpose: Offer a lightweight query cache placeholder until React Query is introduced.
 * Why: Allows feature modules to share a consistent cache API pre-integration.
 */

type Listener = () => void;
type QueryKey = string;

export class QueryClientStub {
  private cache = new Map<QueryKey, unknown>();
  private listeners = new Map<QueryKey, Set<Listener>>();

  getQueryData<T>(key: QueryKey): T | undefined {
    return this.cache.get(key) as T | undefined;
  }

  setQueryData<T>(key: QueryKey, value: T) {
    this.cache.set(key, value);
    this.notify(key);
    return value;
  }

  async fetchQuery<T>(key: QueryKey, fetcher: () => Promise<T>, force = false) {
    if (!force && this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    const data = await fetcher();
    this.setQueryData(key, data);
    return data;
  }

  subscribe(key: QueryKey, listener: Listener) {
    const existing = this.listeners.get(key) ?? new Set<Listener>();
    existing.add(listener);
    this.listeners.set(key, existing);

    return () => {
      existing.delete(listener);
      if (existing.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  invalidate(key: QueryKey) {
    this.cache.delete(key);
    this.notify(key);
  }

  invalidatePrefix(prefix: string) {
    Array.from(this.cache.keys())
      .filter(key => key.startsWith(prefix))
      .forEach(key => this.invalidate(key));
  }

  clear() {
    this.cache.clear();
    this.listeners.forEach(set => set.clear());
    this.listeners.clear();
  }

  private notify(key: QueryKey) {
    this.listeners.get(key)?.forEach(listener => listener());
  }
}

export const queryClient = new QueryClientStub();
