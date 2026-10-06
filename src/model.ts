import Decimal from 'decimal.js'

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue'

export type Customer = {
  id: string
  name: string
  company: string
  email: string
  phone: string
  address: string
  createdAt: string
}

export type InvoiceLine = {
  id: string
  description: string
  quantity: string
  unitPriceMinor: number
}

export type InvoiceAmounts = {
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
}

export type IssuedSnapshot = {
  invoiceNumber: string
  issueDate: string
  invoiceDate: string
  dueDate: string
  currency: string
  taxRate: string
  customer: Pick<Customer, 'id' | 'name' | 'company' | 'email' | 'phone' | 'address'>
  lines: InvoiceLine[]
  amounts: InvoiceAmounts
}

export type Invoice = {
  id: string
  customerId: string
  invoiceDate: string
  dueDate: string
  currency: string
  taxRate: string
  lines: InvoiceLine[]
  status: InvoiceStatus
  createdAt: string
  snapshot?: IssuedSnapshot
}

export type WorkspaceData = {
  version: 1
  customers: Customer[]
  invoices: Invoice[]
}

export type InvoiceDraft = Pick<Invoice, 'customerId' | 'invoiceDate' | 'dueDate' | 'currency' | 'taxRate' | 'lines'>

export const CURRENCIES = ['JOD', 'USD', 'EUR', 'SAR', 'AED'] as const

export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

export function toMinorUnits(amount: string | number, currency: string): number {
  try {
    const digits = currencyDigits(currency)
    const scale = new Decimal(10).pow(digits)
    const value = new Decimal(String(amount || 0)).mul(scale).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    if (!value.isFinite() || value.abs().greaterThan(Number.MAX_SAFE_INTEGER)) return 0
    return value.toNumber()
  } catch {
    return 0
  }
}

export function formatMoney(minor: number, currency: string): string {
  const digits = currencyDigits(currency)
  const value = new Decimal(minor).div(new Decimal(10).pow(digits)).toNumber()
  try {
    return new Intl.NumberFormat('en-JO', { style: 'currency', currency }).format(value)
  } catch {
    return `${currency} ${value.toFixed(digits)}`
  }
}

export function calculateAmounts(lines: InvoiceLine[], taxRate: string): InvoiceAmounts {
  try {
    const subtotal = lines.reduce((sum, line) => {
      const quantity = new Decimal(line.quantity || 0)
      if (!quantity.isFinite() || quantity.isNegative()) return sum
      const lineMinor = quantity.mul(line.unitPriceMinor).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      return sum.plus(lineMinor)
    }, new Decimal(0))
    const rate = new Decimal(taxRate || 0)
    const tax = subtotal.mul(rate.isFinite() && rate.isPositive() ? rate : 0).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    const subtotalMinor = safeInteger(subtotal)
    const taxMinor = safeInteger(tax)
    return { subtotalMinor, taxMinor, totalMinor: safeInteger(subtotal.plus(tax).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)) }
  } catch {
    return { subtotalMinor: 0, taxMinor: 0, totalMinor: 0 }
  }
}

function safeInteger(value: Decimal): number {
  if (!value.isFinite() || value.abs().greaterThan(Number.MAX_SAFE_INTEGER)) return 0
  return value.toNumber()
}

export function formatDate(date: string): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-JO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

