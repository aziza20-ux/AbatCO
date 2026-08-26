import type { Response } from 'express'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, HeadingLevel } from 'docx'
import { prisma } from '../prisma.js'
import type { AuthRequest } from '../middleware/auth.js'

function cell(text: string, bold = false) {
  return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold, size: 20 })] })], borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } }, margins: { top: 80, bottom: 80, left: 120, right: 120 } })
}

function row(label: string, value: string) {
  return new TableRow({ children: [cell(label, true), cell(value || '—')] })
}

export async function exportTransactionDocx(request: AuthRequest, response: Response) {
  const where = {
    OR: [{ id: String(request.params.id) }, { transactionId: String(request.params.id) }],
    ...(request.user!.role === 'AGENT' ? { recordingAgentId: request.user!.id } : {}),
  }

  const tx = await prisma.transaction.findFirst({
    where,
    include: {
      bicycle: true,
      seller: true,
      buyer: true,
      recordingAgent: { select: { id: true, name: true, email: true } },
      adminReviewedBy: { select: { id: true, name: true } },
    },
  })

  if (!tx) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } })

  const date = tx.transactionDate.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  const price = tx.price ? `${Number(tx.price).toFixed(2)}` : '—'
  const fee = tx.serviceFee ? `${Number(tx.serviceFee).toFixed(2)}` : '—'

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'AbatCO Bicycle Records', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: 'Transaction Receipt', heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: '' }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            row('Transaction ID', tx.transactionId),
            row('Type', tx.type),
            row('Date', date),
            row('Flag Status', tx.flagStatus),
            ...(tx.flagReason ? [row('Flag Reason', tx.flagReason)] : []),
            ...(tx.adminReviewNotes ? [row('Admin Review Notes', tx.adminReviewNotes)] : []),
            row('', ''),
            row('Frame Number', tx.bicycle.frameNumber),
            row('Brand', tx.bicycle.brand ?? '—'),
            row('Model', tx.bicycle.model ?? '—'),
            row('Color', tx.bicycle.color ?? '—'),
            row('', ''),
            row('Seller Name', tx.seller?.name ?? '—'),
            row('Seller National ID', tx.seller?.nationalId ?? '—'),
            row('Seller Phone', tx.seller?.phone ?? '—'),
            row('', ''),
            row('Buyer Name', tx.buyer?.name ?? '—'),
            row('Buyer National ID', tx.buyer?.nationalId ?? '—'),
            row('Buyer Phone', tx.buyer?.phone ?? '—'),
            row('', ''),
            row('Price', price),
            row('Service Fee', fee),
            row('Location', tx.location ?? '—'),
            row('Reason', tx.reason ?? '—'),
            row('Agent Note', tx.agentNote ?? '—'),
            row('Recording Agent', tx.recordingAgent.name),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: `Generated: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`, size: 16, italics: true })] }),
      ],
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  const filename = `transaction-${tx.transactionId}.docx`
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  return response.send(buffer)
}
