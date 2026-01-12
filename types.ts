
export interface BusinessInfo {
  name: string;
  address: string;
  email: string;
  phone?: string;
  taxNumber?: string;
  bankDetails?: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  address?: string;
  phone?: string;
  taxNumber?: string;
}

export interface LineItem {
  id: string;
  description: string;
  subDescription?: string;
  quantity: number;
  rate: number;
  total: number;
  unit?: string; // e.g., 'h', 'pcs', 'kg'
}

export interface Invoice {
  businessInfo: BusinessInfo;
  customerName: string;
  customerAddress?: string;
  customerTaxNumber?: string;
  date: string;
  deliveryDate?: string;
  dueDate?: string;
  invoiceNumber: string;
  items: LineItem[];
  currency: string;
  notes?: string;
  terms?: string;
}

export interface AIParsedInvoice {
  customerName?: string;
  items?: Array<{
    description: string;
    subDescription?: string;
    quantity: number;
    rate: number;
    unit?: string;
  }>;
}
