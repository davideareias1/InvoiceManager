# E-Rechnung Rechnungsmanager - Quick Start Guide

This guide will help you get the E-Rechnung Rechnungsmanager up and running in minutes.

## Installation Options

### Option 1: Quick Start with npm

```bash
# Install dependencies
cd e-rechnung-nextjs
npm install

# Start development server
npm run dev
```

Open your browser and navigate to http://localhost:3000

### Option 2: Using setup.sh (Linux/Mac)

```bash
# Make script executable
chmod +x setup.sh

# Run setup script
./setup.sh
```

## First-Time Setup

1. **Select Storage Directory**
   - When prompted, select a directory where you want to store your invoice data
   - This directory will contain all your invoices, customers, and company information
   - Tip: Create a new empty directory specifically for this purpose

2. **Enter Company Information**
   - Navigate to the Company Settings page
   - Fill in your business details, tax information, and banking details
   - Upload your company logo (optional)
   - Save changes

3. **Create Your First Invoice**
   - Click on "Create Invoice" in the sidebar
   - Fill in the customer information
   - Add line items
   - Save the invoice
   - You can also export it as PDF

## What's Next?

- **Explore the Dashboard**: Get an overview of your invoicing activity
- **Check Analytics**: View revenue trends and customer insights
- **Manage Invoices**: View and edit your invoices from the Invoices page

## Quick Tips

- **Toggle Auto-Refresh**: Enable auto-refresh on the Analytics page to keep data current
- **Filter Data**: Use time filters to focus on specific time periods
- **Dark/Light Mode**: Toggle the theme using the icon in the sidebar
- **PDF Export**: Export any invoice as a professional PDF document

## Troubleshooting

- If you get permission errors, ensure you've granted directory access
- If the application seems slow, try reducing the number of invoices you're storing
- For browser compatibility issues, ensure you're using Chrome, Edge, or Opera

## Need Help?

For more detailed information, refer to the main README.md and DOCUMENTATION.md files.

---

Happy invoicing! 