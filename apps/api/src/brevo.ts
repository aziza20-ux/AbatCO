export async function sendOtpEmail(toEmail: string, toName: string, otp: string) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME },
      to: [{ email: toEmail, name: toName }],
      subject: 'Your password reset code',
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="margin:0 0 8px">Password reset</h2>
          <p style="color:#555;margin:0 0 24px">Use the code below to reset your AbatCO password. It expires in 15 minutes.</p>
          <div style="font-size:36px;font-weight:800;letter-spacing:10px;text-align:center;padding:20px;background:#f4f4f4;border-radius:8px">${otp}</div>
          <p style="color:#999;font-size:12px;margin:24px 0 0">If you did not request this, ignore this email.</p>
        </div>
      `,
    }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(`Brevo error: ${JSON.stringify(body)}`)
  }
}
