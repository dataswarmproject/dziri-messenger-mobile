interface TabSessionStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

/** Convex Auth supplies namespaced auth keys; no message bodies are persisted. */
export function createWebSessionStorage(resolve: () => TabSessionStorage) {
  return {
    getItem: (key: string) => resolve().getItem(key),
    setItem: (key: string, value: string) => resolve().setItem(key, value),
    removeItem: (key: string) => resolve().removeItem(key),
  };
}
