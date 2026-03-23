'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { X, ZoomIn, ZoomOut, Check, Move } from 'lucide-react'

interface Props {
  src: string
  onSave: (blob: Blob) => void
  onCancel: () => void
}

const SIZE = 280 // canvas/preview size

export default function AvatarCropModal({ src, onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 }) // offset of image center from canvas center
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imgLoaded, setImgLoaded] = useState(false)

  // Load image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      // Initial scale: fit the shorter side to fill the circle
      const minSide = Math.min(img.naturalWidth, img.naturalHeight)
      setScale(SIZE / minSide)
      setPos({ x: 0, y: 0 })
      setImgLoaded(true)
    }
    img.src = src
  }, [src])

  // Draw frame
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, SIZE, SIZE)

    // Clip circle
    ctx.save()
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
    ctx.clip()

    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    const dx = SIZE / 2 - w / 2 + pos.x
    const dy = SIZE / 2 - h / 2 + pos.y

    ctx.drawImage(img, dx, dy, w, h)
    ctx.restore()

    // Circle border overlay
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [scale, pos])

  useEffect(() => {
    if (imgLoaded) draw()
  }, [imgLoaded, draw])

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true)
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y })
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    setPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }
  const onMouseUp = () => setDragging(false)

  // Touch drag
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    setDragging(true)
    setDragStart({ x: t.clientX - pos.x, y: t.clientY - pos.y })
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return
    const t = e.touches[0]
    setPos({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y })
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(blob => {
      if (blob) onSave(blob)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white text-lg">Koreguoti nuotrauką</h3>
          <button onClick={onCancel} className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
          <Move size={13} />
          Vilkite norėdami centruoti · Slankiklis — mastelis
        </p>

        {/* Canvas preview */}
        <div className="flex justify-center mb-5">
          <div className="relative rounded-full overflow-hidden" style={{ width: SIZE, height: SIZE, cursor: dragging ? 'grabbing' : 'grab' }}>
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={() => setDragging(false)}
              style={{ display: 'block', touchAction: 'none' }}
            />
          </div>
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 mb-6">
          <ZoomOut size={16} className="text-gray-500 shrink-0" />
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.01}
            value={scale}
            onChange={e => setScale(Number(e.target.value))}
            className="flex-1 accent-blue-500"
          />
          <ZoomIn size={16} className="text-gray-500 shrink-0" />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl border border-gray-700 text-gray-400 hover:text-white font-semibold transition-colors text-sm"
          >
            Atšaukti
          </button>
          <button
            onClick={handleSave}
            disabled={!imgLoaded}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-2xl font-bold transition-colors text-sm"
          >
            <Check size={16} />
            Išsaugoti
          </button>
        </div>
      </div>
    </div>
  )
}
