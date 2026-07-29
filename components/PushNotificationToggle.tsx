'use client'
import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { createClient } from '@/lib/backend-client'

export default function PushNotificationToggle() {
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'PushManager' in window && 'serviceWorker' in navigator) {
      setSupported(true)
      if (Notification.permission === 'granted') {
        setEnabled(true)
      }
    }
  }, [])

  const handleToggle = async () => {
    if (!supported || loading) return
    setLoading(true)

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setEnabled(false)
        setLoading(false)
        return
      }

      const registration = await navigator.serviceWorker.ready
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
        setLoading(false)
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey,
      })

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, userId: user.id }),
      })

      if (res.ok) {
        setEnabled(true)
      } else {
        console.error('Failed to save push subscription')
      }
    } catch (err) {
      console.error('Push subscription error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!supported) return null

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={enabled ? 'Push pranešimai įjungti' : 'Įjungti push pranešimus'}
      className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
        enabled
          ? 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30'
          : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      {enabled ? <Bell size={20} /> : <BellOff size={20} />}
    </button>
  )
}
