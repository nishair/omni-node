import { useEffect, useState } from 'react'

const read = () => (typeof location === 'undefined' ? '' : location.hash.replace(/^#/, ''))

/** The URL hash as state, so the chosen region survives a reload and can be linked. */
export function useHash(): [string, (next: string) => void] {
  const [hash, setHash] = useState(read)
  useEffect(() => {
    const onChange = () => setHash(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return [hash, (next) => { location.hash = next }]
}
