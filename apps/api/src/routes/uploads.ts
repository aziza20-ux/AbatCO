import { Router } from 'express'
import multer from 'multer'
import { asyncRoute } from '../errors.js'
import { requireAuth } from '../middleware/auth.js'
import { uploadPhoto } from '../controllers/uploadController.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

export const uploadsRouter = Router()
uploadsRouter.use(requireAuth)
uploadsRouter.post('/photo', upload.single('photo'), asyncRoute(uploadPhoto))
