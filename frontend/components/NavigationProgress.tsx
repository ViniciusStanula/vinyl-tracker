'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type State = 'idle' | 'running' | 'completing'

export default function NavigationProgress() {
  const pathname = usePathname()
  const [state, setState] = useState<State>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // URL changed → fill bar to 100% and fade out
  useEffect(() => {
    setState(prev => (prev === 'running' ? 'completing' : prev))
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
      setState('running')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setState('completing'), 8000)
    }
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('click', onClick)
      clearTimeout(timer.current)
    }
  }, [pathname])

  if (state === 'idle') return null

  return (
    <div
      role="progressbar"
      aria-label="Carregando página"
      className="fixed top-0 left-0 right-0 z-[200] h-[2px] pointer-events-none"
    >
      <div
        className="h-full bg-gold"
        style={{
          animation:
            state === 'running'
              ? 'nav-progress 8s ease-out forwards'
              : 'nav-complete 500ms ease-out forwards',
        }}
        onAnimationEnd={state === 'completing' ? () => setState('idle') : undefined}
      />
    </div>
  )
}
