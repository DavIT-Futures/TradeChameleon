import { useEffect, useRef } from 'react'

/** Returns a ref; the element flashes green/red whenever `value` goes up/down. */
export function useFlash<T extends HTMLElement>(value: number | undefined) {
  const ref = useRef<T>(null)
  const previous = useRef(value)
  useEffect(() => {
    const prev = previous.current
    previous.current = value
    const el = ref.current
    if (!el || value == null || prev == null || value === prev) return
    el.classList.remove('flash-up', 'flash-down')
    void el.offsetWidth // restart the CSS animation
    el.classList.add(value > prev ? 'flash-up' : 'flash-down')
  }, [value])
  return ref
}
