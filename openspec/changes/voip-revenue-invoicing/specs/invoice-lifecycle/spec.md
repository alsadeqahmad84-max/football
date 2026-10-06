# Spec Delta

## Purpose

Provides staff with a consistent way to maintain customer details and prepare, issue, and track VOIP revenue invoices. The first release supports manually entered services and charges.

## ADDED Requirements

### Requirement: Maintain invoice customers
The system SHALL let staff create, view, update, and select customer records containing a name and billing contact details.

#### Scenario: Create a customer
- **WHEN** staff save a customer with a name and billing contact
- **THEN** the customer is available for selection on a new invoice

#### Scenario: Reject an incomplete customer
- **WHEN** staff save a customer without a name or billing contact
- **THEN** the system identifies the missing required fields and does not save the record

### Requirement: Create and edit invoice drafts
The system SHALL let staff create a draft invoice for a customer with an invoice date, due date, currency, and one or more manually entered VOIP service line items.

#### Scenario: Add VOIP charges
- **WHEN** staff enter a service description, quantity, and unit price on a draft
- **THEN** the system shows the line amount and updates the invoice subtotal

#### Scenario: Calculate configured tax and total
- **WHEN** staff enter a valid tax rate on a draft
- **THEN** the system calculates tax from the subtotal and displays the resulting total in the selected currency

#### Scenario: Keep an incomplete invoice in draft
- **WHEN** staff attempt to issue an invoice without a customer, required dates, or a valid line item
- **THEN** the system explains what must be corrected and keeps the invoice in draft

### Requirement: Issue and track invoices
The system SHALL assign each issued invoice a unique invoice number and track its issue date and payment status.

#### Scenario: Issue a valid invoice
- **WHEN** staff issue a complete draft invoice
- **THEN** the system assigns a unique invoice number and marks it as issued

#### Scenario: Record payment status
- **WHEN** staff mark an issued invoice as paid or overdue
- **THEN** the system updates the displayed status and invoice list

#### Scenario: Preserve issued invoice values
- **WHEN** staff open an issued invoice
- **THEN** the system displays the customer, line items, currency, tax, and total values used when it was issued

### Requirement: Persist billing workspace data locally
The prototype SHALL retain customer and invoice changes in the current browser between reloads on the same device.

#### Scenario: Reload the workspace
- **WHEN** staff reload the app after saving customer or invoice changes
- **THEN** the saved records remain available in that browser

#### Scenario: Use a different browser
- **WHEN** staff open the workspace in another browser or device
- **THEN** the prototype does not claim that locally saved records are synchronized there
