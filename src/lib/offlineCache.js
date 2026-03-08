/**
 * IndexedDB-based offline cache for CRM catalog data.
 * Persists across page refreshes and browser sessions.
 * Serves stale data immediately while fresh data loads in background.
 */

const DB_NAME = 'portal_madrigal_cache'
const DB_VERSION = 1
const STORE_NAME = 'cache'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
  })
  return dbPromise
}

export async function cacheGet(key) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => {
        const entry = req.result
        if (!entry) { resolve(null); return }
        resolve(entry.data)
      }
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function cacheSet(key, data) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({ data, ts: Date.now() }, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // Silently fail — cache is best-effort
  }
}

export async function cacheClear() {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // ignore
  }
}
