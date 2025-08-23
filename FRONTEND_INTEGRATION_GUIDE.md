# Frontend Integration Guide for Enhanced Invoice Generation System

## Overview

The invoice generation system has been completely revamped to support both **Purchase** and **Sale** scenarios with enhanced validation, modern PDF generation, and comprehensive data handling. This guide provides all the necessary information for frontend integration.

## Key Features

### 1. **Dual Invoice Types**

- **Purchase Invoices**: Material-based with quality deductions
- **Sale Invoices**: Palette-based (packed/loose) with bag counting

### 2. **Enhanced Validation**

- Flagged entry detection (both `isFlagged` and `varianceFlag`)
- Date range validation
- Material rate validation for purchases
- Palette rate validation for sales

### 3. **Modern PDF Generation**

- Aesthetic design with modern fonts
- Material-wise breakdown tables for purchases
- Palette information for sales
- Professional layout with color coding

## API Endpoints

### 1. **Get Available Entries for Invoice Generation**

```typescript
GET /api/invoices/available-entries

Query Parameters:
- vendor: string (optional)
- plant: string (optional)
- invoiceType: 'purchase' | 'sale' (optional)
- startDate: string (optional) - ISO date string
- endDate: string (optional) - ISO date string
- page: number (optional, default: 1)
- limit: number (optional, default: 10)

Response:
{
  entries: Array<{
    _id: string;
    entryNumber: string;
    entryType: 'purchase' | 'sale';
    entryDate: string;
    exactWeight?: number;
    finalWeight?: number;
    exitWeight?: number;
    entryWeight?: number;
    quantity: number;
    materialType?: {
      _id: string;
      name: string;
    };
    palletteType?: 'loose' | 'packed';
    noOfBags?: number;
    weightPerBag?: number;
    packedWeight?: number;
    moisture?: number;
    dust?: number;
    moistureWeight?: number;
    dustWeight?: number;
    vendor: {
      _id: string;
      name: string;
      code: string;
    };
    plant: {
      _id: string;
      name: string;
      code: string;
    };
    vehicle: {
      _id: string;
      vehicleNumber: string;
      driverName: string;
    };
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### 2. **Generate Invoice from Date Range**

```typescript
POST /api/invoices/generate-from-range

Request Body:
{
  vendor: string;           // Required: Vendor ID
  plant: string;            // Required: Plant ID
  invoiceType: 'purchase' | 'sale';  // Required
  startDate: string;        // Required: ISO date string
  endDate: string;          // Required: ISO date string

  // For Purchase Invoices
  materialRates?: {         // Required for purchase
    [materialTypeId: string]: number;
  };

  // For Sale Invoices
  paletteRates?: {          // Required for sale
    loose: number;
    packed: number;
  };

  invoiceDate?: string;     // Optional: ISO date string
  dueDate?: string;         // Optional: ISO date string
}

