import { useEffect, useMemo, useState } from 'react'
import {
  CURRENCIES,
  calculateAmounts,
  dateInputValue,
  formatDate,
  formatMoney,
  invoiceAmounts,
  invoiceCustomer,
  invoiceLines,
  invoiceNumberFor,
  statusFor,
  toMinorUnits,
  type Customer,
  type Invoice,
  type InvoiceDraft,
  type InvoiceLine,
  type InvoiceStatus,
  type WorkspaceData,
} from './model'
import { loadWorkspace, saveWorkspace } from './storage'
import FinanceAssistant from './FinanceAssistant'

type Page = 'overview' | 'invoices' | 'customers' | 'research'
type Period = 'month' | '30days' | '12months'
type IconName = 'grid' | 'file' | 'users' | 'settings' | 'search' | 'bell' | 'plus' | 'arrow' | 'download' | 'close' | 'wallet' | 'clock' | 'check' | 'trend' | 'calendar' | 'chevron' | 'edit' | 'phone' | 'spark' | 'filter' | 'receipt' | 'mail' | 'building' | 'trash' | 'more' | 'arrow-left'

const navigation: { page: Page; label: string; icon: IconName }[] = [
  { page: 'overview', label: 'Overview', icon: 'grid' },
  { page: 'invoices', label: 'Invoices', icon: 'file' },
  { page: 'customers', label: 'Customers', icon: 'users' },
  { page: 'research', label: 'Web research', icon: 'search' },
]

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, string> = {
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8',
    users: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 8v6 M23 11h-6',
    settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 2.94-.09-.02a1.7 1.7 0 0 0-1.72.55l-.05.07h-3.4l-.05-.07a1.7 1.7 0 0 0-1.72-.55l-.09.02-1.7-2.94.06-.06A1.7 1.7 0 0 0 9.7 15l-.09-.03v-3.4L9.7 11.5a1.7 1.7 0 0 0-.34-1.88L9.3 9.56l1.7-2.94.09.02a1.7 1.7 0 0 0 1.72-.55l.05-.07h3.4l.05.07a1.7 1.7 0 0 0 1.72.55l.09-.02 1.7 2.94-.06.06A1.7 1.7 0 0 0 19.4 11.5l.09.03v3.4z',
    search: 'm20 20-4.2-4.2 M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
    plus: 'M12 5v14 M5 12h14',
    arrow: 'M7 17 17 7 M7 7h10v10',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
    close: 'M18 6 6 18 M6 6l12 12',
    wallet: 'M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6 M20 12h-4a2 2 0 0 0 0 4h4z',
    clock: 'M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
    check: 'm5 12 4 4L19 6',
    trend: 'M3 17 9 11l4 4 8-8 M15 7h6v6',
    calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z',
    chevron: 'm9 18 6-6-6-6',
    edit: 'M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4z',
    phone: 'M22 16.9v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72l.4 2.8a2 2 0 0 1-.57 1.7L7.1 10.05a16 16 0 0 0 6 6l1.83-1.83a2 2 0 0 1 1.7-.57l2.8.4a2 2 0 0 1 1.72 1.85z',
    spark: 'm12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z M19 14l1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1z',
    filter: 'M4 7h16 M7 12h10 M10 17h4',
    receipt: 'M4 2v20l4-2 4 2 4-2 4 2V2l-4 2-4-2-4 2z M9 9h6 M9 13h6',
    mail: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M22 7l-10 7L2 7',
    building: 'M3 21h18 M5 21V5l7-3 7 3v16 M9 9h1 M14 9h1 M9 13h1 M14 13h1 M10 21v-4h4v4',
    trash: 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v5 M14 11v5',
    more: 'M5 12h.01 M12 12h.01 M19 12h.01',
    'arrow-left': 'm15 18-6-6 6-6 M20 12H9',
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function startDraft(): InvoiceDraft {
  return {
    customerId: '',
    invoiceDate: dateInputValue(),
    dueDate: dateInputValue(30),
    currency: 'JOD',
    taxRate: '0',
    lines: [{ id: uid('line'), description: '', quantity: '1', unitPriceMinor: 0 }],
  }
}

function isValidDecimal(value: string, positive = false) {
  const number = Number(value)
  return value.trim() !== '' && Number.isFinite(number) && (positive ? number > 0 : number >= 0)
}

function displayName(customer: Customer | ReturnType<typeof invoiceCustomer>) {
  if (!customer) return 'Unassigned customer'
  return customer.company || customer.name || 'Unassigned customer'
}

function initials(customer: Customer) {
  return customer.company.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || customer.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const labels: Record<InvoiceStatus, string> = { draft: 'Draft', issued: 'Issued', paid: 'Paid', overdue: 'Overdue' }
  return <span className={`status-badge status-${status}`}><span className="status-dot" />{labels[status]}</span>
}

function App() {
  const [boot] = useState(() => loadWorkspace())
  const [workspace, setWorkspace] = useState<WorkspaceData>(boot.data)
  const [storageNotice, setStorageNotice] = useState(boot.error)
  const [page, setPage] = useState<Page>('overview')
  const [period, setPeriod] = useState<Period>('30days')
  const [search, setSearch] = useState('')
  const [invoiceEditor, setInvoiceEditor] = useState(false)
  const [editingInvoiceId, setEditingInvoiceId] = useState<string>()
  const [draft, setDraft] = useState<InvoiceDraft>(startDraft)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [customerEditor, setCustomerEditor] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState<string>()
  const [customerForm, setCustomerForm] = useState({ name: '', company: '', email: '', phone: '', address: '' })
  const [customerError, setCustomerError] = useState('')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>()
  const [toast, setToast] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState('all')
  const [researchQuery, setResearchQuery] = useState('')
  const [researchLoading, setResearchLoading] = useState(false)
  const [researchError, setResearchError] = useState('')
  const [researchResult, setResearchResult] = useState<{ answer?: string; results: { title: string; url: string; content: string; score: number; published_date?: string }[] }>()

  useEffect(() => {
    if (boot.error?.startsWith('Saved workspace data')) return
    if (!saveWorkspace(workspace)) setStorageNotice('Browser storage is full or unavailable. Changes may not persist after closing this tab.')
    else if (storageNotice?.startsWith('Browser storage is full')) setStorageNotice(undefined)
  }, [workspace, boot.error, storageNotice])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    if (!dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    focusable()[0]?.focus()
    function manageDialogKeys(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (invoiceEditor) setInvoiceEditor(false)
        else if (customerEditor) setCustomerEditor(false)
        else setSelectedInvoiceId(undefined)
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault()
        items.at(-1)?.focus()
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault()
        items[0].focus()
      }
    }
    document.addEventListener('keydown', manageDialogKeys)
    return () => {
      document.removeEventListener('keydown', manageDialogKeys)
      previousFocus?.focus()
    }
  }, [invoiceEditor, customerEditor, selectedInvoiceId])

  const selectedInvoice = workspace.invoices.find((invoice) => invoice.id === selectedInvoiceId)
  const selectedCustomer = selectedInvoice ? invoiceCustomer(selectedInvoice, workspace.customers) : undefined
  const filteredInvoices = useMemo(() => workspace.invoices.filter((invoice) => {
    const customer = invoiceCustomer(invoice, workspace.customers)
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [invoice.snapshot?.invoiceNumber, displayName(customer), customer?.email, invoice.status].some((value) => String(value ?? '').toLowerCase().includes(query))
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [workspace.invoices, workspace.customers, search])
  const filteredCustomers = useMemo(() => workspace.customers.filter((customer) => [customer.name, customer.company, customer.email].some((value) => value.toLowerCase().includes(search.trim().toLowerCase()))), [workspace.customers, search])

  const matchingInvoices = useMemo(() => workspace.invoices.filter((invoice) => {
    if (!invoice.snapshot) return false
    const issuedAt = new Date(`${invoice.snapshot.issueDate}T12:00:00`)
    const now = new Date()
    const start = new Date(now)
    if (period === 'month') start.setDate(1)
    if (period === '30days') start.setDate(now.getDate() - 29)
    if (period === '12months') start.setMonth(now.getMonth() - 11, 1)
    return issuedAt >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) && issuedAt <= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  }), [workspace.invoices, period])

  const totalsByCurrency = useMemo(() => {
    const values = new Map<string, { issued: number; collected: number; outstanding: number }>()
    matchingInvoices.forEach((invoice) => {
      const currency = invoice.snapshot!.currency
      const current = values.get(currency) ?? { issued: 0, collected: 0, outstanding: 0 }
      const total = invoice.snapshot!.amounts.totalMinor
      current.issued += total
      if (statusFor(invoice) === 'paid') current.collected += total
      else current.outstanding += total
      values.set(currency, current)
    })
    return [...values.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [matchingInvoices])

  const chartCurrency = currencyFilter === 'all' ? totalsByCurrency[0]?.[0] ?? 'JOD' : currencyFilter
  const chartMonths = useMemo(() => {
    const months: { key: string; label: string; total: number }[] = []
    const now = new Date()
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const total = workspace.invoices.reduce((sum, invoice) => {
        if (!invoice.snapshot || invoice.snapshot.currency !== chartCurrency || statusFor(invoice) === 'draft') return sum
        return invoice.snapshot.issueDate.startsWith(key) ? sum + invoice.snapshot.amounts.totalMinor : sum
      }, 0)
      months.push({ key, label: new Intl.DateTimeFormat('en', { month: 'short' }).format(date), total })
    }
    return months
  }, [workspace.invoices, chartCurrency])
  const maxChartValue = Math.max(...chartMonths.map((month) => month.total), 1)

  function updateWorkspace(next: WorkspaceData) {
    setWorkspace(next)
  }

  function openNewInvoice() {
    setEditingInvoiceId(undefined)
    setDraft(startDraft())
    setFormErrors([])
    setInvoiceEditor(true)
  }

  function openDraftEditor(invoice: Invoice) {
    setEditingInvoiceId(invoice.id)
    setDraft({ customerId: invoice.customerId, invoiceDate: invoice.invoiceDate, dueDate: invoice.dueDate, currency: invoice.currency, taxRate: invoice.taxRate, lines: structuredClone(invoice.lines) })
    setFormErrors([])
    setSelectedInvoiceId(undefined)
    setInvoiceEditor(true)
  }

  function validateDraft(value: InvoiceDraft) {
    const errors: string[] = []
    if (!workspace.customers.some((customer) => customer.id === value.customerId)) errors.push('Choose a customer for this invoice.')
    if (!value.invoiceDate || !value.dueDate) errors.push('Add an invoice date and due date.')
    if (value.dueDate && value.invoiceDate && value.dueDate < value.invoiceDate) errors.push('The due date must be on or after the invoice date.')
    if (!value.lines.length || value.lines.some((line) => !line.description.trim() || !isValidDecimal(line.quantity, true) || !Number.isSafeInteger(line.unitPriceMinor) || line.unitPriceMinor <= 0)) errors.push('Add at least one service line with a description, positive quantity, and unit price.')
    if (!isValidDecimal(value.taxRate) || Number(value.taxRate) > 100) errors.push('Enter a tax rate from 0 to 100.')
    return errors
  }

  function saveDraft() {
    const existing = workspace.invoices.find((invoice) => invoice.id === editingInvoiceId)
    const invoice: Invoice = {
      id: existing?.id ?? uid('invoice'),
      customerId: draft.customerId,
      invoiceDate: draft.invoiceDate,
      dueDate: draft.dueDate,
      currency: draft.currency,
      taxRate: draft.taxRate,
      lines: structuredClone(draft.lines),
      status: 'draft',
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    updateWorkspace({ ...workspace, invoices: existing ? workspace.invoices.map((item) => item.id === invoice.id ? invoice : item) : [invoice, ...workspace.invoices] })
    setInvoiceEditor(false)
    setToast('Draft saved')
  }

  async function issueInvoice() {
    const errors = validateDraft(draft)
    setFormErrors(errors)
    if (errors.length) return
    const customer = workspace.customers.find((item) => item.id === draft.customerId)!
    const existing = workspace.invoices.find((invoice) => invoice.id === editingInvoiceId)
    const invoice: Invoice = {
      id: existing?.id ?? uid('invoice'),
      customerId: customer.id,
      invoiceDate: draft.invoiceDate,
      dueDate: draft.dueDate,
      currency: draft.currency,
      taxRate: draft.taxRate,
      lines: structuredClone(draft.lines),
      status: 'issued',
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      snapshot: {
        invoiceNumber: invoiceNumberFor(workspace.invoices),
        issueDate: dateInputValue(),
        invoiceDate: draft.invoiceDate,
        dueDate: draft.dueDate,
        currency: draft.currency,
        taxRate: draft.taxRate,
        customer: { id: customer.id, name: customer.name, company: customer.company, email: customer.email, phone: customer.phone, address: customer.address },
        lines: structuredClone(draft.lines),
        amounts: calculateAmounts(draft.lines, draft.taxRate),
      },
    }
    updateWorkspace({ ...workspace, invoices: existing ? workspace.invoices.map((item) => item.id === invoice.id ? invoice : item) : [invoice, ...workspace.invoices] })
    setInvoiceEditor(false)
    setPage('invoices')
    setSelectedInvoiceId(invoice.id)
    const issuedNumber = invoice.snapshot?.invoiceNumber ?? 'Invoice'
    try {
      const { downloadInvoicePdf } = await import('./pdf')
      await downloadInvoicePdf(invoice)
      setToast(`${issuedNumber} issued · tax-inclusive PDF downloaded`)
    } catch {
      setToast(`${issuedNumber} issued · PDF is available in invoice details`)
    }
  }

  function openCustomerForm(customer?: Customer) {
    setEditingCustomerId(customer?.id)
    setCustomerForm(customer ? { name: customer.name, company: customer.company, email: customer.email, phone: customer.phone, address: customer.address } : { name: '', company: '', email: '', phone: '', address: '' })
    setCustomerError('')
    setCustomerEditor(true)
  }

  function saveCustomer() {
    if (!customerForm.name.trim() || !customerForm.email.trim()) {
      setCustomerError('Add a contact name and email address to continue.')
      return
    }
    const existing = workspace.customers.find((customer) => customer.id === editingCustomerId)
    const customer: Customer = { ...customerForm, id: existing?.id ?? uid('customer'), createdAt: existing?.createdAt ?? new Date().toISOString() }
    updateWorkspace({ ...workspace, customers: existing ? workspace.customers.map((item) => item.id === customer.id ? customer : item) : [customer, ...workspace.customers] })
    setCustomerEditor(false)
    setToast(existing ? 'Customer updated' : 'Customer added')
  }

  function updatePayment(invoice: Invoice) {
    const nextStatus: InvoiceStatus = statusFor(invoice) === 'paid' ? 'issued' : 'paid'
    updateWorkspace({ ...workspace, invoices: workspace.invoices.map((item) => item.id === invoice.id ? { ...item, status: nextStatus } : item) })
    setToast(nextStatus === 'paid' ? 'Payment recorded' : 'Invoice marked unpaid')
  }

  function updateInvoiceLine(id: string, update: Partial<InvoiceLine>) {
    setDraft((current) => ({ ...current, lines: current.lines.map((line) => line.id === id ? { ...line, ...update } : line) }))
  }

  function addLine() {
    setDraft((current) => ({ ...current, lines: [...current.lines, { id: uid('line'), description: '', quantity: '1', unitPriceMinor: 0 }] }))
  }

  function removeLine(id: string) {
    setDraft((current) => ({ ...current, lines: current.lines.filter((line) => line.id !== id) }))
  }

  const pageTitle = page === 'overview' ? 'Overview' : page === 'invoices' ? 'Invoices' : page === 'customers' ? 'Customers' : 'Web research'
  const periods: { id: Period; label: string }[] = [{ id: 'month', label: 'This month' }, { id: '30days', label: 'Last 30 days' }, { id: '12months', label: '12 months' }]

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-symbol">u</div>
          <div><div className="brand-name">umniah<span>voice</span></div><div className="brand-caption">INVOICE DESK</div></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => <button key={item.page} aria-current={page === item.page ? 'page' : undefined} className={`nav-item ${page === item.page ? 'active' : ''}`} onClick={() => { setPage(item.page); setSearch('') }}><Icon name={item.icon} /><span>{item.label}</span>{item.page === 'invoices' && <span className="nav-count">{workspace.invoices.length}</span>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><Icon name="spark" size={16} /></div><div><strong>Billing, made simple.</strong><p>Everything for your voice business, in one place.</p></div></div>
          <div className="profile-row"><div className="profile-avatar">AA</div><div className="profile-copy"><strong>Ahmad Alsadeq</strong><span>Finance team</span></div><button className="icon-button sidebar-more" aria-label="More profile options"><Icon name="more" /></button></div>
        </div>
      </aside>

      <main className="main-panel" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="breadcrumb"><span>Voice finance</span><Icon name="chevron" size={14} /><strong>{pageTitle}</strong></div>
          <div className="topbar-actions"><label className="global-search"><Icon name="search" size={17} /><input aria-label="Search invoices and customers" placeholder="Search anything..." value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label><button className="icon-button notification-button" aria-label="Notifications"><Icon name="bell" size={19} /><i /></button><div className="topbar-divider" /><div className="company-switcher"><div className="company-avatar"><Icon name="phone" size={16} /></div><div><strong>Voice services</strong><span>Umniah Mobile</span></div><Icon name="chevron" size={14} /></div></div>
        </header>

        <div className="page-content">
          {storageNotice && <div className="storage-banner"><span>{storageNotice}</span><button className="text-button" onClick={() => setStorageNotice('')}>Dismiss</button></div>}
          {page === 'overview' && <OverviewPage workspace={workspace} matchingInvoices={matchingInvoices} totalsByCurrency={totalsByCurrency} chartMonths={chartMonths} maxChartValue={maxChartValue} chartCurrency={chartCurrency} currencyFilter={currencyFilter} setCurrencyFilter={setCurrencyFilter} periods={periods} period={period} setPeriod={setPeriod} onNewInvoice={openNewInvoice} onOpenInvoice={(invoice) => setSelectedInvoiceId(invoice.id)} onGoToInvoices={() => setPage('invoices')} />}
          {page === 'invoices' && <InvoicesPage invoices={filteredInvoices} customers={workspace.customers} search={search} onSearch={setSearch} onNewInvoice={openNewInvoice} onOpenInvoice={(invoice) => setSelectedInvoiceId(invoice.id)} />}
          {page === 'customers' && <CustomersPage customers={filteredCustomers} invoices={workspace.invoices} onAdd={() => openCustomerForm()} onEdit={openCustomerForm} />}
          {page === 'research' && <ResearchPage query={researchQuery} setQuery={setResearchQuery} loading={researchLoading} error={researchError} result={researchResult} onSearch={async () => {
            const query = researchQuery.trim()
            if (query.length < 3) { setResearchError('Enter at least 3 characters to search.'); return }
            setResearchLoading(true); setResearchError(''); setResearchResult(undefined)
            try {
              const response = await fetch('/api/tavily/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
              const data = await response.json()
              if (!response.ok) throw new Error(data.error || 'Search failed. Please try again.')
              setResearchResult(data)
            } catch (error) { setResearchError(error instanceof Error ? error.message : 'Search failed. Please try again.') }
            finally { setResearchLoading(false) }
          }} />}
        </div>
        <footer className="footer-note"><span>© {new Date().getFullYear()} Umniah Voice</span><span><span className="local-dot" /> Saved on this device</span></footer>
      </main>

      <FinanceAssistant workspace={workspace} onNavigate={setPage} onNewInvoice={openNewInvoice} />

      {invoiceEditor && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setInvoiceEditor(false) }}><section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-editor-title"><header className="modal-header"><div><div className="eyebrow">VOICE REVENUE</div><h2 id="invoice-editor-title">{editingInvoiceId ? 'Edit draft invoice' : 'Create invoice'}</h2><p>Build a clear, customer-ready invoice in a few steps.</p></div><button className="icon-button" aria-label="Close invoice form" onClick={() => setInvoiceEditor(false)}><Icon name="close" /></button></header>
        <div className="editor-grid"><div className="editor-fields">
          <div className="section-heading"><span className="step-number">01</span><div><strong>Customer & dates</strong><span>Who is this invoice for?</span></div></div>
          <div className="form-grid"><label className="field full-field"><span>Customer <b>*</b></span><select value={draft.customerId} onChange={(event) => setDraft({ ...draft, customerId: event.target.value })}><option value="">Choose a customer</option>{workspace.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company || customer.name} · {customer.name}</option>)}</select></label><label className="field"><span>Invoice date <b>*</b></span><input type="date" value={draft.invoiceDate} onChange={(event) => setDraft({ ...draft, invoiceDate: event.target.value })} /></label><label className="field"><span>Due date <b>*</b></span><input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></label></div>
          <div className="section-heading line-heading"><span className="step-number">02</span><div><strong>Services & charges</strong><span>Add plans, numbers, and usage.</span></div></div>
          <div className="line-list"><div className="line-label-row"><span>DESCRIPTION</span><span>QTY</span><span>UNIT PRICE</span><span /></div>{draft.lines.map((line, index) => <div className="line-edit-row" key={line.id}><div className="line-description-wrap"><input value={line.description} onChange={(event) => updateInvoiceLine(line.id, { description: event.target.value })} placeholder={index === 0 ? 'e.g. Business SIP trunk · monthly plan' : 'Service description'} /><span className="line-type-icon"><Icon name="phone" size={14} /></span></div><input className="qty-input" type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => updateInvoiceLine(line.id, { quantity: event.target.value })} aria-label={`Quantity for line ${index + 1}`} /><div className="money-input"><span>{draft.currency}</span><input type="number" min="0" step="0.001" value={line.unitPriceMinor / (10 ** ((new Intl.NumberFormat('en', { style: 'currency', currency: draft.currency }).resolvedOptions().maximumFractionDigits ?? 2))) || ''} onChange={(event) => updateInvoiceLine(line.id, { unitPriceMinor: toMinorUnits(event.target.value, draft.currency) })} aria-label={`Unit price for line ${index + 1}`} /></div><button className="icon-button remove-line" aria-label="Remove line item" onClick={() => removeLine(line.id)} disabled={draft.lines.length === 1}><Icon name="trash" size={15} /></button></div>)}</div>
          <button className="add-line-button" onClick={addLine}><Icon name="plus" size={15} /> Add line item</button>
          <div className="form-grid tax-grid"><label className="field"><span>Currency</span><select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })}>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select></label><label className="field"><span>Tax rate</span><div className="tax-input"><input type="number" min="0" max="100" step="0.1" value={draft.taxRate} onChange={(event) => setDraft({ ...draft, taxRate: event.target.value })} /><span>%</span></div></label></div>
          {formErrors.length > 0 && <div className="form-errors" role="alert">{formErrors.map((error) => <p key={error}>{error}</p>)}</div>}
        </div>
        <aside className="editor-summary"><div className="summary-label">INVOICE SUMMARY</div><h3>{draft.customerId ? displayName(workspace.customers.find((customer) => customer.id === draft.customerId)) : 'New invoice'}</h3><p className="summary-date"><Icon name="calendar" size={14} /> {draft.invoiceDate ? formatDate(draft.invoiceDate) : 'Choose invoice date'}</p><div className="summary-lines">{draft.lines.map((line) => <div className="summary-line" key={line.id}><span>{line.description || 'Service line'} <small>× {line.quantity || '0'}</small></span><strong>{formatMoney(calculateAmounts([line], '0').subtotalMinor, draft.currency)}</strong></div>)}</div><div className="summary-total-row"><span>Subtotal</span><strong>{formatMoney(calculateAmounts(draft.lines, '0').subtotalMinor, draft.currency)}</strong></div><div className="summary-total-row"><span>Tax · {draft.taxRate || 0}%</span><strong>{formatMoney(calculateAmounts(draft.lines, draft.taxRate).taxMinor, draft.currency)}</strong></div><div className="summary-grand-total"><span>Total due</span><strong>{formatMoney(calculateAmounts(draft.lines, draft.taxRate).totalMinor, draft.currency)}</strong></div><div className="summary-note"><Icon name="spark" size={15} /><span>Issuing downloads a branded PDF with the tax breakdown and total.</span></div></aside></div>
        <footer className="modal-footer"><button className="button button-quiet" onClick={() => setInvoiceEditor(false)}>Cancel</button><div><button className="button button-secondary" onClick={saveDraft}>Save as draft</button><button className="button button-primary" onClick={issueInvoice}>Review & issue <Icon name="arrow" size={16} /></button></div></footer>
      </section></div>}

      {customerEditor && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCustomerEditor(false) }}><section className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="customer-modal-title"><header className="modal-header"><div><div className="eyebrow">CUSTOMER DIRECTORY</div><h2 id="customer-modal-title">{editingCustomerId ? 'Edit customer' : 'Add customer'}</h2><p>Keep billing contact details ready for the next invoice.</p></div><button className="icon-button" aria-label="Close customer form" onClick={() => setCustomerEditor(false)}><Icon name="close" /></button></header><div className="customer-form-grid"><label className="field"><span>Contact name <b>*</b></span><input value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} placeholder="Full name" /></label><label className="field"><span>Company</span><input value={customerForm.company} onChange={(event) => setCustomerForm({ ...customerForm, company: event.target.value })} placeholder="Company name" /></label><label className="field"><span>Email address <b>*</b></span><input type="email" value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} placeholder="name@company.com" /></label><label className="field"><span>Phone</span><input value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} placeholder="+962 ..." /></label><label className="field full-field"><span>Billing address</span><textarea rows={2} value={customerForm.address} onChange={(event) => setCustomerForm({ ...customerForm, address: event.target.value })} placeholder="Street, city, country" /></label></div>{customerError && <div className="form-errors" role="alert"><p>{customerError}</p></div>}<footer className="modal-footer"><button className="button button-quiet" onClick={() => setCustomerEditor(false)}>Cancel</button><button className="button button-primary" onClick={saveCustomer}>{editingCustomerId ? 'Save changes' : 'Add customer'} <Icon name="check" size={16} /></button></footer></section></div>}

      {selectedInvoice && <InvoiceDetails invoice={selectedInvoice} customer={selectedCustomer} onClose={() => setSelectedInvoiceId(undefined)} onDownload={async () => { try { const { downloadInvoicePdf } = await import('./pdf'); await downloadInvoicePdf(selectedInvoice); setToast('PDF downloaded') } catch { setToast('Could not create the PDF. Try again.') } }} onEdit={() => openDraftEditor(selectedInvoice)} onPayment={() => updatePayment(selectedInvoice)} />}
      {toast && <div className="toast" role="status"><span className="toast-check"><Icon name="check" size={14} /></span>{toast}</div>}
    </div>
  )
}

