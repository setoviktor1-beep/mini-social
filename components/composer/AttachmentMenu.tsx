'use client'

import React, { useState, useRef, useEffect, useId } from 'react'
import { Plus, Image as ImageIcon, Film, Video, X, Check, Link as LinkIcon } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

interface AttachmentMenuProps {
  imageInputId: string
  videoInputId: string
  imagesCount: number
  maxImages: number
  hasVideo: boolean
  youtubeUrl: string
  onYoutubeChange: (url: string) => void
  disabled?: boolean
}

export default function AttachmentMenu({
  imageInputId,
  videoInputId,
  imagesCount,
  maxImages,
  hasVideo,
  youtubeUrl,
  onYoutubeChange,
  disabled = false,
}: AttachmentMenuProps) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [showYoutubeInput, setShowYoutubeInput] = useState(false)
  const [tempYoutubeUrl, setTempYoutubeUrl] = useState(youtubeUrl)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  const canAddImages = !hasVideo && imagesCount < maxImages && !disabled
  const canAddVideo = imagesCount === 0 && !hasVideo && !disabled

  // Sync internal temp URL when parent prop changes
  useEffect(() => {
    setTempYoutubeUrl(youtubeUrl)
  }, [youtubeUrl])

  // Close on click outside or Escape
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setIsOpen(false)
        setShowYoutubeInput(false)
        buttonRef.current?.focus()
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setShowYoutubeInput(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  function handleAddYoutube() {
    onYoutubeChange(tempYoutubeUrl.trim())
    setShowYoutubeInput(false)
    setIsOpen(false)
  }

  function handleRemoveYoutube() {
    setTempYoutubeUrl('')
    onYoutubeChange('')
    setShowYoutubeInput(false)
  }

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        data-testid="attachment-menu"
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev)
            setShowYoutubeInput(false)
          }
        }}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={t('composer.attachMedia', 'Prisegti mediją')}
        title={t('composer.attachMedia', 'Prisegti mediją')}
        className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
          isOpen
            ? 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 shadow-sm'
            : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <Plus size={18} className={`transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`} />
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          className="absolute left-0 top-full z-30 mt-2 w-64 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/95 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500">
            {t('composer.attachMedia', 'Prisegti mediją')}
          </div>

          {!showYoutubeInput ? (
            <div className="flex flex-col gap-0.5">
              {/* Photo option */}
              <label
                htmlFor={canAddImages ? imageInputId : undefined}
                onClick={() => {
                  if (canAddImages) setIsOpen(false)
                }}
                className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  canAddImages
                    ? 'cursor-pointer text-slate-700 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-200 dark:hover:bg-blue-900/20 dark:hover:text-blue-400'
                    : 'cursor-not-allowed text-slate-300 dark:text-gray-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100/80 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                    <ImageIcon size={16} />
                  </span>
                  <span>{t('composer.addImage', 'Nuotraukos')}</span>
                </div>
                <span className="text-xs text-slate-400 dark:text-gray-500">
                  {imagesCount > 0 ? `${imagesCount}/${maxImages}` : `iki ${maxImages}`}
                </span>
              </label>

              {/* Video option */}
              <label
                htmlFor={canAddVideo ? videoInputId : undefined}
                onClick={() => {
                  if (canAddVideo) setIsOpen(false)
                }}
                className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  canAddVideo
                    ? 'cursor-pointer text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 dark:text-gray-200 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400'
                    : 'cursor-not-allowed text-slate-300 dark:text-gray-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                    <Film size={16} />
                  </span>
                  <span>{t('composer.addVideo', 'Vaizdo įrašas')}</span>
                </div>
                <span className="text-xs text-slate-400 dark:text-gray-500">iki 50MB</span>
              </label>

              {/* YouTube option */}
              <button
                type="button"
                onClick={() => setShowYoutubeInput(true)}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-200 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                    <Video size={16} />
                  </span>
                  <span>{t('composer.youtubeUrl', 'YouTube nuoroda')}</span>
                </div>
                {youtubeUrl && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 text-xs">
                    ✓
                  </span>
                )}
              </button>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-gray-300">
                <span className="flex items-center gap-1.5">
                  <Video size={14} className="text-red-500" />
                  YouTube nuoroda
                </span>
                <button
                  type="button"
                  onClick={() => setShowYoutubeInput(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200"
                  aria-label="Atgal"
                >
                  <X size={14} />
                </button>
              </div>
              <input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={tempYoutubeUrl}
                onChange={(e) => setTempYoutubeUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddYoutube()
                  }
                }}
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-red-400 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-red-500"
              />
              <div className="flex gap-2 justify-end pt-1">
                {youtubeUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveYoutube}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    Išvalyti
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddYoutube}
                  className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 shadow-sm"
                >
                  Išsaugoti
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
