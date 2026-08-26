import type { Response } from 'express'
import ExcelJS from 'exceljs'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma.js'
import type { AuthRequest } from '../middleware/auth.js'

const MAX_ROWS = 5000

export async function exportTransactionsXlsx(request: AuthRequest, response: Response) {
  const query = z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    agentId: z.string().cuid().optional(),
    type: z.enum(['SALE', 'TRANSFER']).optional(),
    flagStatus: z.enum(['NONE', 'FLAGGED', 'REVIEWED', 'CONFLICTED']).optional(),
    q: z.string().max(100).optional(),
  }).parse(request.query)

  const where: Prisma.TransactionWhereInput = {
    ...(request.user!.role === 'AGENT' ? { recordingAgentId: request.user!.id } : query.agentId ? { recordingAgentId: query.agentId } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.flagStatus ? { flagStatus: query.flagStatus } : {}),
    ...(query.from || query.to ? { transactionDate: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
    ...(query.q ? { OR: [{ transactionId: { contains: query.q, mode: 'insensitive' } }, { bicycle: { frameNumber: { contains: query.q, mode: 'insensitive' } } }] } : {}),
  }

  const rows = await prisma.transaction.findMany({
    where,
    take: MAX_ROWS,
    orderBy: { transactionDate: 'desc' },
    select: {
      transactionId: true,
      type: true,
      transactionDate: true,
      flagStatus: true,
      flagReason: true,
      price: true,
      serviceFee: true,
      reason: true,
      location: true,
      agentNote: true,
      adminReviewNotes: true,
      bicycle: { select: { frameNumber: true, brand: true, model: true, color: true } },
      seller: { select: { name: true, nationalId: true, phone: true } },
      buyer: { select: { name: true, nationalId: true, phone: true } },
      recordingAgent: { select: { name: true, email: true } },
    },
  })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'AbatCO'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Transactions')
  sheet.columns = [
    { header: 'Transaction ID', key: 'transactionId', width: 18 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Date', key: 'date', width: 22 },
    { header: 'Flag Status', key: 'flagStatus', width: 14 },
    { header: 'Flag Reason', key: 'flagReason', width: 30 },
    { header: 'Frame Number', key: 'frameNumber', width: 18 },
    { header: 'Brand', key: 'brand', width: 14 },
    { header: 'Model', key: 'model', width: 14 },
    { header: 'Color', key: 'color', width: 12 },
    { header: 'Seller Name', key: 'sellerName', width: 20 },
    { header: 'Seller National ID', key: 'sellerNationalId', width: 18 },
    { header: 'Seller Phone', key: 'sellerPhone', width: 16 },
    { header: 'Buyer Name', key: 'buyerName', width: 20 },
    { header: 'Buyer National ID', key: 'buyerNationalId', width: 18 },
    { header: 'Buyer Phone', key: 'buyerPhone', width: 16 },
    { header: 'Price', key: 'price', width: 12 },
    { header: 'Service Fee', key: 'serviceFee', width: 12 },
    { header: 'Location', key: 'location', width: 20 },
    { header: 'Reason', key: 'reason', width: 30 },
    { header: 'Agent Note', key: 'agentNote', width: 30 },
    { header: 'Admin Notes', key: 'adminNotes', width: 30 },
    { header: 'Recording Agent', key: 'agentName', width: 20 },
    { header: 'Agent Email', key: 'agentEmail', width: 24 },
  ]

  // Bold header row
  sheet.getRow(1).font = { bold: true }

  for (const r of rows) {
    sheet.addRow({
      transactionId: r.transactionId,
      type: r.type,
      date: r.transactionDate.toISOString().replace('T', ' ').slice(0, 19),
      flagStatus: r.flagStatus,
      flagReason: r.flagReason ?? '',
      frameNumber: r.bicycle.frameNumber,
      brand: r.bicycle.brand ?? '',
      model: r.bicycle.model ?? '',
      color: r.bicycle.color ?? '',
      sellerName: r.seller?.name ?? '',
      sellerNationalId: r.seller?.nationalId ?? '',
      sellerPhone: r.seller?.phone ?? '',
      buyerName: r.buyer?.name ?? '',
      buyerNationalId: r.buyer?.nationalId ?? '',
      buyerPhone: r.buyer?.phone ?? '',
      price: r.price ? Number(r.price) : '',
      serviceFee: r.serviceFee ? Number(r.serviceFee) : '',
      location: r.location ?? '',
      reason: r.reason ?? '',
      agentNote: r.agentNote ?? '',
      adminNotes: r.adminReviewNotes ?? '',
      agentName: r.recordingAgent.name,
      agentEmail: r.recordingAgent.email,
    })
  }

  const filename = `transactions-export-${new Date().toISOString().slice(0, 10)}.xlsx`
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  await workbook.xlsx.write(response)
  response.end()
}