function OverviewPage(props: {
  workspace: WorkspaceData
  matchingInvoices: Invoice[]
  totalsByCurrency: [string, { issued: number; collected: number; outstanding: number }][]
  chartMonths: { key: string; label: string; total: number }[]
  maxChartValue: number
  chartCurrency: string
  currencyFilter: string
  setCurrencyFilter: (value: string) => void
  periods: { id: Period; label: string }[]
  period: Period
  setPeriod: (period: Period) => void
  onNewInvoice: () => void
  onOpenInvoice: (invoice: Invoice) => void
  onGoToInvoices: () => void
}) {
  const { workspace, matchingInvoices, totalsByCurrency, chartMonths, maxChartValue, chartCurrency, currencyFilter, setCurrencyFilter, periods, period, setPeriod, onNewInvoice, onOpenInvoice, onGoToInvoices } = props
  const [showDemoNote, setShowDemoNote] = useState(true)
  const recent = [...workspace.invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  const issuedCount = matchingInvoices.filter((invoice) => invoice.status !== 'draft').length
  return <>
    <div className="page-heading-row"><div><div className="eyebrow">YOUR FINANCE AT A GLANCE</div><h1>Good morning, Ahmad</h1><p>Here’s what’s happening with your VOIP revenue.</p></div><button className="button button-primary new-invoice-button" onClick={onNewInvoice}><Icon name="plus" size={17} /> New invoice</button></div>
    {showDemoNote && <div className="demo-note"><span className="demo-note-icon"><Icon name="spark" size={16} /></span><span><strong>Welcome to your invoice desk.</strong> Sample records are shown to help you explore. Your changes stay in this browser.</span><button aria-label="Dismiss sample data notice" onClick={() => setShowDemoNote(false)}>×</button></div>}
    <div className="period-row"><div><strong>Revenue snapshot</strong><span>{issuedCount} issued invoice{issuedCount === 1 ? '' : 's'} in this period</span></div><div className="period-control" role="group" aria-label="Revenue reporting period">{periods.map((item) => <button key={item.id} className={period === item.id ? 'selected' : ''} onClick={() => setPeriod(item.id)}>{item.label}</button>)}</div></div>
    <div className="metric-grid">
      <MetricCard icon="wallet" label="Total issued" caption="Invoice value in selected period" values={totalsByCurrency.map(([currency, totals]) => [currency, totals.issued])} tone="pink" />
      <MetricCard icon="check" label="Collected" caption="Payments marked as received" values={totalsByCurrency.map(([currency, totals]) => [currency, totals.collected])} tone="green" />
      <MetricCard icon="clock" label="Outstanding" caption="Issued invoices awaiting payment" values={totalsByCurrency.map(([currency, totals]) => [currency, totals.outstanding])} tone="amber" />
      <div className="metric-card metric-card-count"><div className="metric-top"><span className="metric-icon tone-blue"><Icon name="receipt" size={17} /></span><span className="metric-trend"><Icon name="trend" size={14} /> Live</span></div><div className="metric-label">Invoices issued</div><div className="metric-count">{issuedCount}<span> invoice{issuedCount === 1 ? '' : 's'}</span></div><div className="metric-caption">Across all selected currencies</div></div>
    </div>
    <div className="overview-grid"><section className="panel revenue-panel"><div className="panel-header"><div><h2>Revenue over time</h2><p>Issued invoice value by month</p></div><label className="chart-currency"><span>Currency</span><select value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value)}><option value="all">{chartCurrency} · auto</option>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select></label></div><div className="chart-legend"><span className="legend-dot" /> {chartCurrency} revenue</div><div className="bar-chart" role="img" aria-label={`${chartCurrency} revenue over the past six months: ${chartMonths.map((month) => `${month.label} ${formatMoney(month.total, chartCurrency)}`).join(', ')}`}>{chartMonths.map((month) => <div className="chart-column" key={month.key}><div className="chart-value">{month.total ? formatMoney(month.total, chartCurrency) : '—'}</div><div className="bar-track"><div className={`bar-fill ${month.total ? 'has-value' : ''}`} style={{ height: `${Math.max(month.total ? (month.total / maxChartValue) * 100 : 0, month.total ? 7 : 2)}%` }} /></div><span className="chart-month">{month.label}</span></div>)}</div><div className="chart-footnote"><span><Icon name="calendar" size={14} /> {period === 'month' ? 'Current calendar month' : period === '30days' ? 'Rolling 30-day view' : 'Last 12 months'}</span><span className="small-status"><span /> Values based on issued invoices</span></div></section>
      <section className="panel quick-actions-panel"><div className="panel-header"><div><h2>Quick actions</h2><p>Keep your billing moving</p></div><span className="panel-more"><Icon name="more" /></span></div><button className="quick-action" onClick={onNewInvoice}><span className="quick-icon pink"><Icon name="plus" /></span><span><strong>Create an invoice</strong><small>Prepare a new VOIP invoice</small></span><Icon name="chevron" size={16} /></button><button className="quick-action" onClick={onGoToInvoices}><span className="quick-icon purple"><Icon name="file" /></span><span><strong>Review invoices</strong><small>Track status and payment</small></span><Icon name="chevron" size={16} /></button><div className="quick-tip"><span className="tip-icon"><Icon name="spark" size={15} /></span><p><strong>Good to know</strong><br />You can download a polished PDF directly from any issued invoice.</p></div></section></div>
    <section className="panel recent-panel"><div className="panel-header"><div><h2>Recent invoices</h2><p>Your latest customer billing activity</p></div><button className="link-button" onClick={onGoToInvoices}>View all invoices <Icon name="arrow" size={14} /></button></div><InvoiceTable invoices={recent} customers={workspace.customers} onOpen={onOpenInvoice} compact /></section>
    <div className="currency-footnote">{totalsByCurrency.length === 0 ? 'No issued invoices in this period yet.' : `Revenue is shown separately by currency: ${totalsByCurrency.map(([currency]) => currency).join(' · ')}.`}</div>
  </>
}

