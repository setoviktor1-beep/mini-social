import nodemailer from 'nodemailer'

type EmailMessage = {
  to: string
  subject: string
  text: string
  html?: string
}

function createTransport() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD

  if (!host || !user || !pass) {
    throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASSWORD are required')
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  })
}
export async function sendEmail(message: EmailMessage) {
  const from = process.env.EMAIL_FROM
  if (!from) {
    throw new Error('EMAIL_FROM is required')
  }

  await createTransport().sendMail({
    from,
    ...message,
  })
}
