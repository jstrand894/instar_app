import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Highlight, Stroke } from '../types'

export const HL_COLORS: Record<string, string> = {
  yellow: 'rgba(255, 214, 0, 0.45)',
  green: 'rgba(60, 200, 90, 0.40)',
  blue: 'rgba(60, 150, 255, 0.40)',
  pink: 'rgba(255, 90, 160, 0.40)',
}

export type Tool = 'none' | 'pen' | 'eraser'

interface Props {
  doc: PDFDocumentProxy
  num: number
  size: { w: number; h: number }   // page size at scale 1
  scale: number
  highlights: Highlight[]
  strokes: Stroke[]
  tool: Tool
  penColor: string
  scroller: React.RefObject<HTMLDivElement | null>
  onStrokes: (page: number, strokes: Stroke[]) => void
}

export default function PageView({ doc, num, size, scale, highlights, strokes, tool, penColor, scroller, onStrokes }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const inkCv = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(false)
  const width = size.w * scale
  const height = size.h * scale

  useEffect(() => {
    const el = wrap.current!
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true) }, { rootMargin: '800px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // render PDF canvas + text layer
  useEffect(() => {
    if (!near) return
    let cancelled = false
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | null = null
    let textLayer: pdfjs.TextLayer | null = null
    ;(async () => {
      const page = await doc.getPage(num)
      if (cancelled) return
      const viewport = page.getViewport({ scale })
      const dpr = window.devicePixelRatio || 1
      const cv = canvas.current!
      cv.width = Math.floor(viewport.width * dpr)
      cv.height = Math.floor(viewport.height * dpr)
      cv.style.width = `${viewport.width}px`
      cv.style.height = `${viewport.height}px`
      renderTask = page.render({
        canvas: cv, viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      })
      try { await renderTask.promise } catch { return }
      if (cancelled) return
      const tdiv = text.current!
      tdiv.replaceChildren()
      tdiv.style.setProperty('--scale-factor', String(scale))
      textLayer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: tdiv, viewport })
      try { await textLayer.render() } catch { /* cancelled */ }
    })()
    return () => { cancelled = true; renderTask?.cancel(); textLayer?.cancel() }
  }, [near, doc, num, scale])

  // draw ink
  useEffect(() => { drawInk(inkCv.current!, strokes, width, height) }, [strokes, width, height])

  // pen / eraser input
  const live = useRef<Stroke | null>(null)
  const touchY = useRef<number | null>(null)
  const inkMode = tool !== 'none'

  function norm(e: React.PointerEvent): [number, number, number] {
    const r = inkCv.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, e.pressure || 0.5]
  }
  function erase(e: React.PointerEvent) {
    const [x, y] = norm(e)
    const rx = 14 / width, ry = 14 / height
    const kept = strokes.filter(s => !s.points.some(p => Math.abs(p[0] - x) < rx && Math.abs(p[1] - y) < ry))
    if (kept.length !== strokes.length) onStrokes(num, kept)
  }
  function down(e: React.PointerEvent) {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* pointer already gone */ }
    if (e.pointerType === 'touch') { touchY.current = e.clientY; return }
    if (tool === 'eraser') { erase(e); live.current = { color: '', width: 0, points: [] }; return }
    live.current = { color: penColor, width: 2.2, points: [norm(e)] }
  }
  function move(e: React.PointerEvent) {
    if (e.pointerType === 'touch') {
      // keep finger scrolling alive while the canvas has touch-action: none
      if (touchY.current !== null && scroller.current) {
        scroller.current.scrollTop -= e.clientY - touchY.current
        touchY.current = e.clientY
      }
      return
    }
    const s = live.current
    if (!s) return
    if (tool === 'eraser') { erase(e); return }
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? []
    const r = inkCv.current!.getBoundingClientRect()
    const pts = events.length ? events : [e.nativeEvent as PointerEvent]
    for (const ev of pts) s.points.push([(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height, ev.pressure || 0.5])
    drawInk(inkCv.current!, [...strokes, s], width, height)
  }
  function up(e: React.PointerEvent) {
    touchY.current = null
    const s = live.current; live.current = null
    if (e.pointerType === 'touch' || !s || tool === 'eraser') return
    if (s.points.length > 1) onStrokes(num, [...strokes, s])
    else drawInk(inkCv.current!, strokes, width, height)
  }

  return (
    <div ref={wrap} className="pdfPage" data-page={num} style={{ width, height, ['--scale-factor' as string]: scale }}>
      <canvas ref={canvas} className="pdfCanvas" />
      <div className="hl-layer">
        {highlights.flatMap(h => h.rects.map((r, i) => (
          <i key={`${h.id}-${i}`} id={i === 0 ? `hl-${h.id}` : undefined}
            style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`, background: HL_COLORS[h.color] }} />
        )))}
      </div>
      <div ref={text} className="textLayer" />
      <canvas
        ref={inkCv}
        className={`ink ${inkMode ? 'active' : ''}`}
        onPointerDown={inkMode ? down : undefined}
        onPointerMove={inkMode ? move : undefined}
        onPointerUp={inkMode ? up : undefined}
        onPointerCancel={inkMode ? up : undefined}
      />
      <span className="pageno">{num}</span>
    </div>
  )
}

function drawInk(cv: HTMLCanvasElement, strokes: Stroke[], w: number, h: number) {
  const dpr = window.devicePixelRatio || 1
  if (cv.width !== Math.floor(w * dpr) || cv.height !== Math.floor(h * dpr)) {
    cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr)
    cv.style.width = `${w}px`; cv.style.height = `${h}px`
  }
  const ctx = cv.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  for (const s of strokes) {
    ctx.strokeStyle = s.color
    for (let i = 1; i < s.points.length; i++) {
      const a = s.points[i - 1], b = s.points[i]
      ctx.lineWidth = s.width * (0.5 + b[2] * 1.3)
      ctx.beginPath(); ctx.moveTo(a[0] * w, a[1] * h); ctx.lineTo(b[0] * w, b[1] * h); ctx.stroke()
    }
  }
}
