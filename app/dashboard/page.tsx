// MB2: /dashboard redirects to /pro (Verslo Darbalaukis)
import { redirect } from 'next/navigation'

export default function DashboardPage() {
  redirect('/pro')
}
