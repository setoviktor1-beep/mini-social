'use client'
import { useEffect, useState } from 'react'
import { Link2 } from 'lucide-react'
import { createClient } from '@/lib/backend-client'

export default function InviteButton() {
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setLoading(false)
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user.id)
        .single()
      setReferralCode(profile?.referral_code || null)
      setLoading(false)
    })
  }, [])

  const handleCopy = async () => {
    if (!referralCode) return
    const inviteLink = `${window.location.origin}/invite/${referralCode}`
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (loading || !referralCode) return null

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors font-medium text-sm"
    >
      <Link2 size={16} />
      {copied ? 'Nukopijuota!' : 'Pakviesti kaimyną'}
    </button>
  )
}
