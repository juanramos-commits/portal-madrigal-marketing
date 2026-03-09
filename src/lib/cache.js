// In-memory TTL cache for rarely-changing Supabase data
// (pipelines, categorias, etiquetas, etapas, roles comerciales)

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

const store = new Map()

/**
 * Get a cached value if it exists and hasn't expired.
 * Returns undefined on miss.
 */
export function getCached(key) {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return undefined
  }
  return entry.data
}

/**
 * Store a value in the cache with a TTL.
 */
export function setCache(key, data, ttl = DEFAULT_TTL) {
  store.set(key, { data, expiresAt: Date.now() + ttl })
}

/**
 * Invalidate a single cache key, or all keys matching a prefix.
 * invalidateCache('etapas') removes 'etapas:*' entries too.
 */
export function invalidateCache(key) {
  store.delete(key)
  // Also remove prefixed entries (e.g. 'etapas:uuid')
  for (const k of store.keys()) {
    if (k.startsWith(key + ':')) store.delete(k)
  }
}

/**
 * Clear the entire cache (call on signOut).
 */
export function invalidateAll() {
  store.clear()
}