function MetricCard({ icon, label, caption, values, tone }: { icon: IconName; label: string; caption: string; values: [string, number][]; tone: string }) {
  return <div className="metric-card"><div className="metric-top"><span className={`metric-icon tone-${tone}`}><Icon name={icon} size={17} /></span><span className="metric-trend"><Icon name="trend" size={14} /> In period</span></div><div className="metric-label">{label}</div><div className="currency-values">{values.length ? values.map(([currency, amount]) => <div key={currency}><strong>{formatMoney(amount, currency)}</strong>{values.length > 1 && <span>{currency}</span>}</div>) : <strong className="empty-amount">—</strong>}</div><div className="metric-caption">{caption}</div></div>
}

function InvoicesPage({ invoices, customers, search, onSearch, onNewInvoice, onOpenInvoice }: { invoices: Invoice[]; customers: Customer[]; search: string; onSearch: (value: string) => void; onNewInvoice: () => void; onOpenInvoice: (invoice: Invoice) => void }) {
  const issuedCount = invoices.filter((invoice) => invoice.status !== 'draft').length
  return <><div className="page-heading-row"><div><div className="eyebrow">BILLING OPERATIONS</div><h1>Invoices</h1><p>Manage drafts, issue customer invoices, and track payments.</p></div><button className="button button-primary" onClick={onNewInvoice}><Icon name="plus" size={17} /> New invoice</button></div><div className="listing-stats"><div><span>All invoices</span><strong>{invoices.length}</strong></div><div><span>Issued</span><strong>{issuedCount}</strong></div><div><span>Drafts</span><strong>{invoices.filter((invoice) => invoice.status === 'draft').length}</strong></div><div><span>Awaiting payment</span><strong>{invoices.filter((invoice) => ['issued', 'overdue'].includes(statusFor(invoice))).length}</strong></div></div><section className="panel listing-panel"><div className="listing-toolbar"><div><h2>All invoices</h2><p>{invoices.length} record{invoices.length === 1 ? '' : 's'} in this workspace</p></div><div className="listing-controls"><label className="table-search"><Icon name="search" size={16} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search invoices" aria-label="Search invoices" /></label><button className="filter-button"><Icon name="filter" size={15} /> Filter</button></div></div><InvoiceTable invoices={invoices} customers={customers} onOpen={onOpenInvoice} /></section></>
}

