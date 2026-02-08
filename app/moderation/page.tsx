'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Shield, EyeOff, CheckCircle, Trash2 } from 'lucide-react'

export default function ModerationPage() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        reporter:reporter_id(username)
      `)
      .order('created_at', { ascending: false })

    if (!error) setReports(data || [])
    setLoading(false)
  }

  const handleAction = async (reportId: string, action: 'hide' | 'resolve' | 'delete', targetId: string, targetType: string) => {
    if (action === 'hide') {
      const table = targetType === 'post' ? 'posts' : 'comments'
      await supabase.from(table).update({ status: 'hidden' }).eq('id', targetId)
    } else if (action === 'delete') {
      const table = targetType === 'post' ? 'posts' : 'comments'
      await supabase.from(table).update({ status: 'deleted' }).eq('id', targetId)
    }

    await supabase.from('reports').update({ status: 'reviewed' }).eq('id', reportId)
    fetchReports()
  }

  if (loading) return <div className="p-10 text-center">Loading reports...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="text-red-600" size={32} />
        <h1 className="text-3xl font-black">Moderation Center</h1>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100 text-sm font-bold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Target</th>
              <th className="px-6 py-4">Reason</th>
              <th className="px-6 py-4">Reporter</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-bold text-blue-600 uppercase text-xs">{report.target_type}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{report.reason}</td>
                <td className="px-6 py-4 text-sm text-gray-500">@{report.reporter?.username}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${report.status === 'open' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    {report.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {report.status === 'open' && (
                      <>
                        <button 
                          onClick={() => handleAction(report.id, 'hide', report.target_id, report.target_type)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 title='Hide Content'"
                        >
                          <EyeOff size={18} />
                        </button>
                        <button 
                          onClick={() => handleAction(report.id, 'resolve', report.target_id, report.target_type)}
                          className="p-2 hover:bg-green-50 rounded-lg text-green-600 title='Resolve Report'"
                        >
                          <CheckCircle size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center text-gray-400">No reports found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
