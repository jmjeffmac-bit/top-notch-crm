# Top Notch CRM secure backend deployment

The backend is designed for Google Apps Script + Google Sheets. No PINs or customer data belong in this public GitHub repository.

## Deployment sequence

1. Create a new standalone Google Apps Script project named `Top Notch CRM Backend`.
2. Replace the starter code with `backend/Code.gs` from this repository.
3. Run `setupCRM()` once. Approve Google's requested permissions. This creates a private Google Sheet named `Top Notch CRM Database` and stores its ID in Script Properties.
4. Generate three NEW production PINs. Do not reuse any PIN that has previously appeared in the public website source.
5. In Apps Script, run `setInitialSecurity(ownerPin, stanPin, louisPin)` once with the new PINs. The backend stores only SHA-256 PIN hashes in Script Properties.
6. Deploy as a Web App:
   - Execute as: Me
   - Who has access: Anyone
   - Use the generated `/exec` URL in the CRM frontend.
7. Test `doGet()` by opening the Web App URL. It should return JSON containing `"status":"ready"`.
8. Connect the frontend to the Web App URL and test Jeff/Stan/Louis separately.

## Security model

- The public GitHub frontend contains no production PINs.
- Login verification happens on the Apps Script backend.
- Session tokens are stored in Apps Script CacheService and expire after 6 hours.
- Jeff/Owner can read and edit all CRM tables.
- Stan/Tech1 and Louis/Tech2 receive only jobs assigned to their role.
- Technicians can move their assigned job through Accepted, In Progress, and Completed.
- Customers, estimates, invoices, and price book remain owner-only.

## Data tables

The backend creates private sheets for:

- customers
- estimates
- jobs
- invoices
- pricebook

Do not enter real customer information into the public diagnostic frontend before this backend is deployed and connected.