function InvoiceTable({ invoices, customers, onOpen, compact = false }: { invoices: Invoice[]; customers: Customer[]; onOpen: (invoice: Invoice) => void; compact?: boolean }) {
  if (!invoices.length) return <div className="empty-state"><span className="empty-state-icon"><Icon name="receipt" size={22} /></span><strong>No invoices found</strong><p>Try a different search or create your first VOIP invoice.</p></div>
  return <div className={`table-scroll ${compact ? 'compact-table' : ''}`}><table className="invoice-table"><thead><tr><th>INVOICE</th><th>CUSTOMER</th><th>ISSUE DATE</th><th>DUE DATE</th><th>AMOUNT</th><th>STATUS</th><th /></tr></thead><tbody>{invoices.map((invoice) => {
    const customer = invoiceCustomer(invoice, customers)
    const number = invoice.snapshot?.invoiceNumber ?? 'Draft invoice'
    const date = invoice.snapshot?.issueDate ?? invoice.invoiceDate
    const amount = invoiceAmounts(invoice)
    return <tr key={invoice.id} className="table-row-clickable" onClick={() => onOpen(invoice)}><td><span className="invoice-number">{number}</span><span className="invoice-subline">{invoice.lines.length} service line{invoice.lines.length === 1 ? '' : 's'}</span></td><td><div className="customer-cell"><span className={`customer-avatar avatar-${Math.abs((customer?.name ?? '').length % 5)}`}>{customer?.name?.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase() || '—'}</span><div><strong>{displayName(customer)}</strong><span>{customer?.name ?? 'Customer required'}</span></div></div></td><td>{formatDate(date)}</td><td>{formatDate(invoice.snapshot?.dueDate ?? invoice.dueDate)}</td><td><span className="table-amount">{formatMoney(amount.totalMinor, invoice.snapshot?.currency ?? invoice.currency)}</span></td><td><StatusBadge status={statusFor(invoice)} /></td><td><button className="row-open" aria-label={`Open ${number}`} onClick={(event) => { event.stopPropagation(); onOpen(invoice) }}><Icon name="chevron" size={17} /></button></td></tr>
  })}</tbody></table></div>
}

