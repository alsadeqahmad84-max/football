import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { calculateAmounts, formatDate, formatMoney, invoiceLines, type Invoice } from './model'

const ink = rgb(0.09, 0.12, 0.18)
const muted = rgb(0.43, 0.47, 0.54)
const pink = rgb(0.91, 0.12, 0.39)
const pale = rgb(0.97, 0.95, 0.96)
const rule = rgb(0.89, 0.90, 0.92)
const pageWidth = 595.28
const pageHeight = 841.89

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) line = candidate
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function drawLabel(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size = 8) {
  page.drawText(text.toUpperCase(), { x, y, size, font, color: muted })
}

function drawHeader(page: PDFPage, invoiceNumber: string, bold: PDFFont, regular: PDFFont, continued = false) {
  page.drawRectangle({ x: 0, y: pageHeight - 112, width: pageWidth, height: 112, color: ink })
  page.drawRectangle({ x: 42, y: pageHeight - 79, width: 38, height: 38, color: pink })
  page.drawText('u', { x: 53, y: pageHeight - 71, size: 27, font: bold, color: rgb(1, 1, 1) })
  page.drawText('umniah', { x: 92, y: pageHeight - 57, size: 17, font: bold, color: rgb(1, 1, 1) })
  page.drawText('VOICE SERVICES', { x: 92, y: pageHeight - 73, size: 7, font: regular, color: rgb(0.78, 0.80, 0.84) })
  page.drawText(continued ? 'INVOICE · CONTINUED' : 'INVOICE', { x: 405, y: pageHeight - 49, size: 9, font: bold, color: rgb(0.91, 0.92, 0.94) })
  page.drawText(invoiceNumber, { x: 405, y: pageHeight - 72, size: 12, font: bold, color: rgb(1, 1, 1) })
}

function drawTableHeader(page: PDFPage, y: number, regular: PDFFont) {
  page.drawRectangle({ x: 42, y: y - 18, width: pageWidth - 84, height: 28, color: pale })
  drawLabel(page, 'Description', 52, y - 1, regular)
  drawLabel(page, 'Qty', 345, y - 1, regular)
  drawLabel(page, 'Unit price', 394, y - 1, regular)
  drawLabel(page, 'Amount', 496, y - 1, regular)
  return y - 35
}

export async function downloadInvoicePdf(invoice: Invoice) {
  if (!invoice.snapshot) throw new Error('Issue this invoice before downloading a PDF.')
  const snapshot = invoice.snapshot
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Invoice ${snapshot.invoiceNumber}`)
  pdf.setAuthor('Umniah Voice Services')
  pdf.setSubject(`VOIP revenue invoice for ${snapshot.customer.company || snapshot.customer.name}`)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pages: PDFPage[] = []
  let page = pdf.addPage([pageWidth, pageHeight])
  pages.push(page)
  drawHeader(page, snapshot.invoiceNumber, bold, regular)
  let y = pageHeight - 147
  drawLabel(page, 'Billed to', 42, y, regular)
  page.drawText(snapshot.customer.company || snapshot.customer.name || 'Customer', { x: 42, y: y - 25, size: 14, font: bold, color: ink })
  let customerY = y - 42
  const customerLines = [snapshot.customer.name, snapshot.customer.email, snapshot.customer.phone, snapshot.customer.address].filter(Boolean)
  for (const text of customerLines) {
    page.drawText(text, { x: 42, y: customerY, size: 9, font: regular, color: muted, maxWidth: 270 })
    customerY -= 14
  }
  drawLabel(page, 'Invoice date', 392, y, regular)
  page.drawText(formatDate(snapshot.invoiceDate), { x: 392, y: y - 22, size: 10, font: bold, color: ink })
  drawLabel(page, 'Due date', 492, y, regular)
  page.drawText(formatDate(snapshot.dueDate), { x: 492, y: y - 22, size: 10, font: bold, color: ink })
  y = Math.min(customerY - 20, y - 64)
  page.drawLine({ start: { x: 42, y }, end: { x: pageWidth - 42, y }, thickness: 1, color: rule })
  y = drawTableHeader(page, y - 12, regular)

  for (const line of invoiceLines(invoice)) {
    const descriptionLines = wrapText(line.description || 'VOIP service', regular, 9, 270)
    const rowHeight = Math.max(30, descriptionLines.length * 13 + 14)
    if (y - rowHeight < 128) {
      page = pdf.addPage([pageWidth, pageHeight])
      pages.push(page)
      drawHeader(page, snapshot.invoiceNumber, bold, regular, true)
      y = drawTableHeader(page, pageHeight - 145, regular)
    }
    descriptionLines.forEach((text, index) => page.drawText(text, { x: 52, y: y - 2 - index * 13, size: 9, font: regular, color: ink }))
    page.drawText(line.quantity, { x: 345, y: y - 2, size: 9, font: regular, color: ink })
    page.drawText(formatMoney(line.unitPriceMinor, snapshot.currency), { x: 394, y: y - 2, size: 8.5, font: regular, color: ink })
    page.drawText(formatMoney(calculateAmounts([line], '0').subtotalMinor, snapshot.currency), { x: 496, y: y - 2, size: 8.5, font: bold, color: ink })
    y -= rowHeight
    page.drawLine({ start: { x: 52, y: y + 3 }, end: { x: pageWidth - 52, y: y + 3 }, thickness: 0.6, color: rule })
  }

  if (y < 202) {
    page = pdf.addPage([pageWidth, pageHeight])
    pages.push(page)
    drawHeader(page, snapshot.invoiceNumber, bold, regular, true)
    y = pageHeight - 150
  }
  const subtotal = snapshot.amounts.subtotalMinor
  const tax = snapshot.amounts.taxMinor
  const total = snapshot.amounts.totalMinor
  const totalsX = 355
  page.drawText('Subtotal', { x: totalsX, y, size: 9, font: regular, color: muted })
  page.drawText(formatMoney(subtotal, snapshot.currency), { x: 465, y, size: 9, font: regular, color: ink })
  page.drawText(`Tax (${snapshot.taxRate}%)`, { x: totalsX, y: y - 22, size: 9, font: regular, color: muted })
  page.drawText(formatMoney(tax, snapshot.currency), { x: 465, y: y - 22, size: 9, font: regular, color: ink })
  page.drawRectangle({ x: totalsX - 12, y: y - 62, width: 210, height: 29, color: pale })
  page.drawText('TOTAL DUE', { x: totalsX, y: y - 52, size: 8, font: bold, color: ink })
  page.drawText(formatMoney(total, snapshot.currency), { x: 465, y: y - 53, size: 11, font: bold, color: pink })
  page.drawText('Thank you for your business.', { x: 42, y: 81, size: 10, font: bold, color: ink })
  page.drawText('Umniah Voice Services · Amman, Jordan · Generated digitally', { x: 42, y: 64, size: 8, font: regular, color: muted })
  pages.forEach((current, index) => {
    current.drawLine({ start: { x: 42, y: 42 }, end: { x: pageWidth - 42, y: 42 }, thickness: 0.7, color: rule })
    current.drawText('UMNIAH VOICE · DIGITAL COPY', { x: 42, y: 27, size: 7, font: regular, color: muted })
    current.drawText(`${index + 1} / ${pages.length}`, { x: pageWidth - 72, y: 27, size: 7, font: regular, color: muted })
  })
  const bytes = await pdf.save()
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const blob = new Blob([buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${snapshot.invoiceNumber}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}
