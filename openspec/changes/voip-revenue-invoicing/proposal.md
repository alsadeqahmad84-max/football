# Proposal

## Why

The team needs a clear way to prepare and issue professional VOIP revenue invoices as downloadable PDFs, without printing them. A focused billing workspace can make invoice creation, tracking, and revenue visibility quicker while presenting a polished experience to customers and staff.

## What Changes

- Add a responsive VOIP billing dashboard with revenue summaries, recent invoices, and clear navigation.
- Let staff maintain customer details and create invoices with VOIP service line items, configurable currency and tax, due dates, and payment status.
- Allow invoices to be issued as branded PDFs and downloaded directly, with an on-screen preview and no print step.
- Use a professional Umniah-inspired visual theme with subtle transitions and purposeful interactive feedback.
- Scope the first release as a browser prototype with local persistence and sample records. Assume staff enter service quantities and prices manually; PBX/CDR imports, accounting integrations, user authentication, email delivery, and jurisdiction-specific tax validation are out of scope.

## Capabilities

### New Capabilities
- `invoice-lifecycle`: Manage customers and VOIP revenue invoices from draft through issue and payment tracking.
- `invoice-pdf-export`: Preview and download a customer-ready invoice as a PDF.
- `revenue-dashboard`: Review invoice and revenue summaries over selectable periods.

### Modified Capabilities
- None.

## Impact

This is a greenfield browser application in the current workspace. It will introduce the frontend structure and PDF generation dependency needed for an interactive, locally persisted prototype. Generated invoices are drafts for operational use until accounting confirms the applicable statutory fields, tax rules, and production storage requirements.