function CustomersPage({ customers, invoices, onAdd, onEdit }: { customers: Customer[]; invoices: Invoice[]; onAdd: () => void; onEdit: (customer?: Customer) => void }) {
  return <><div className="page-heading-row"><div><div className="eyebrow">YOUR CLIENT DIRECTORY</div><h1>Customers</h1><p>Keep billing contacts organized and ready for your next invoice.</p></div><button className="button button-primary" onClick={onAdd}><Icon name="plus" size={17} /> Add customer</button></div><div className="listing-stats customer-stats"><div><span>Total customers</span><strong>{customers.length}</strong></div><div><span>With invoices</span><strong>{customers.filter((customer) => invoices.some((invoice) => invoice.customerId === customer.id)).length}</strong></div><div><span>Invoices this month</span><strong>{invoices.filter((invoice) => invoice.snapshot?.issueDate.startsWith(dateInputValue().slice(0, 7))).length}</strong></div></div><div className="customer-grid">{customers.map((customer, index) => <article className="customer-card" key={customer.id}><div className="customer-card-head"><div className={`customer-avatar large avatar-${index % 5}`}>{initials(customer)}</div><button className="icon-button" aria-label={`Edit ${customer.company || customer.name}`} onClick={() => onEdit(customer)}><Icon name="edit" size={16} /></button></div><h2>{customer.company || customer.name}</h2><p className="customer-contact-name">{customer.name}</p><div className="customer-detail"><Icon name="mail" size={15} /> <a href={`mailto:${customer.email}`}>{customer.email}</a></div><div className="customer-detail"><Icon name="phone" size={15} /> <span>{customer.phone || 'No phone added'}</span></div><div className="customer-card-foot"><span><Icon name="receipt" size={14} /> {invoices.filter((invoice) => invoice.customerId === customer.id).length} invoices</span><span className="customer-location">{customer.address.split(',').at(-2)?.trim() || 'Amman'}</span></div></article>)}{customers.length === 0 && <div className="empty-state customer-empty"><span className="empty-state-icon"><Icon name="users" size={22} /></span><strong>Your directory is ready</strong><p>Add a customer to create and issue an invoice.</p><button className="button button-primary" onClick={onAdd}><Icon name="plus" size={16} /> Add first customer</button></div>}</div></>
}

