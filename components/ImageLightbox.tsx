'use client'
import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface ImageLightboxProps {
  images: string[]
  initialIndex: number
  onClose: () => void
}

export default function ImageLightbox({ images, initialIndex, onClose }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setCurrentIndex(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setCurrentIndex(i => Math.min(images.length - 1, i + 1))
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [images.length, onClose])

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-10"
      >
        <X size={28} />
      </button>

      {images.length > 1 && currentIndex > 0 && (
        <button
          onClick={e => { e.stopPropagation(); setCurrentIndex(i => i - 1) }}
          className="absolute left-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-10"
        >
          <ChevronLeft size={32} />
        </button>
      )}

      {images.length > 1 && currentIndex < images.length - 1 && (
        <button
          onClick={e => { e.stopPropagation(); setCurrentIndex(i => i + 1) }}
          className="absolute right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-10"
        >
          <ChevronRight size={32} />
        </button>
      )}

      <img
        src={images[currentIndex]}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={e => e.stopPropagation()}
        alt=""
      />

      {images.length > 1 && (
        <div className="absolute bottom-6 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setCurrentIndex(i) }}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
