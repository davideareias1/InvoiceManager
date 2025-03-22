# InvoiceManager

![InvoiceManager Logo](assets/eingangsrechnungen.png)

A modern, browser-based invoice management system for creating, managing, and analyzing electronic invoices. Built with Next.js, TypeScript, and Tailwind CSS.

## Overview

InvoiceManager is a comprehensive solution for small businesses and freelancers to manage their invoicing workflow. The application provides a user-friendly interface for creating, storing, and analyzing invoices, with built-in support for managing customers, products, and company information.

## Features

### Invoice Management
- **Create Invoices**: Generate professional invoices with custom line items, tax rates, and payment terms
- **Track Payments**: Monitor invoice status (paid, unpaid, overdue, etc.)
- **PDF Export**: Create PDF versions of invoices for sharing with customers
- **Browser Storage**: Uses the File System Access API to store data locally, with no server needed

### Customer Management
- Store and manage customer information
- Quick access to customer details when creating invoices
- View customer-specific invoice history

### Analytics & Insights
- **Dashboard**: Visual overview of your invoicing activity
- **Financial Analysis**: Track revenue over time with interactive charts
- **Customer Analysis**: Identify top customers and spending patterns
- **Product Analysis**: Analyze popular products and services

### UI Features
- **Responsive Design**: Works on desktop and tablet devices
- **Dark/Light Mode**: Choose your preferred theme
- **Real-time Updates**: Data refreshes automatically to keep information current

## Technology Stack

- **Framework**: Next.js 14 with React 18
- **UI**: Tailwind CSS with Radix UI components
- **Charts**: Recharts for data visualization
- **TypeScript**: Type-safe code throughout
- **File System Access API**: Browser-based file storage with no server needed

## Installation

### Prerequisites
- Node.js 16.8 or later
- npm or yarn

### Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/InvoiceManager.git
   cd InvoiceManager
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
npm run start
# or
yarn build
yarn start
```

## Usage Guide

### First-time Setup

1. **Grant Directory Access**: On first launch, you'll need to select a directory where the application will store your invoice data.
2. **Enter Company Information**: Configure your company details, logo, and default settings.

### Creating Invoices

1. Navigate to "Create Invoice" in the sidebar
2. Fill in customer information (or select an existing customer)
3. Add line items with descriptions, quantities, and prices
4. Set tax rates and payment terms
5. Preview and save the invoice
6. Export to PDF if needed

### Managing Invoices

1. View all invoices from the main dashboard or invoices page
2. Filter and search by date, customer, or status
3. Update invoice status as payments are received
4. Edit or delete invoices as needed

### Using Analytics

1. Navigate to the Analytics section
2. Select your preferred time range (3 months, 6 months, 1 year, or all time)
3. Explore different views: Overview, Revenue, and Customers
4. Use insights to inform business decisions

## Data Privacy & Security

- All data is stored locally on your device using the File System Access API
- No data is transmitted to any server
- Company and customer information never leaves your browser
- For additional security, ensure regular backups of your invoice directory

## Browser Compatibility

This application requires a modern browser with support for the File System Access API:
- Google Chrome 86+
- Microsoft Edge 86+
- Opera 72+

> **Note**: Safari and Firefox don't currently support the File System Access API.

## Troubleshooting

### Common Issues

**Issue**: Unable to access or save files  
**Solution**: Ensure you've granted the application permission to access the selected directory.

**Issue**: Data not refreshing automatically  
**Solution**: Toggle the auto-refresh button or manually refresh from the UI.

**Issue**: PDF export not working  
**Solution**: Ensure you've filled out all required fields in the invoice and company settings.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---