Response:
{
  _id: string;
  invoiceNumber: string;
  vendor: string;
  plant: string;
  entries: string[];
  invoiceType: 'purchase' | 'sale';
  startDate: string;
  endDate: string;
  materialRates?: Record<string, number>;
  paletteRates?: {
    loose: number;
    packed: number;
  };
  totalQuantity: number;
  totalAmount: number;
  materialBreakdown?: Array<{
    materialType: string;
    materialName: string;
    totalQuantity: number;
    totalMoistureQuantity: number;
    totalDustQuantity: number;
    finalQuantity: number;
    rate: number;
    totalAmount: number;
  }>;
  paletteBreakdown?: {
    totalBags?: number;
    weightPerBag?: number;
    totalPackedWeight?: number;
  };
  invoiceDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 3. **Generate PDF**

```typescript
GET /api/invoices/:id/pdf

Response:
{
  pdfPath: string;
  downloadUrl: string;
}
```

## Frontend Implementation Guide

### 1. **Invoice Generation Form Component**

```typescript
// InvoiceGenerationForm.tsx
import React, { useState, useEffect } from 'react';
import { DatePicker, Select, Input, Button, message, Table } from 'antd';

interface InvoiceGenerationFormProps {
  onInvoiceGenerated: (invoice: any) => void;
}

const InvoiceGenerationForm: React.FC<InvoiceGenerationFormProps> = ({ onInvoiceGenerated }) => {
  const [formData, setFormData] = useState({
    vendor: '',
    plant: '',
    invoiceType: 'purchase' as 'purchase' | 'sale',
    startDate: '',
    endDate: '',
    materialRates: {} as Record<string, number>,
    paletteRates: {
      loose: 0,
      packed: 0
    }
  });

  const [availableEntries, setAvailableEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);

  // Fetch available entries when filters change
  useEffect(() => {
    if (formData.vendor && formData.plant && formData.startDate && formData.endDate) {
      fetchAvailableEntries();
    }
  }, [formData.vendor, formData.plant, formData.startDate, formData.endDate]);

  const fetchAvailableEntries = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/available-entries?${new URLSearchParams({
        vendor: formData.vendor,
        plant: formData.plant,
        invoiceType: formData.invoiceType,
        startDate: formData.startDate,
        endDate: formData.endDate
      })}`);

      const data = await response.json();
      setAvailableEntries(data.entries);

      // Extract unique materials for purchase invoices
      if (formData.invoiceType === 'purchase') {
        const uniqueMaterials = [...new Set(data.entries.map((e: any) => e.materialType?._id).filter(Boolean))];
        setMaterials(uniqueMaterials);
      }
    } catch (error) {
      message.error('Failed to fetch available entries');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoice = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/invoices/generate-from-range', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate invoice');
      }

      const invoice = await response.json();
      message.success('Invoice generated successfully!');
      onInvoiceGenerated(invoice);
    } catch (error: any) {
      message.error(error.message || 'Failed to generate invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="invoice-generation-form">
      <h2>Generate Invoice</h2>

      <div className="form-row">
        <Select
          placeholder="Select Vendor"
          value={formData.vendor}
          onChange={(value) => setFormData({ ...formData, vendor: value })}
          style={{ width: 200 }}
        >
          {/* Vendor options */}
        </Select>

        <Select
          placeholder="Select Plant"
          value={formData.plant}
          onChange={(value) => setFormData({ ...formData, plant: value })}
          style={{ width: 200 }}
        >
          {/* Plant options */}
        </Select>
      </div>

      <div className="form-row">
        <Select
          placeholder="Invoice Type"
          value={formData.invoiceType}
          onChange={(value) => setFormData({ ...formData, invoiceType: value })}
          style={{ width: 200 }}
        >
          <Select.Option value="purchase">Purchase</Select.Option>
          <Select.Option value="sale">Sale</Select.Option>
        </Select>

        <DatePicker
          placeholder="Start Date"
          onChange={(date, dateString) => setFormData({ ...formData, startDate: dateString })}
        />

        <DatePicker
          placeholder="End Date"
          onChange={(date, dateString) => setFormData({ ...formData, endDate: dateString })}
        />
      </div>

      {formData.invoiceType === 'purchase' && (
        <div className="material-rates-section">
          <h3>Material Rates</h3>
          {materials.map((materialId) => {
            const material = availableEntries.find(e => e.materialType?._id === materialId)?.materialType;
            return (
              <div key={materialId} className="rate-input">
                <label>{material?.name}:</label>
                <Input
                  type="number"
                  placeholder="Rate per kg"
                  value={formData.materialRates[materialId] || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    materialRates: {
                      ...formData.materialRates,
                      [materialId]: parseFloat(e.target.value) || 0
                    }
                  })}
                  style={{ width: 150 }}
                />
              </div>
            );
          })}
        </div>
      )}

      {formData.invoiceType === 'sale' && (
        <div className="palette-rates-section">
          <h3>Palette Rates</h3>
          <div className="rate-input">
            <label>Loose Rate (per kg):</label>
            <Input
              type="number"
              value={formData.paletteRates.loose}
              onChange={(e) => setFormData({
                ...formData,
                paletteRates: {
                  ...formData.paletteRates,
                  loose: parseFloat(e.target.value) || 0
                }
              })}
              style={{ width: 150 }}
            />
          </div>
          <div className="rate-input">
            <label>Packed Rate (per kg):</label>
            <Input
              type="number"
              value={formData.paletteRates.packed}
              onChange={(e) => setFormData({
                ...formData,
                paletteRates: {
                  ...formData.paletteRates,
                  packed: parseFloat(e.target.value) || 0
                }
              })}
              style={{ width: 150 }}
            />
          </div>
        </div>
      )}

      <div className="available-entries">
        <h3>Available Entries ({availableEntries.length})</h3>
        <Table
          dataSource={availableEntries}
          columns={[
            { title: 'Entry #', dataIndex: 'entryNumber', key: 'entryNumber' },
            { title: 'Date', dataIndex: 'entryDate', key: 'entryDate', render: (date) => new Date(date).toLocaleDateString() },
            { title: 'Vehicle', dataIndex: ['vehicle', 'vehicleNumber'], key: 'vehicle' },
            { title: 'Driver', dataIndex: ['vehicle', 'driverName'], key: 'driver' },
            { title: 'Weight (kg)', dataIndex: 'exactWeight', key: 'weight', render: (weight) => weight?.toFixed(2) || 'N/A' },
            { title: 'Material', dataIndex: ['materialType', 'name'], key: 'material', render: (name) => name || 'N/A' },
            { title: 'Palette', dataIndex: 'palletteType', key: 'palette', render: (type) => type || 'N/A' }
          ]}
          pagination={false}
          size="small"
        />
      </div>

      <Button
        type="primary"
        onClick={handleGenerateInvoice}
        loading={loading}
        disabled={!formData.vendor || !formData.plant || !formData.startDate || !formData.endDate}
        style={{ marginTop: 16 }}
      >
        Generate Invoice
      </Button>
    </div>
  );
};

