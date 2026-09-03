import type { Response } from 'express'
import { v2 as cloudinary } from 'cloudinary'
import type { AuthRequest } from '../middleware/auth.js'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function uploadPhoto(request: AuthRequest, response: Response) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return response.status(503).json({ error: { code: 'UPLOAD_UNAVAILABLE', message: 'Photo upload is not configured' } })
  }

  const file = (request as unknown as { file?: Express.Multer.File }).file
  if (!file) return response.status(400).json({ error: { code: 'NO_FILE', message: 'No file uploaded' } })
  if (!ALLOWED_MIME.has(file.mimetype)) return response.status(415).json({ error: { code: 'INVALID_FILE_TYPE', message: 'Only JPEG, PNG, and WebP images are accepted' } })
  if (file.size > MAX_BYTES) return response.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'File must be 5 MB or smaller' } })

  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: request.query.folder === 'national-ids' ? 'abatco/national-ids' : 'abatco/bicycles', resource_type: 'image', allowed_formats: ['jpg', 'jpeg', 'png', 'webp'], transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
      (error, result) => { if (error || !result) return reject(error ?? new Error('Upload failed')); resolve(result) },
    )
    stream.end(file.buffer)
  })

  return response.status(201).json({ data: { url: result.secure_url, publicId: result.public_id } })
}