function ResearchPage({ query, setQuery, loading, error, result, onSearch }: { query: string; setQuery: (query: string) => void; loading: boolean; error: string; result?: { answer?: string; results: { title: string; url: string; content: string; score: number; published_date?: string }[] }; onSearch: () => void }) {
  return <>
    <div className="page-heading-row"><div><div className="eyebrow">TAVILY · PUBLIC WEB</div><h1>Web research</h1><p>Search current public sources for context alongside your voice revenue workflow.</p></div><span className="research-live"><i /> Tavily ready</span></div>
    <section className="research-hero panel"><div className="research-hero-mark"><Icon name="search" size={22} /></div><div><h2>What would you like to research?</h2><p>Search web pages and news. Results include source links for review.</p></div>
      <form className="research-form" onSubmit={(event) => { event.preventDefault(); onSearch() }}><label className="sr-only" htmlFor="research-query">Search public web sources</label><input id="research-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search public web sources…" maxLength={200} /><button className="button button-primary" type="submit" disabled={loading}><Icon name="search" size={16} /> {loading ? 'Searching…' : 'Search web'}</button></form>
      <div className="research-scope"><Icon name="spark" size={15} /><span>Public web research only. This does not access invoices, customer records, PBX, or call-detail traffic.</span></div>
    </section>
    {error && <div className="research-error" role="alert">{error}</div>}
    {loading && <section className="panel research-loading" aria-live="polite"><span className="research-spinner" /><div><strong>Searching public sources</strong><p>Tavily is gathering relevant pages.</p></div></section>}
    {result && <section className="research-results" aria-live="polite">{result.answer && <article className="panel research-answer"><div className="eyebrow">SEARCH SUMMARY</div><p>{result.answer}</p></article>}<div className="research-results-heading"><div><h2>Sources</h2><p>{result.results.length} result{result.results.length === 1 ? '' : 's'} · Review each source before relying on it</p></div><span>Powered by Tavily</span></div><div className="research-result-list">{result.results.map((item) => <article className="panel research-card" key={item.url}><div className="research-card-top"><span className="research-source-icon"><Icon name="file" size={16} /></span><span className="research-score">Relevance {Math.round(item.score * 100)}%</span></div><h3><a href={item.url} target="_blank" rel="noreferrer">{item.title || item.url}<Icon name="arrow" size={14} /></a></h3><p>{item.content}</p><div className="research-card-foot"><span>{item.published_date || new URL(item.url).hostname}</span><a href={item.url} target="_blank" rel="noreferrer">Open source <Icon name="arrow" size={13} /></a></div></article>)}</div>{result.results.length === 0 && <div className="empty-state"><strong>No sources found</strong><p>Try a broader search query.</p></div>}</section>}
  </>
}

