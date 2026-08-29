'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Crop, Loader2, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'
import { blobUrl } from '@/lib/db'
import { useApp } from '@/lib/store'
import { CATEGORY_META, type ItemCategory, type StudyItem } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Sel {
  x: number
  y: number
  w: number
  h: number
}

type DragMode = 'draw' | 'move' | 'resize' | null

const HANDLE = 14 // display px corner handle

export function SnapshotDialog({ item, onClose }: { item: StudyItem; onClose: () => void }) {
  const createSnapshotItem = useApp((s) => s.createSnapshotItem)
  const addReview = useApp((s) => s.addReview)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const [pdfDoc, setPdfDoc] = useState<Awaited<ReturnType<typeof loadPdf>> | null>(null)
  const [page, setPage] = useState(1)
  const [numPages, setNumPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [displayScale, setDisplayScale] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [sel, setSel] = useState<Sel | null>(null)
  const [drag, setDrag] = useState<DragMode>(null)
  const dragStart = useRef<{ px: number; py: number; sel: Sel } | null>(null)

  /* form */
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ItemCategory>(item.category)
  const [toRevision, setToRevision] = useState(true)
  const [saving, setSaving] = useState(false)

  /* ── load source ─────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false
    let doc: Awaited<ReturnType<typeof loadPdf>> | null = null
    const canvas = canvasRef.current
    if (!canvas) return
    setLoading(true)
    setSel(null)
    ;(async () => {
      try {
        const url = await blobUrl(item.blobKey!)
        if (item.fileKind === 'image') {
          const img = new Image()
          img.onload = () => {
            if (cancelled) return
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight
            canvas.getContext('2d')!.drawImage(img, 0, 0)
            setNatural({ w: img.naturalWidth, h: img.naturalHeight })
            setLoading(false)
          }
          img.onerror = () => toast.error('Could not load image')
          img.src = url
        } else {
          const data = new Uint8Array(await (await fetch(url)).arrayBuffer())
          doc = await loadPdf(data)
          if (cancelled) {
            doc.destroy()
            return
          }
          setPdfDoc(doc)
          setNumPages(doc.numPages)
          setPage(1)
          const dims = await renderPage(doc, 1, canvas)
          if (cancelled) return
          setNatural(dims)
          setLoading(false)
        }
      } catch {
        if (!cancelled) toast.error('Could not open this file for snapshotting')
      }
    })()
    return () => {
      cancelled = true
      doc?.destroy?.()
    }

  }, [item.id])

  /* ── pdf page change ─────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pdfDoc || loading) return
    let cancelled = false
    setLoading(true)
    setSel(null)
    renderPage(pdfDoc, page, canvas)
      .then((dims) => {
        if (!cancelled) {
          setNatural(dims)
          setLoading(false)
        }
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }

  }, [page, pdfDoc])

  /* ── fit to container ────────────────────────────────────────── */
  useEffect(() => {
    if (!natural || !containerRef.current) return
    const cw = containerRef.current.clientWidth - 24
    const fit = Math.min(1, cw / natural.w)
    setDisplayScale(fit * zoom)
  }, [natural, zoom])

  /* reset name when selection changes */
  useEffect(() => {
    if (sel) {
      setName(item.name + (item.fileKind === 'pdf' ? ` · p${page} crop` : ' · crop'))
    }

  }, [sel !== null])

  const effScale = displayScale || 1
  const dispSize = natural ? { w: natural.w * effScale, h: natural.h * effScale } : null

  /* ── pointer interactions ────────────────────────────────────── */
  const toNatural = useCallback(
    (e: React.PointerEvent) => {
      const rect = overlayRef.current!.getBoundingClientRect()
      return {
        x: (e.clientX - rect.left) / effScale,
        y: (e.clientY - rect.top) / effScale,
      }
    },
    [effScale]
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if (loading || !natural) return
    const p = toNatural(e)
    const minNat = 6 / effScale

    if (sel) {
      const inSel =
        p.x >= sel.x && p.x <= sel.x + sel.w && p.y >= sel.y && p.y <= sel.y + sel.h
      const handleRect = {
        x: sel.x + sel.w - HANDLE / effScale,
        y: sel.y + sel.h - HANDLE / effScale,
        w: (HANDLE * 2) / effScale,
      }
      const onHandle = p.x >= handleRect.x && p.x <= handleRect.x + handleRect.w && p.y >= handleRect.y && p.y <= handleRect.y + handleRect.w
      if (onHandle) {
        setDrag('resize')
        dragStart.current = { px: p.x, py: p.y, sel: { ...sel } }
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        return
      }
      if (inSel) {
        setDrag('move')
        dragStart.current = { px: p.x, py: p.y, sel: { ...sel } }
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        return
      }
    }
    setDrag('draw')
    dragStart.current = { px: p.x, py: p.y, sel: { x: p.x, y: p.y, w: 0, h: 0 } }
    setSel({ x: p.x, y: p.y, w: 0, h: 0 })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !dragStart.current || !natural) return
    const p = toNatural(e)
    const s0 = dragStart.current.sel
    const minNat = 6 / effScale

    if (drag === 'draw') {
      setSel({
        x: Math.max(0, Math.min(s0.x, p.x)),
        y: Math.max(0, Math.min(s0.y, p.y)),
        w: Math.min(natural.w, Math.max(s0.x, p.x)) - Math.max(0, Math.min(s0.x, p.x)),
        h: Math.min(natural.h, Math.max(s0.y, p.y)) - Math.max(0, Math.min(s0.y, p.y)),
      })
    } else if (drag === 'move') {
      const dx = p.x - dragStart.current.px
      const dy = p.y - dragStart.current.py
      setSel({
        ...s0,
        x: Math.max(0, Math.min(natural.w - s0.w, s0.x + dx)),
        y: Math.max(0, Math.min(natural.h - s0.h, s0.y + dy)),
      })
    } else if (drag === 'resize') {
      setSel({
        x: s0.x,
        y: s0.y,
        w: Math.max(minNat, Math.min(natural.w - s0.x, p.x - s0.x)),
        h: Math.max(minNat, Math.min(natural.h - s0.y, p.y - s0.y)),
      })
    }
  }

  const onPointerUp = () => {
    if (drag === 'draw' && sel && (sel.w < 6 / effScale || sel.h < 6 / effScale)) {
      setSel(null) // treat as click, discard tiny selection
    }
    setDrag(null)
    dragStart.current = null
  }

  /* ── save ────────────────────────────────────────────────────── */
  const save = async () => {
    const canvas = canvasRef.current
    if (!sel || !canvas || sel.w < 4 || sel.h < 4) {
      toast.error('Drag on the page to select the part you want to keep')
      return
    }
    setSaving(true)
    try {
      const out = document.createElement('canvas')
      out.width = Math.round(sel.w)
      out.height = Math.round(sel.h)
      out.getContext('2d')!.drawImage(canvas, sel.x, sel.y, sel.w, sel.h, 0, 0, out.width, out.height)
      const blob: Blob | null = await new Promise((res) => out.toBlob(res, 'image/png'))
      if (!blob) throw new Error('crop failed')
      const id = await createSnapshotItem(
        item.nodeId,
        name.trim() || `${item.name} snapshot`,
        blob,
        category,
        item.id,
        item.fileKind === 'pdf' ? page : undefined
      )
      if (toRevision) await addReview(id)
      toast.success(toRevision ? 'Snapshot saved & scheduled for revision' : 'Snapshot saved')
      onClose()
    } catch {
      toast.error('Could not save the snapshot')
    } finally {
      setSaving(false)
    }
  }

  const selDisp = sel && dispSize ? { left: sel.x * effScale, top: sel.y * effScale, width: sel.w * effScale, height: sel.h * effScale } : null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 p-0 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Snapshot tool for ${item.name}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="pop-in flex h-full w-full max-w-5xl flex-col overflow-hidden border-2 border-border bg-card sketch sm:h-[92dvh] sm:rounded-3xl">
        {/* header */}
        <div className="flex shrink-0 items-center gap-3 border-b-2 border-border bg-[var(--sidebar)] px-4 py-3">
          <div className="flex size-10 rotate-[-3deg] items-center justify-center rounded-xl bg-[#4f8f7b] text-white sketch">
            <Crop className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl leading-none">Snapshot</p>
            <p className="truncate font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
              drag a box around the tricky bit of “{item.name}” — keep just that for revision
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close snapshot tool"
            className="flex size-9 items-center justify-center rounded-xl border-2 border-border bg-card hover:bg-secondary"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {/* toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b-2 border-border/60 bg-secondary/30 px-4 py-2">
          {item.fileKind === 'pdf' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-card disabled:opacity-40"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <span className="font-hand text-base">
                page {page} / {numPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(numPages, p + 1))}
                disabled={page >= numPages}
                aria-label="Next page"
                className="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-card disabled:opacity-40"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
              aria-label="Zoom out"
              className="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-card"
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <span className="w-12 text-center font-hand text-base">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
              aria-label="Zoom in"
              className="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-card"
            >
              <Plus className="size-4" aria-hidden />
            </button>
            <button
              onClick={() => {
                setZoom(1)
                setSel(null)
              }}
              className="ml-1 flex items-center gap-1 rounded-lg border-2 border-border bg-card px-2 py-1 font-hand text-sm hover:bg-secondary"
            >
              <RotateCcw className="size-3.5" aria-hidden /> reset
            </button>
          </div>
          {sel && (
            <span className="ml-auto font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
              selected {Math.round(sel.w)} × {Math.round(sel.h)} px — drag inside to move, corner to resize
            </span>
          )}
        </div>

        {/* canvas area */}
        <div ref={containerRef} className="relative min-h-0 flex-1 overflow-auto bg-secondary/40 p-3">
          <div className="flex min-h-full items-start justify-center">
            <div className="relative" style={{ width: dispSize?.w, height: dispSize?.h }}>
              <canvas
                ref={canvasRef}
                className="block rounded-md border-2 border-border bg-white shadow-md"
                style={{ width: dispSize?.w, height: dispSize?.h }}
              />
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-md bg-card/70">
                  <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
                </div>
              )}
              {/* crop overlay */}
              <div
                ref={overlayRef}
                className={cn('absolute inset-0 touch-none', drag ? 'cursor-grabbing' : 'cursor-crosshair')}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {selDisp && (
                  <div
                    className="absolute border-2 border-[#4f8f7b]"
                    style={{
                      ...selDisp,
                      boxShadow: '0 0 0 9999px rgba(30,26,20,0.45)',
                      cursor: drag === 'move' ? 'grabbing' : 'move',
                    }}
                  >
                    <div
                      className="absolute right-0 bottom-0 size-3.5 cursor-nwse-resize rounded-tl-md border-2 border-white bg-[#4f8f7b]"
                      style={{ width: HANDLE, height: HANDLE }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* footer form */}
        <div className="flex shrink-0 flex-wrap items-end gap-3 border-t-2 border-border bg-[var(--sidebar)] px-4 py-3">
          <div className="min-w-44 flex-1">
            <label htmlFor="snap-name" className="mb-0.5 block font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
              Snapshot name
            </label>
            <input
              id="snap-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. tricky derivation"
              className="w-full rounded-lg border-2 border-border bg-card px-3 py-1.5 font-sans text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            />
          </div>
          <div>
            <span className="mb-0.5 block font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
              Category
            </span>
            <div className="flex gap-1.5">
              {(Object.keys(CATEGORY_META) as ItemCategory[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={cn(
                    'rounded-lg border-2 px-2.5 py-1.5 font-hand text-sm transition-all',
                    category === c ? 'ink-shadow-sm -rotate-1' : 'border-dashed opacity-70 hover:opacity-100'
                  )}
                  style={category === c ? { borderColor: CATEGORY_META[c].color, background: CATEGORY_META[c].soft } : undefined}
                >
                  {CATEGORY_META[c].label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-1">
            <input
              type="checkbox"
              checked={toRevision}
              onChange={(e) => setToRevision(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            <span className="font-hand text-[15px]">add to revision plan</span>
          </label>
          <button
            onClick={save}
            disabled={!sel || saving}
            className="flex items-center gap-2 rounded-xl border-2 border-primary/70 bg-primary px-4 py-2 font-hand text-base text-primary-foreground sketch ink-shadow disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Crop className="size-4" aria-hidden />}
            Save snapshot
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── pdf helpers ──────────────────────────────────────────────────── */

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((m) => {
      m.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      return m
    })
  }
  return pdfjsPromise
}

async function loadPdf(data: Uint8Array) {
  const pdfjs = await getPdfjs()
  return pdfjs.getDocument({ data }).promise
}

async function renderPage(doc: Awaited<ReturnType<typeof loadPdf>>, pageNum: number, canvas: HTMLCanvasElement) {
  const pageProxy = await doc.getPage(pageNum)
  const base = pageProxy.getViewport({ scale: 1 })
  const scale = Math.min(2.2, Math.max(1.4, 1600 / base.width))
  const viewport = pageProxy.getViewport({ scale })
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!
  await pageProxy.render({ canvasContext: ctx, viewport }).promise
  return { w: viewport.width, h: viewport.height }
}
