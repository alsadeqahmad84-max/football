# Spec Delta

## Purpose

Gives staff a quick view of issued VOIP revenue and invoice follow-up needs. Dashboard values are derived from the invoices currently saved in the browser.

## ADDED Requirements

### Requirement: Summarize invoice revenue
The system SHALL show invoice count and total issued revenue for a selected time period, grouped by invoice currency.

#### Scenario: Select a reporting period
- **WHEN** staff select a reporting period
- **THEN** the dashboard updates its invoice count and revenue totals using invoices issued in that period

#### Scenario: Keep currencies distinct
- **WHEN** matching issued invoices use more than one currency
- **THEN** the dashboard reports separate totals for each currency without combining unlike amounts

### Requirement: Identify invoice follow-up
The system SHALL show recent invoices with customer, invoice number, issue date, total, and payment status.

#### Scenario: Review recent invoices
- **WHEN** staff open the dashboard
- **THEN** recent invoices appear with enough detail to identify their current payment status

#### Scenario: Open an invoice from the dashboard
- **WHEN** staff select a recent invoice
- **THEN** the system opens that invoice's details

### Requirement: Provide responsive interaction feedback
The system SHALL provide clear visual feedback when staff navigate the dashboard, change the reporting period, or select an invoice.

#### Scenario: Change reporting period
- **WHEN** staff choose a different period
- **THEN** the selected period is visibly indicated and updated summary values appear

#### Scenario: Respect reduced motion preference
- **WHEN** the device requests reduced motion
- **THEN** dashboard transitions avoid nonessential movement while all controls remain usable
