import type { AuthRequest } from '../middleware/auth.js'
import type { Response } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { audit } from '../audit.js'

const personInput = z.object({ name: z.string().trim().min(1).max(160), nationalId: z.string().trim().min(1).max(80), phone: z.string().trim().max(40).optional(), cell: z.string().trim().max(80).optional(), address: z.string().trim().max(300).optional(), sector: z.string().trim().max(120).optional(), village: z.string().trim().max(120).optional() })

export async function listPeople(request: AuthRequest, response: Response) { const query = z.object({ q: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(request.query); const where = query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' as const } }, { nationalId: { contains: query.q } }, { phone: { contains: query.q } }] } : {}; const people = await prisma.person.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { name: 'asc' }, select: { id: true, name: true, nationalId: true, phone: true, address: true, sector: true, village: true } }); return response.json({ data: people }) }
export async function getPerson(request: AuthRequest, response: Response) { const person = await prisma.person.findUnique({ where: { id: String(request.params.id) }, include: { currentBicycles: { select: { id: true, frameNumber: true, brand: true, model: true, status: true } }, registrations: { select: { id: true, bicycleId: true, createdAt: true } } } }); if (!person) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Person not found' } }); return response.json({ data: person }) }
export async function createPerson(request: AuthRequest, response: Response) { const input = personInput.parse(request.body); const person = await prisma.person.create({ data: input }); await audit(request.user!.id, 'PERSON_CREATED', 'Person', person.id); return response.status(201).json({ data: person }) }
