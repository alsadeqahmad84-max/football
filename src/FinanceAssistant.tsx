import { useEffect, useRef, useState } from 'react'
import { formatDate, formatMoney, invoiceAmounts, invoiceCustomer, statusFor, type WorkspaceData } from './model'

type Message = { role: 'assistant' | 'user'; content: string }
type RecognitionResult = { transcript: string }
type RecognitionEvent = { results: ArrayLike<ArrayLike<RecognitionResult>> }
type Recognition = { lang: string; interimResults: boolean; onresult: ((event: RecognitionEvent) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }
type RecognitionConstructor = new () => Recognition

function answerFinance(question: string, workspace: WorkspaceData) {
  const q = question.toLowerCase()
  const invoices = workspace.invoices
  const issued = invoices.filter((invoice) => invoice.snapshot)
  const customerTerm = workspace.customers.find((customer) => [customer.name, customer.company].some((name) => q.includes(name.toLowerCase())))
  const invoiceTerm = q.match(/umn-\d{4}-\d{4}/i)?.[0]
  const exactInvoice = invoiceTerm ? issued.find((invoice) => invoice.snapshot?.invoiceNumber.toLowerCase() === invoiceTerm.toLowerCase()) : undefined
  const customerInvoices = customerTerm ? issued.filter((invoice) => invoiceCustomer(invoice, workspace.customers)?.id === customerTerm.id) : []
  if (exactInvoice || customerTerm) {
    const found = exactInvoice ? [exactInvoice] : customerInvoices
    if (!found.length) return `No issued invoice records were found for ${customerTerm?.company || customerTerm?.name}.`
    return found.map((invoice) => {
      const customer = invoiceCustomer(invoice, workspace.customers)
      const snapshot = invoice.snapshot!
      const lineText = snapshot.lines.map((line) => `${line.description} × ${line.quantity}`).join('; ')
      return `${snapshot.invoiceNumber} · ${customer?.company || customer?.name || 'Customer'} · ${statusFor(invoice)} · ${formatMoney(snapshot.amounts.totalMinor, snapshot.currency)} · issued ${formatDate(snapshot.issueDate)} · due ${formatDate(snapshot.dueDate)}. ${lineText}`
    }).join('\n')
  }
  if (/overdue|late|past due/.test(q)) {
    const found = issued.filter((invoice) => statusFor(invoice) === 'overdue')
    return found.length ? `Overdue invoices (${found.length}):\n${found.map((invoice) => `${invoice.snapshot!.invoiceNumber} · ${invoice.snapshot!.customer.company || invoice.snapshot!.customer.name} · ${formatMoney(invoiceAmounts(invoice).totalMinor, invoice.snapshot!.currency)} · due ${formatDate(invoice.snapshot!.dueDate)}`).join('\n')}` : 'There are no overdue issued invoices in the saved workspace.'
  }
  if (/paid|collected|received/.test(q)) {
    const found = issued.filter((invoice) => statusFor(invoice) === 'paid')
    if (!found.length) return 'There are no invoices marked paid in the saved workspace.'
    return `Invoices marked paid (${found.length}): ${found.map((invoice) => `${invoice.snapshot!.invoiceNumber} ${formatMoney(invoiceAmounts(invoice).totalMinor, invoice.snapshot!.currency)}`).join('; ')}. These are saved invoice payment statuses, not bank transaction records.`
  }
  if (/customer|client|contact/.test(q)) return `Saved customers (${workspace.customers.length}): ${workspace.customers.map((customer) => `${customer.company || customer.name} · ${customer.email}`).join('; ')}`
  if (/invoice|revenue|balance|outstanding|total|analysis|summary|finance/.test(q)) {
    const grouped = new Map<string, { issued: number; paid: number; overdue: number; count: number }>()
    issued.forEach((invoice) => {
      const currency = invoice.snapshot!.currency
      const totals = grouped.get(currency) ?? { issued: 0, paid: 0, overdue: 0, count: 0 }
      const amount = invoiceAmounts(invoice).totalMinor
      totals.issued += amount; totals.count += 1
      if (statusFor(invoice) === 'paid') totals.paid += amount
      if (statusFor(invoice) === 'overdue') totals.overdue += amount
      grouped.set(currency, totals)
    })
    const summary = [...grouped].map(([currency, totals]) => `${currency}: ${totals.count} issued invoices, ${formatMoney(totals.issued, currency)} total; ${formatMoney(totals.paid, currency)} marked paid; ${formatMoney(totals.issued - totals.paid, currency)} unpaid.`).join('\n')
    return `${summary || 'No issued invoices are saved yet.'}\nThere are also ${invoices.filter((invoice) => !invoice.snapshot).length} draft invoices. This assistant reads saved invoice records and payment statuses; it does not have bank transactions or call-detail records.`
  }
  return 'I can look up a saved invoice number, customer, payment status, overdue invoices, or summarize invoice totals by currency. Try “Show UMN-2026-1048”, “What is overdue?”, or “Summarize finance”.'
}

export default function FinanceAssistant({ workspace, onNavigate, onNewInvoice }: { workspace: WorkspaceData; onNavigate: (page: 'overview' | 'invoices' | 'customers' | 'research') => void; onNewInvoice: () => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognition = useRef<Recognition | null>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (open && !listening) composer.current?.focus() }, [open, listening])
  useEffect(() => () => { recognition.current?.stop(); window.speechSynthesis?.cancel() }, [])

  function ask(question: string, spoken = false) {
    const clean = question.trim()
    if (!clean) return
    const command = clean.toLowerCase()
    const destinations = [
      { match: /\b(open|show|go to|navigate to)\b.*\boverview\b/, page: 'overview' as const, label: 'Overview' },
      { match: /\b(open|show|go to|navigate to)\b.*\binvoices?\b/, page: 'invoices' as const, label: 'Invoices' },
      { match: /\b(open|show|go to|navigate to)\b.*\bcustomers?\b/, page: 'customers' as const, label: 'Customers' },
      { match: /\b(open|show|go to|navigate to)\b.*\bweb research\b/, page: 'research' as const, label: 'Web research' },
    ]
    const destination = destinations.find((item) => item.match.test(command))
    if (/\b(new|create|start|prepare)\b.*\binvoice\b/.test(command)) {
      setMessages((current) => [...current, { role: 'user', content: clean }, { role: 'assistant', content: 'I opened a new invoice draft. Review the customer, dates, and charges before you save or issue it.' }])
      setOpen(false); onNewInvoice(); return
    }
    if (destination) {
      setMessages((current) => [...current, { role: 'user', content: clean }, { role: 'assistant', content: `Opening ${destination.label}.` }])
      setOpen(false); onNavigate(destination.page); return
    }
    const answer = answerFinance(clean, workspace)
    setMessages((current) => [...current, { role: 'user', content: clean }, { role: 'assistant', content: answer }])
    setDraft('')
    if (spoken && 'speechSynthesis' in window) { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(answer)) }
  }
  function startVoice() {
    const speechWindow = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!Constructor) { setError('Voice input is not supported in this browser. You can use text chat instead.'); return }
    setOpen(true); setError(''); window.speechSynthesis?.cancel()
    const instance = new Constructor(); recognition.current = instance; instance.lang = 'en-US'; instance.interimResults = false
    instance.onresult = (event) => { setListening(false); const transcript = event.results[0]?.[0]?.transcript || ''; ask(transcript, true) }
    instance.onerror = () => { setListening(false); setError('I could not hear that. Check microphone access and try again.') }
    instance.onend = () => setListening(false)
    setListening(true)
    try { instance.start() } catch { setListening(false); setError('Voice input could not start. Try again or use text chat.') }
  }
  return <>
    <div className="finance-assistant-launchers">
      <button className="finance-launch finance-chat-launch" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}><span aria-hidden="true">✦</span> Chat with system</button>
      <button className="finance-launch finance-voice-launch" onClick={startVoice}><span aria-hidden="true">♩</span> Voice assistant</button>
    </div>
    {open && <div className="finance-assistant-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { recognition.current?.stop(); setListening(false); setOpen(false) } }}><section className="finance-assistant-panel" role="dialog" aria-modal="true" aria-labelledby="finance-assistant-title">
      <header><div className="finance-assistant-mark">✦</div><div><h2 id="finance-assistant-title">Finance assistant</h2><p>Answers from invoices and customer records saved on this device.</p></div><button aria-label="Close assistant" onClick={() => { recognition.current?.stop(); setListening(false); setOpen(false) }}>×</button></header>
      <div className="finance-assistant-messages" aria-live="polite">{messages.length ? messages.map((message, index) => <article key={index} className={`finance-message ${message.role}`}><b>{message.role === 'assistant' ? 'Finance assistant' : 'You'}</b><p>{message.content}</p></article>) : <div className="finance-assistant-welcome"><h3>Ask about your finance records</h3><p>Try an invoice number, a customer name, paid or overdue invoices, or a totals analysis.</p><button onClick={() => ask('Summarize finance')}>Summarize finance</button></div>}</div>
      {error && <p className="finance-assistant-error" role="status">{error}</p>}
      {listening && <div className="finance-assistant-listening" role="status"><i/> Listening… speak your question <button onClick={() => { recognition.current?.stop(); setListening(false) }}>Stop</button></div>}
      <form className="finance-assistant-compose" onSubmit={(event) => { event.preventDefault(); ask(draft) }}><textarea ref={composer} value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} placeholder="Ask about invoices, customers, or totals…" aria-label="Ask the finance assistant" onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }}/><div><small>Read-only answers · no financial changes are made</small><span><button type="button" className="finance-mic" onClick={listening ? () => { recognition.current?.stop(); setListening(false) } : startVoice} aria-label={listening ? 'Stop voice input' : 'Ask by voice'}>{listening ? '■' : '🎙'}</button><button className="finance-send" disabled={!draft.trim()} aria-label="Send question">➤</button></span></div></form>
    </section></div>}
  </>
}