export default InvoiceGenerationForm;
```

### 2. **Invoice List Component**

```typescript
// InvoiceList.tsx
import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Space, message } from 'antd';
import { DownloadOutlined, EyeOutlined } from '@ant-design/icons';

const InvoiceList: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/invoices');
      const data = await response.json();
      setInvoices(data.invoices);
    } catch (error) {
      message.error('Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`);
      const data = await response.json();

      // Create download link
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      message.error('Failed to download PDF');
    }
  };

  const columns = [
    { title: 'Invoice #', dataIndex: 'invoiceNumber', key: 'invoiceNumber' },
    { title: 'Type', dataIndex: 'invoiceType', key: 'invoiceType', render: (type: string) => (
      <Tag color={type === 'purchase' ? 'blue' : 'green'}>{type.toUpperCase()}</Tag>
    )},
    { title: 'Vendor', dataIndex: ['vendor', 'name'], key: 'vendor' },
    { title: 'Plant', dataIndex: ['plant', 'name'], key: 'plant' },
    { title: 'Period', key: 'period', render: (record: any) => (
      `${new Date(record.startDate).toLocaleDateString()} - ${new Date(record.endDate).toLocaleDateString()}`
    )},
    { title: 'Total Qty (kg)', dataIndex: 'totalQuantity', key: 'totalQuantity', render: (qty: number) => qty.toFixed(2) },
    { title: 'Total Amount', dataIndex: 'totalAmount', key: 'totalAmount', render: (amount: number) => `₹${amount.toFixed(2)}` },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => (
      <Tag color={status === 'paid' ? 'green' : status === 'overdue' ? 'red' : 'orange'}>
        {status.toUpperCase()}
      </Tag>
    )},
    { title: 'Actions', key: 'actions', render: (record: any) => (
      <Space>
        <Button
          icon={<EyeOutlined />}
          size="small"
          onClick={() => window.open(`/api/invoices/${record._id}/pdf`, '_blank')}
        >
          View
        </Button>
        <Button
          icon={<DownloadOutlined />}
          size="small"
          onClick={() => handleDownloadPDF(record._id)}
        >
          Download
        </Button>
      </Space>
    )}
  ];

  return (
    <div className="invoice-list">
      <h2>Invoices</h2>
      <Table
        dataSource={invoices}
        columns={columns}
        loading={loading}
        rowKey="_id"
        pagination={{
          total: invoices.length,
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true
        }}
      />
    </div>
  );
};

