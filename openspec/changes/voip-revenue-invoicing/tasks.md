# Tasks

## 1. Application Foundation

- [x] 1.1 Scaffold the React and TypeScript browser app with its development and production build commands; verify the development server opens the app shell and the production build completes.
- [x] 1.2 Add the shared invoice/customer types, configurable currency formatting, decimal-safe amount utilities, and sample records; verify representative quantities, tax, and totals render consistently in the app.
- [x] 1.3 Add versioned browser persistence with first-run sample data and empty/error states; verify a saved edit survives reload without overwriting existing records with demo data.
- [x] 1.4 Document startup, local-only data behavior, and the prototype's accounting/compliance boundary in the workspace README; verify each documented command matches the app scripts.

## 2. Customer and Invoice Workflow

- [x] 2.1 Build customer list, create, edit, and selection flows with required-field feedback; verify a customer is reusable on a new invoice and incomplete details are rejected.
- [x] 2.2 Build the invoice draft editor for dates, currency, VOIP line items, and configurable tax; verify subtotal, line amounts, and totals update as values change.
- [x] 2.3 Implement draft review and issue actions with unique local invoice numbers, immutable issued values, and paid/overdue status updates; verify invalid drafts remain editable and issued data appears consistently in details and lists.

## 3. Digital PDF Delivery

- [x] 3.1 Build a responsive invoice preview containing sender, customer, invoice identity, dates, line items, tax, and totals; verify preview values match the selected draft or issued invoice.
- [x] 3.2 Generate and download a branded PDF directly in the browser, including pagination for long invoices; verify the downloaded file opens and its displayed amounts and identity match the invoice preview.

## 4. Revenue Dashboard and Visual Finish

- [x] 4.1 Build dashboard period filters, issued-invoice revenue totals grouped by currency, and recent invoice navigation; verify period changes update results and unlike currencies stay separate.
- [x] 4.2 Apply the responsive Umniah-inspired visual system, status feedback, subtle transitions, and reduced-motion behavior; verify main flows remain usable at narrow and wide viewports and with reduced motion enabled.
- [x] 4.3 Perform an end-to-end walkthrough from customer setup through invoice issue and PDF download, correcting any visible inconsistencies; verify the dashboard reflects the saved issued invoice.