export function dateInputValue(offsetDays = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

export function invoiceNumberFor(invoices: Invoice[], now = new Date()): string {
  const year = now.getFullYear()
  const prefix = `UMN-${year}-`
  const max = invoices.reduce((current, invoice) => {
    const number = invoice.snapshot?.invoiceNumber
    const parsed = number?.startsWith(prefix) ? Number(number.slice(prefix.length)) : 0
    return Number.isFinite(parsed) ? Math.max(current, parsed) : current
  }, 0)
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

export function statusFor(invoice: Invoice, today = dateInputValue()): InvoiceStatus {
  if (invoice.status === 'issued' && invoice.dueDate < today) return 'overdue'
  return invoice.status
}

export function invoiceCustomer(invoice: Invoice, customers: Customer[]): Customer | IssuedSnapshot['customer'] | undefined {
  return invoice.snapshot?.customer ?? customers.find((customer) => customer.id === invoice.customerId)
}

export function invoiceLines(invoice: Invoice): InvoiceLine[] {
  return invoice.snapshot?.lines ?? invoice.lines
}

export function invoiceAmounts(invoice: Invoice): InvoiceAmounts {
  return invoice.snapshot?.amounts ?? calculateAmounts(invoice.lines, invoice.taxRate)
}

export function createSampleWorkspace(): WorkspaceData {
  const customers: Customer[] = [
    { id: 'c-aurora', name: 'Lina Haddad', company: 'Aurora Trading Co.', email: 'lina@auroratrading.jo', phone: '+962 6 555 0182', address: 'Abdali Boulevard, Amman, Jordan', createdAt: new Date().toISOString() },
    { id: 'c-northstar', name: 'Omar Nasser', company: 'Northstar Logistics', email: 'omar@northstar.jo', phone: '+962 6 555 0274', address: 'King Hussein Business Park, Amman, Jordan', createdAt: new Date().toISOString() },
    { id: 'c-canvas', name: 'Sara Khalil', company: 'Canvas Studio', email: 'sara@canvasstudio.me', phone: '+962 79 330 1842', address: 'Rainbow Street, Amman, Jordan', createdAt: new Date().toISOString() },
    { id: 'c-vertex', name: 'Zaid Mansour', company: 'Vertex Health Group', email: 'zaid@vertexhealth.jo', phone: '+962 6 555 0410', address: 'Shmeisani, Amman, Jordan', createdAt: new Date().toISOString() },
  ]
  const makeInvoice = (id: string, customerId: string, daysAgo: number, amount: string, status: InvoiceStatus, currency = 'JOD'): Invoice => {
    const invoiceDate = dateInputValue(-daysAgo)
    const dueDate = status === 'overdue' ? dateInputValue(-1) : dateInputValue(30 - daysAgo)
    const lines: InvoiceLine[] = [{ id: `${id}-l1`, description: 'Business SIP trunk · monthly plan', quantity: '1', unitPriceMinor: toMinorUnits(amount, currency) }]
    const invoice: Invoice = { id, customerId, invoiceDate, dueDate, currency, taxRate: '0', lines, status, createdAt: new Date(`${invoiceDate}T09:00:00`).toISOString() }
    if (status !== 'draft') {
      const customer = customers.find((item) => item.id === customerId)!
      const sampleNumber = Number(id.split('-').at(-1)) || 1
      const invoiceNumber = `UMN-${new Date(`${invoiceDate}T12:00:00`).getFullYear()}-${String(sampleNumber).padStart(4, '0')}`
      invoice.snapshot = {
        invoiceNumber,
        issueDate: invoiceDate,
        invoiceDate,
        dueDate,
        currency,
        taxRate: invoice.taxRate,
        customer: { id: customer.id, name: customer.name, company: customer.company, email: customer.email, phone: customer.phone, address: customer.address },
        lines: structuredClone(lines),
        amounts: calculateAmounts(lines, invoice.taxRate),
      }
    }
    return invoice
  }
  return {
    version: 1,
    customers,
    invoices: [
      makeInvoice('i-1048', 'c-aurora', 3, '1480', 'issued'),
      makeInvoice('i-1047', 'c-northstar', 9, '920', 'paid'),
      makeInvoice('i-1046', 'c-canvas', 18, '675', 'overdue'),
      makeInvoice('i-1045', 'c-vertex', 38, '2130', 'paid'),
      makeInvoice('i-1044', 'c-aurora', 62, '540', 'issued', 'USD'),
    ],
  }
}
