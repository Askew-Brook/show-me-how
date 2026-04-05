import { useEffect, useMemo, useState } from 'react'

type TaggedElement = {
  id: string
  label: string
  rect: {
    top: number
    left: number
    width: number
    height: number
  }
}

interface DevModeOverlayProps {
  enabled: boolean
  showOutlines: boolean
}

function collectTaggedElements() {
  const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-dev-label]'))
  const tagged: TaggedElement[] = []

  for (const element of elements) {
    const label = element.dataset.devLabel?.trim()
    if (!label) continue

    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden' || rect.width <= 0 || rect.height <= 0) {
      continue
    }

    tagged.push({
      id: label,
      label,
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      }
    })
  }

  return tagged
}

export default function DevModeOverlay({ enabled, showOutlines }: DevModeOverlayProps) {
  const [elements, setElements] = useState<TaggedElement[]>([])

  useEffect(() => {
    if (!enabled) {
      setElements([])
      return
    }

    let frameId = 0
    let timeoutId = 0

    const update = () => {
      frameId = 0
      setElements(collectTaggedElements())
    }

    const schedule = () => {
      if (frameId) return
      frameId = window.requestAnimationFrame(update)
    }

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-dev-label', 'class', 'style', 'open']
    })

    window.addEventListener('resize', schedule)
    document.addEventListener('scroll', schedule, true)
    timeoutId = window.setInterval(schedule, 180)
    schedule()

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      document.removeEventListener('scroll', schedule, true)
      window.clearInterval(timeoutId)
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [enabled])

  const visibleElements = useMemo(
    () => elements.filter((element) => element.rect.top < window.innerHeight && element.rect.top + element.rect.height > 0),
    [elements]
  )

  if (!enabled) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] select-none">
      {visibleElements.map((element) => (
        <div key={element.id}>
          {showOutlines ? (
            <div
              className="absolute rounded-[6px] border border-dashed border-[#7b978a]/80 bg-[#7b978a]/[0.03]"
              style={{
                top: element.rect.top,
                left: element.rect.left,
                width: element.rect.width,
                height: element.rect.height
              }}
            />
          ) : null}

          <div
            className="absolute rounded-[6px] border border-[#4b6256] bg-[#1e2721] px-1.5 py-[2px] text-[10px] font-medium text-[#d9e3dc] shadow-sm shadow-black/20"
            style={{
              top: Math.max(4, element.rect.top - 10),
              left: Math.max(4, element.rect.left + element.rect.width - 8),
              transform: 'translate(-100%, 0)'
            }}
          >
            {element.label}
          </div>
        </div>
      ))}
    </div>
  )
}
