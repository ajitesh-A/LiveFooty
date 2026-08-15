import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data')
const DEV_LOG = path.join(DATA_DIR, 'dev-mail.log')

export async function sendVerificationCode(email, code) {
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM || 'LiveFooty <onboarding@resend.dev>',
          to: [email],
          subject: 'Your LiveFooty verification code',
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
<h2 style="margin:0 0 12px;color:#111">LiveFooty verification</h2>
<p style="margin:0 0 16px;color:#333">Your verification code is:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:0 0 16px;color:#16a34a">${code}</p>
<p style="margin:0;color:#666;font-size:13px">This code expires in 10 minutes.</p>
</div>`,
        }),
      })
      if (res.ok) return
    } catch (e) {
      // fall through to dev log
    }
  }
  console.log(`[mailer:dev] verification code for ${email}: ${code}`)
  mkdirSync(DATA_DIR, { recursive: true })
  appendFileSync(DEV_LOG, `${new Date().toISOString()} ${email} ${code}\n`)
}