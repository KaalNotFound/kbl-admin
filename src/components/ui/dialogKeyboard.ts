import type { KeyboardEvent } from 'react'

// Shared APG dialog keyboard behavior (issue #4 C4.1): Escape closes the
// dialog from ANY focus inside it, and Tab/Shift+Tab cycles within the
// dialog instead of escaping to the page behind the modal.
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function handleDialogKeyDown(
  e: KeyboardEvent,
  { onClose }: { onClose: () => void },
) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    onClose()
    return
  }
  if (e.key !== 'Tab') return
  const focusables = Array.from(
    (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(FOCUSABLE),
  )
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
