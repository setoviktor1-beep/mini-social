export async function sendPushNotification(userId: string, title: string, body: string, url: string) {
  try {
    await fetch('/api/push/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title, body, url }),
    })
  } catch {}
}
