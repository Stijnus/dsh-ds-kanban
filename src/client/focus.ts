/** Focus management for plugin-owned modal dialogs. */
import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Move focus into a dialog on mount, keep Tab inside it, and restore focus to
 * the opener on unmount. The returned ref must sit on the dialog element,
 * which needs tabIndex={-1} so it can receive focus.
 * @returns ref for the dialog element.
 */
export function useModalFocus<T extends HTMLElement>(): RefObject<T> {
  const ref = useRef<T>(null)
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const container = ref.current
    container?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab' || container === null) return
      const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter(element => !element.hasAttribute('disabled'))
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      opener?.focus()
    }
  }, [])
  return ref
}
