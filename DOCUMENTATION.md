# E-Rechnung Rechnungsmanager - Technical Documentation

This document provides technical details about the E-Rechnung Rechnungsmanager application, including its architecture, code organization, and customization options.

## Architecture Overview

E-Rechnung Rechnungsmanager is a client-side Next.js application with the following key components:

1. **UI Layer**: React components built with Tailwind CSS and Radix UI primitives
2. **State Management**: React Context API for global state management
3. **Storage**: File System Access API for client-side file operations
4. **Data Visualization**: Recharts for rendering analytics charts

### Key Technologies

- **Next.js 14**: React framework with App Router for routing and page structure
- **TypeScript**: For type safety and improved developer experience
- **Tailwind CSS**: For styling and responsive design
- **Radix UI**: For accessible UI components and primitives
- **File System Access API**: Browser API for file operations
- **Recharts**: For data visualization
- **date-fns**: For date manipulation and formatting
- **jsPDF**: For PDF generation

## Code Organization

The project follows a standard Next.js app directory structure:

```
e-rechnung-nextjs/
├── public/              # Static assets
├── src/                 # Source code
│   ├── app/             # Next.js app router structure
│   │   ├── analytics/   # Analytics page
│   │   ├── company/     # Company settings page
│   │   ├── contexts/    # React contexts for state management
│   │   ├── create-invoice/ # Invoice creation page
│   │   ├── dashboard/   # Dashboard page
│   │   ├── hooks/       # Custom React hooks
│   │   ├── interfaces/  # TypeScript interfaces
│   │   ├── invoices/    # Invoice management pages
│   │   ├── lib/         # Utility libraries
│   │   ├── utils/       # Helper functions
│   │   ├── globals.css  # Global CSS
│   │   ├── layout.tsx   # Root layout component
│   │   ├── page.tsx     # Root page component
│   │   └── providers.tsx # Root context providers
│   ├── components/      # Shared UI components
│   ├── hooks/           # App-wide custom hooks
│   ├── lib/             # App-wide libraries
│   └── types/           # TypeScript type definitions
└── ...                  # Config files (next.config.js, etc.)
```

## Core Components

### Context Providers

The application uses React Context for state management:

1. **FileSystemContext**: Manages file system operations, invoice storage and retrieval
   - Located: `src/app/contexts/FileSystemContext.tsx`
   - Responsible for: File permission requests, saving/loading invoices, file deletion

2. **CompanyContext**: Manages company information
   - Located: `src/app/contexts/CompanyContext.tsx`
   - Responsible for: Storing company details, logo, banking information

### Data Model

Key data interfaces defined in `src/app/interfaces/index.ts`:

1. **Invoice**: The core data structure for invoices
   - Contains: Basic invoice details, customer info, line items, payment status

2. **CustomerData**: Structure for customer information
   - Contains: Name, address, contact information

3. **ProductData**: Structure for product/service information
   - Contains: Name, price, description, unit

4. **CompanyInfo**: Company details
   - Contains: Business information, tax details, banking information

## File System Implementation

The application uses the File System Access API to store data locally in the user's file system:

- **File Organization**: 
  - Invoices stored as JSON files
  - Customer data stored in a `/customers` subdirectory
  - Product data stored in a `/products` subdirectory
  - Company information stored in a `company.json` file

- **Security Considerations**:
  - All data stays on the user's device
  - Directory handle is persisted for future sessions
  - Permissions requested only once per session

## Analytics Implementation

The Analytics page (`src/app/analytics/page.tsx`) provides insights through:

1. **Data Processing**: Raw invoice data is transformed for visualization
2. **Filtering**: Time-based filtering (3m, 6m, 1y, all time)
3. **Visualization**: Charts for revenue trends, customer analysis, and invoice status

## How to Customize

### Adding New Components

1. Create new component files in `src/components/`
2. Import and use them in page files

Example:
```tsx
// src/components/MyCustomComponent.tsx
import React from 'react';

interface MyCustomComponentProps {
  title: string;
}

export function MyCustomComponent({ title }: MyCustomComponentProps) {
  return <div className="p-4 bg-white rounded-lg">{title}</div>;
}
```

### Modifying the Invoice Model

To extend the Invoice interface:

1. Update the interface in `src/app/interfaces/index.ts`
2. Update corresponding components and contexts

Example:
```tsx
// Adding a new field to Invoice
export interface Invoice {
  // ... existing fields
  reference_number?: string; // Add new optional field
}
```

### Styling Customization

The application uses Tailwind CSS for styling:

1. Modify `tailwind.config.js` to change colors, typography, etc.
2. Update global styles in `src/app/globals.css`

Example tailwind.config.js modification:
```js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          // Custom primary color palette
          DEFAULT: '#1e40af',
          50: '#eff6ff',
          // ... more color variants
        }
      }
    }
  }
}
```

## Performance Considerations

- **Memoization**: Components use `useMemo` and `useCallback` to optimize rendering
- **Data Loading**: Asynchronous loading with proper loading states
- **Auto-Refresh**: Intelligent auto-refresh to keep data current without constant reloads

## Testing

For testing components and functionality:

1. Unit tests: Use React Testing Library
2. E2E tests: Use Playwright or Cypress

Example test setup:
```bash
# Install testing libraries
npm install --save-dev @testing-library/react @testing-library/jest-dom jest

# Run tests
npm test
```

## Known Limitations

1. **Browser Support**: The File System Access API is not supported in all browsers
2. **Mobile Support**: Limited support for mobile devices due to File System API restrictions
3. **Large Dataset Performance**: May experience performance issues with very large invoice datasets

## Extending the Analytics

To add new analytics charts:

1. Create new data processing functions in the Analytics page
2. Add new chart components using Recharts
3. Integrate into the existing tab structure

Example:
```tsx
// New data processing function
const quarterlyRevenueData = useMemo(() => {
  // Process invoice data by quarter
  // ...
}, [filteredInvoices]);

// New chart component in the JSX
<ResponsiveContainer width="100%" height="90%">
  <BarChart data={quarterlyRevenueData}>
    {/* Chart configuration */}
  </BarChart>
</ResponsiveContainer>
```

## Deployment Options

### Static Export

For static site hosting (Netlify, Vercel, etc.):

```bash
npm run build
npm run export
```

### Docker Deployment

1. Create a Dockerfile:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
CMD ["npm", "start"]
EXPOSE 3000
```

2. Build and run:
```bash
docker build -t e-rechnung .
docker run -p 3000:3000 e-rechnung
```

## Future Development

Potential areas for enhancement:

1. **Multi-language Support**: Implement i18n for internationalization
2. **Invoice Templates**: Add customizable invoice templates
3. **Data Export/Import**: Add CSV/Excel export functionality
4. **Cloud Sync**: Optional cloud backup/sync functionality
5. **Advanced Reporting**: Additional analytics and reporting features

---

For further assistance or to report issues, please create an issue in the GitHub repository. 