import { useState, useEffect } from 'react'

export function useTick(intervalMs = 60000) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let id = null

    const start = () => {
      if (id !== null) return
      id = setInterval(() => setTick(t => t + 1), intervalMs)
    }

    const stop = () => {
      if (id !== null) {
        clearInterval(id)
        id = null
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setTick(t => t + 1)
        start()
      } else {
        stop()
      }
    }

    start()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [intervalMs])

  return tick
}
