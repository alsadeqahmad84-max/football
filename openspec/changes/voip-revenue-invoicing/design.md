# Design

## Context

See `proposal.md` for motivation and `specs/` for user-visible requirements. The workspace is greenfield. The first release is a single-browser prototype: invoice and customer records remain in that browser and do not synchronize to another device.

## Goals / Non-Goals

**Goals:**
- Make invoice creation, review, status tracking, and PDF download usable from a polished responsive billing workspace.
- Keep calculations and the PDF preview consistent by using one invoice data model.
- Make the prototype easy to replace or extend with shared persistence and verified billing rules later.

**Non-Goals:**
- PBX integration, call-detail record rating, accounting-system sync, multi-user authentication, or emailing invoices.
- Claiming that the prototype's configurable tax fields satisfy any jurisdiction's statutory invoice rules.

## Decisions

1. **Build a client-side single-page application.** Use React with TypeScript and Vite for a straightforward component-based dashboard and local development. A server-rendered application is unnecessary for the prototype because it has no account system or shared data service.

2. **Use a shared invoice model with browser persistence.** Keep customers and invoices in versioned local storage, with drafts referencing customer records and issued invoices preserving a customer-detail snapshot. This keeps issued documents stable if staff later edit a customer record. Seed sample data only when the workspace has no saved data. A backend is deferred until multi-user access and retention needs are defined.

3. **Use decimal-safe invoice arithmetic and configurable tax.** Represent money in currency minor units and handle fractional service quantities with decimal arithmetic before rounding to the selected currency precision. Do not assume a tax rate or statutory fields; keep tax rate configurable and label the prototype as requiring accounting review before production use. This avoids binary floating-point drift and unsupported compliance claims.

4. **Generate PDFs directly in the browser.** Use `pdf-lib` to build a downloadable document from the issued invoice model rather than relying on a print dialog. Keep the HTML preview and PDF generation driven by the same immutable issued values; support page breaks for invoices with many line items.

5. **Use a restrained branded dashboard.** Use deep navy and warm neutral surfaces with a magenta accent inspired by Umniah's public-facing palette, high-contrast text, and a compact type scale. Use subtle page, card, and status transitions; avoid decorative motion on the invoice document itself and honor `prefers-reduced-motion`.

## Risks / Trade-offs

- **Local storage can be cleared or edited and is not shared across devices** → Label the prototype clearly, show that data is local, and do not use it as the source of official financial records.
- **Manual entry can introduce billing mistakes** → Validate quantities, prices, dates, currency, and totals before issue; keep a visible review step before download.
- **Tax and invoice rules depend on jurisdiction and company policy** → Keep fields configurable and require accounting review before using generated PDFs as statutory invoices.
- **Large invoices can exceed a page** → Paginate the generated PDF and verify totals and invoice identity remain clear on each exported document.

## Migration Plan

No existing application data or code needs migration. Replace browser storage with an authenticated backend only after ownership, access control, backup, and retention requirements are agreed. Existing browser data will not migrate automatically.
