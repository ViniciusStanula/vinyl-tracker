'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function NavigationProgress() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    setActive(false)
    clearTimeout(timer.current)
  }, [pathname])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const a = (e.target as Element).closest('a')
      if (!a) return
      const href = a.getAttribute('href')
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('http') ||
        href.startsWith('mailto') ||
        href.startsWith('tel') ||
        href === pathname
      ) return
      setActive(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setActive(false), 8000)
    }
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('click', onClick)
      clearTimeout(timer.current)
    }
  }, [pathname])

  if (!active) return null

  return (
    <div
      role="progressbar"
      aria-label="Carregando página"
      className="fixed top-0 left-0 right-0 z-[200] h-[2px] pointer-events-none"
    >
      <div className="h-full bg-gold" style={{ animation: 'nav-progress 8s ease-out forwards' }} />
    </div>
  )
}
