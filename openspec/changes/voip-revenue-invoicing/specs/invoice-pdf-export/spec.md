# Spec Delta

## Purpose

Lets staff present issued VOIP charges as a polished, customer-ready digital invoice. The exported PDF is downloaded directly so staff do not need to print it.

## ADDED Requirements

### Requirement: Preview invoice before download
The system SHALL show a print-ready invoice preview using the selected customer and invoice values before the PDF is downloaded.

#### Scenario: Preview a complete invoice
- **WHEN** staff open preview for a complete invoice
- **THEN** the preview shows the sender, customer, invoice number when issued, dates, line items, currency, tax, and total

#### Scenario: Preview an incomplete draft
- **WHEN** staff preview a draft with missing required invoice data
- **THEN** the system identifies missing data and does not present the draft as an issued invoice

### Requirement: Download invoice as PDF
The system SHALL let staff download the invoice preview as a PDF without requiring a physical print action.

#### Scenario: Download an issued invoice
- **WHEN** staff select the PDF download action for an issued invoice
- **THEN** the browser downloads a readable PDF containing the same amounts and invoice identity shown in the preview

#### Scenario: Keep totals consistent
- **WHEN** staff compare the PDF to the issued invoice details
- **THEN** customer, line item, tax, currency, and total values match