export default InvoiceList;
```

### 3. **Invoice Detail View Component**

```typescript
// InvoiceDetail.tsx
import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Table, Button, Tag, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

interface InvoiceDetailProps {
  invoiceId: string;
}

const InvoiceDetail: React.FC<InvoiceDetailProps> = ({ invoiceId }) => {
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/${invoiceId}`);
      const data = await response.json();
      setInvoice(data);
    } catch (error) {
      message.error('Failed to fetch invoice details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!invoice) return <div>Invoice not found</div>;

  return (
    <div className="invoice-detail">
      <Card title={`Invoice ${invoice.invoiceNumber}`} extra={
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={() => window.open(`/api/invoices/${invoiceId}/pdf`, '_blank')}
        >
          Download PDF
        </Button>
      }>
        <Descriptions title="Basic Information" bordered>
          <Descriptions.Item label="Invoice Number">{invoice.invoiceNumber}</Descriptions.Item>
          <Descriptions.Item label="Type">
            <Tag color={invoice.invoiceType === 'purchase' ? 'blue' : 'green'}>
              {invoice.invoiceType.toUpperCase()}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={invoice.status === 'paid' ? 'green' : invoice.status === 'overdue' ? 'red' : 'orange'}>
              {invoice.status.toUpperCase()}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Invoice Date">{new Date(invoice.invoiceDate).toLocaleDateString()}</Descriptions.Item>
          <Descriptions.Item label="Due Date">{new Date(invoice.dueDate).toLocaleDateString()}</Descriptions.Item>
          <Descriptions.Item label="Period">
            {new Date(invoice.startDate).toLocaleDateString()} - {new Date(invoice.endDate).toLocaleDateString()}
          </Descriptions.Item>
        </Descriptions>

        <Descriptions title="Vendor Information" bordered style={{ marginTop: 16 }}>
          <Descriptions.Item label="Name">{invoice.vendor.name}</Descriptions.Item>
          <Descriptions.Item label="Code">{invoice.vendor.code}</Descriptions.Item>
          <Descriptions.Item label="Contact">{invoice.vendor.contactPerson}</Descriptions.Item>
          <Descriptions.Item label="GST">{invoice.vendor.gstNumber}</Descriptions.Item>
        </Descriptions>

        <Descriptions title="Plant Information" bordered style={{ marginTop: 16 }}>
          <Descriptions.Item label="Name">{invoice.plant.name}</Descriptions.Item>
          <Descriptions.Item label="Code">{invoice.plant.code}</Descriptions.Item>
          <Descriptions.Item label="Address">{invoice.plant.address}</Descriptions.Item>
        </Descriptions>

        {invoice.invoiceType === 'purchase' && invoice.materialBreakdown && (
          <Card title="Material Breakdown" style={{ marginTop: 16 }}>
            <Table
              dataSource={invoice.materialBreakdown}
              columns={[
                { title: 'Material', dataIndex: 'materialName', key: 'materialName' },
                { title: 'Total Qty (kg)', dataIndex: 'totalQuantity', key: 'totalQuantity', render: (qty: number) => qty.toFixed(2) },
                { title: 'Moisture (kg)', dataIndex: 'totalMoistureQuantity', key: 'moisture', render: (qty: number) => qty.toFixed(2) },
                { title: 'Dust (kg)', dataIndex: 'totalDustQuantity', key: 'dust', render: (qty: number) => qty.toFixed(2) },
                { title: 'Final Qty (kg)', dataIndex: 'finalQuantity', key: 'finalQty', render: (qty: number) => qty.toFixed(2) },
                { title: 'Rate (₹/kg)', dataIndex: 'rate', key: 'rate', render: (rate: number) => `₹${rate.toFixed(2)}` },
                { title: 'Amount (₹)', dataIndex: 'totalAmount', key: 'amount', render: (amount: number) => `₹${amount.toFixed(2)}` }
              ]}
              pagination={false}
              size="small"
            />
          </Card>
        )}

        {invoice.invoiceType === 'sale' && invoice.paletteBreakdown && (
          <Card title="Palette Breakdown" style={{ marginTop: 16 }}>
            <Descriptions bordered>
              <Descriptions.Item label="Total Bags">{invoice.paletteBreakdown.totalBags || 0}</Descriptions.Item>
              <Descriptions.Item label="Weight per Bag (kg)">{invoice.paletteBreakdown.weightPerBag?.toFixed(2) || 0}</Descriptions.Item>
              <Descriptions.Item label="Total Packed Weight (kg)">{invoice.paletteBreakdown.totalPackedWeight?.toFixed(2) || 0}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        <Card title="Summary" style={{ marginTop: 16 }}>
          <Descriptions bordered>
            <Descriptions.Item label="Total Quantity (kg)">{invoice.totalQuantity.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="Total Amount (₹)">₹{invoice.totalAmount.toFixed(2)}</Descriptions.Item>
          </Descriptions>
        </Card>
      </Card>
    </div>
  );
};

export default InvoiceDetail;
```

## CSS Styling

```css
/* invoice-generation-form.css */
.invoice-generation-form {
  padding: 24px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  align-items: center;
}

.material-rates-section,
.palette-rates-section {
  margin: 16px 0;
  padding: 16px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fafafa;
}

.rate-input {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.rate-input label {
  min-width: 120px;
  font-weight: 500;
}

.available-entries {
  margin-top: 24px;
}

.available-entries h3 {
  margin-bottom: 16px;
  color: #1890ff;
}

/* invoice-list.css */
.invoice-list {
  padding: 24px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* invoice-detail.css */
.invoice-detail {
  padding: 24px;
}

.invoice-detail .ant-card {
  margin-bottom: 16px;
}

.invoice-detail .ant-descriptions-item-label {
  font-weight: 600;
  background: #fafafa;
}
```

## Error Handling

### Common Error Scenarios

1. **Flagged Entries**

   ```typescript
   // Error message: "Cannot create invoice. The following entries are flagged and need to be unflagged first: ENTRY-001, ENTRY-002"

   // Frontend should:
   // 1. Show error message to user
   // 2. Provide link to entry management page
   // 3. Allow user to unflag entries and retry
   ```

2. **Missing Material Rates**

   ```typescript
   // Error message: "Rate not provided for material: Crude Oil"

   // Frontend should:
   // 1. Highlight missing rate fields
   // 2. Show validation errors
   // 3. Prevent form submission
   ```

3. **No Entries Found**

   ```typescript
   // Error message: "No entries found for the specified criteria"

   // Frontend should:
   // 1. Show informative message
   // 2. Suggest adjusting date range or filters
   // 3. Provide quick filter options
   ```

## Best Practices

### 1. **Form Validation**

- Implement client-side validation for all required fields
- Show real-time validation feedback
- Disable submit button until all required fields are filled

### 2. **User Experience**

- Show loading states during API calls
- Provide clear success/error messages
- Implement optimistic updates where appropriate

### 3. **Data Management**

- Cache available entries to reduce API calls
- Implement proper error boundaries
- Handle network failures gracefully

### 4. **Accessibility**

- Use proper ARIA labels
- Ensure keyboard navigation works
- Provide screen reader support

## Testing Checklist

- [ ] Form validation works correctly
- [ ] Date range selection functions properly
- [ ] Material rates are properly captured
- [ ] Palette rates are properly captured
- [ ] Available entries are filtered correctly
- [ ] Invoice generation works for both types
- [ ] PDF generation and download works
- [ ] Error handling displays appropriate messages
- [ ] Loading states work correctly
- [ ] Responsive design works on mobile

## Performance Considerations

1. **Pagination**: Use pagination for large entry lists
2. **Debouncing**: Debounce search/filter inputs
3. **Caching**: Cache vendor, plant, and material data
4. **Lazy Loading**: Load invoice details on demand
5. **Optimistic Updates**: Update UI immediately, sync with backend

This integration guide provides everything needed to implement the enhanced invoice generation system in your frontend application. The system is designed to be user-friendly, robust, and scalable.
