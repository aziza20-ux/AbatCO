import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST!,
  port: Number(process.env.EMAIL_PORT),
  secure: Number(process.env.EMAIL_PORT) === 465,
  auth: {
    user: process.env.EMAIL_USER!,
    pass: process.env.EMAIL_PASS!,
  },
})

export async function sendOtpEmail(toEmail: string, toName: string, otp: string) {
  await transporter.sendMail({
    from: `"${process.env.EMAIL_USER}" <${process.env.EMAIL_USER}>`,
    to: `"${toName}" <${toEmail}>`,
    subject: 'Your password reset code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px">Password reset</h2>
        <p style="color:#555;margin:0 0 24px">Use the code below to reset your AbatCO password. It expires in 15 minutes.</p>
        <div style="font-size:36px;font-weight:800;letter-spacing:10px;text-align:center;padding:20px;background:#f4f4f4;border-radius:8px">${otp}</div>
        <p style="color:#999;font-size:12px;margin:24px 0 0">If you did not request this, ignore this email.</p>
      </div>
    `,
  })
}