function InvoiceDetails({ invoice, customer, onClose, onDownload, onEdit, onPayment }: { invoice: Invoice; customer: ReturnType<typeof invoiceCustomer>; onClose: () => void; onDownload: () => void; onEdit: () => void; onPayment: () => void }) {
  const lines = invoiceLines(invoice)
  const amounts = invoiceAmounts(invoice)
  const currency = invoice.snapshot?.currency ?? invoice.currency
  const dueDate = invoice.snapshot?.dueDate ?? invoice.dueDate
  const invoiceDate = invoice.snapshot?.invoiceDate ?? invoice.invoiceDate
  const number = invoice.snapshot?.invoiceNumber ?? 'Draft invoice'
  const canDownload = Boolean(invoice.snapshot)
  return <div className="overlay detail-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><header className="detail-toolbar"><div><div className="eyebrow">INVOICE REVIEW</div><h2 id="detail-title">{number}</h2></div><div className="detail-toolbar-actions">{invoice.status === 'draft' ? <button className="button button-secondary" onClick={onEdit}><Icon name="edit" size={15} /> Edit draft</button> : <button className="button button-secondary" onClick={onPayment}><Icon name={statusFor(invoice) === 'paid' ? 'clock' : 'check'} size={15} /> {statusFor(invoice) === 'paid' ? 'Mark unpaid' : 'Record payment'}</button>}<button className="icon-button" aria-label="Close invoice details" onClick={onClose}><Icon name="close" /></button></div></header><div className="detail-body"><article className="invoice-paper"><div className="paper-top"><div className="paper-brand"><span className="paper-brand-icon">u</span><div><strong>umniah<span>voice</span></strong><small>VOICE SERVICES</small></div></div><div className="paper-invoice-label"><span>INVOICE</span><strong>{number}</strong><StatusBadge status={statusFor(invoice)} /></div></div><div className="paper-rule" /><div className="paper-meta"><div><span>BILLED TO</span><strong>{customer?.company || customer?.name || 'Unassigned customer'}</strong><p>{customer?.name}</p><p>{customer?.email}</p><p>{customer?.phone}</p><p>{customer?.address}</p></div><div className="paper-dates"><div><span>INVOICE DATE</span><strong>{formatDate(invoiceDate)}</strong></div><div><span>DUE DATE</span><strong>{formatDate(dueDate)}</strong></div></div></div><div className="paper-table"><div className="paper-table-head"><span>DESCRIPTION</span><span>QTY</span><span>UNIT PRICE</span><span>AMOUNT</span></div>{lines.map((line) => <div className="paper-table-row" key={line.id}><span>{line.description || 'Service line'}</span><span>{line.quantity}</span><span>{formatMoney(line.unitPriceMinor, currency)}</span><strong>{formatMoney(calculateAmounts([line], '0').subtotalMinor, currency)}</strong></div>)}</div><div className="paper-bottom"><div className="paper-note"><span>Thank you for your business.</span><small>Umniah Voice Services · Amman, Jordan</small></div><div className="paper-totals"><div><span>Subtotal</span><strong>{formatMoney(amounts.subtotalMinor, currency)}</strong></div><div><span>Tax ({invoice.snapshot?.taxRate ?? invoice.taxRate}%)</span><strong>{formatMoney(amounts.taxMinor, currency)}</strong></div><div className="paper-total"><span>Total due</span><strong>{formatMoney(amounts.totalMinor, currency)}</strong></div></div></div><div className="paper-footer"><span>Generated digitally · No print required</span><span>{number}</span></div></article><aside className="detail-side"><div className="detail-side-card"><span className="side-label">PAYMENT STATUS</span><StatusBadge status={statusFor(invoice)} /><p>{statusFor(invoice) === 'paid' ? 'Payment has been recorded.' : statusFor(invoice) === 'overdue' ? 'This invoice is past its due date.' : invoice.status === 'draft' ? 'This invoice has not been issued yet.' : 'Awaiting customer payment.'}</p></div><div className="detail-side-card"><span className="side-label">CUSTOMER</span><strong>{customer?.company || customer?.name || 'Unassigned'}</strong><span className="side-contact">{customer?.email ?? 'No email address'}</span></div><div className="detail-side-card"><span className="side-label">TOTAL AMOUNT</span><strong className="detail-total">{formatMoney(amounts.totalMinor, currency)}</strong><span className="side-contact">{currency} · Tax {invoice.snapshot?.taxRate ?? invoice.taxRate}%</span></div><div className="detail-disclaimer">Prototype document. Confirm accounting and statutory invoice requirements before official use.</div></aside></div><footer className="detail-footer"><button className="button button-quiet" onClick={onClose}>Close</button>{canDownload && <button className="button button-primary" onClick={onDownload}><Icon name="download" size={16} /> Download PDF</button>}</footer></section></div>
}

export default App
