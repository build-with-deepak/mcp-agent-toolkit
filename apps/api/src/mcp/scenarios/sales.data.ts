/**
 * In-memory mock data for the Sales / Lead Qualification Agent scenario
 * (Al Noor Trading Co., a UAE B2B distributor). Same "structured
 * in-process data, not a database" philosophy as logistics.data.ts.
 */

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  city: string;
  tier: 'standard' | 'enterprise';
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unitPriceUsd: number;
  stockUnits: number;
}

export interface Lead {
  id: string;
  customerId: string;
  productIds: string[];
  notes: string;
  status: 'new' | 'qualified' | 'meeting_scheduled';
  createdAtIso: string;
}

export interface Meeting {
  id: string;
  customerId: string;
  whenIso: string;
  notes: string;
}

export const customers: Customer[] = [
  { id: 'CUST-01', name: 'Ahmed Qasimi', company: 'Qasimi Hardware Trading', email: 'ahmed@qasimihardware.ae', city: 'Dubai', tier: 'enterprise' },
  { id: 'CUST-02', name: 'Sara Al Blooshi', company: 'Blooshi Retail Group', email: 'sara@blooshiretail.ae', city: 'Abu Dhabi', tier: 'standard' },
  { id: 'CUST-03', name: 'Michael Costa', company: 'Costa Build Supplies', email: 'michael@costabuild.ae', city: 'Sharjah', tier: 'standard' },
  { id: 'CUST-04', name: 'Noora Al Zaabi', company: 'Zaabi Industrial', email: 'noora@zaabiindustrial.ae', city: 'Dubai', tier: 'enterprise' },
  { id: 'CUST-05', name: 'Ravi Menon', company: 'Menon Logistics Equipment', email: 'ravi@menonequip.ae', city: 'Ajman', tier: 'standard' },
];

export const products: Product[] = [
  { id: 'PRD-01', name: 'Industrial barcode scanner', category: 'warehouse-tech', unitPriceUsd: 149, stockUnits: 340 },
  { id: 'PRD-02', name: 'Pallet jack, manual, 2.5t', category: 'warehouse-equipment', unitPriceUsd: 210, stockUnits: 58 },
  { id: 'PRD-03', name: 'GPS fleet tracker', category: 'warehouse-tech', unitPriceUsd: 89, stockUnits: 512 },
  { id: 'PRD-04', name: 'Heavy-duty shelving unit', category: 'warehouse-equipment', unitPriceUsd: 320, stockUnits: 24 },
  { id: 'PRD-05', name: 'Thermal label printer', category: 'warehouse-tech', unitPriceUsd: 175, stockUnits: 96 },
  { id: 'PRD-06', name: 'Loading dock leveler', category: 'warehouse-equipment', unitPriceUsd: 1450, stockUnits: 6 },
];

export const leads: Lead[] = [];
export const meetings: Meeting[] = [];

export function findCustomer(query: string): Customer[] {
  const q = query.toLowerCase();
  return customers.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q),
  );
}

export function listProducts(category?: string): Product[] {
  return category
    ? products.filter((p) => p.category.toLowerCase() === category.toLowerCase())
    : products;
}

export interface PricingQuote {
  productId: string;
  unitPriceUsd: number;
  quantity: number;
  discountPercent: number;
  totalUsd: number;
}

/** Volume discount tiers — the kind of thing a sales agent needs to know
 * without asking a human every time. */
export function checkPricing(productId: string, quantity: number): PricingQuote | undefined {
  const product = products.find((p) => p.id === productId);
  if (!product) return undefined;
  const discountPercent = quantity >= 100 ? 15 : quantity >= 25 ? 8 : quantity >= 10 ? 3 : 0;
  const totalUsd = Math.round(product.unitPriceUsd * quantity * (1 - discountPercent / 100) * 100) / 100;
  return { productId, unitPriceUsd: product.unitPriceUsd, quantity, discountPercent, totalUsd };
}

export interface AvailabilityCheck {
  productId: string;
  requestedQuantity: number;
  inStock: boolean;
  stockUnits: number;
}

export function checkAvailability(productId: string, quantity: number): AvailabilityCheck | undefined {
  const product = products.find((p) => p.id === productId);
  if (!product) return undefined;
  return {
    productId,
    requestedQuantity: quantity,
    inStock: product.stockUnits >= quantity,
    stockUnits: product.stockUnits,
  };
}

export function createLead(customerId: string, productIds: string[], notes: string): Lead {
  const lead: Lead = {
    id: `LEAD-${String(leads.length + 1).padStart(4, '0')}`,
    customerId,
    productIds,
    notes,
    status: 'new',
    createdAtIso: new Date().toISOString(),
  };
  leads.push(lead);
  return lead;
}

export function scheduleMeeting(customerId: string, whenIso: string, notes: string): Meeting {
  const meeting: Meeting = {
    id: `MTG-${String(meetings.length + 1).padStart(4, '0')}`,
    customerId,
    whenIso,
    notes,
  };
  meetings.push(meeting);
  const lead = [...leads].reverse().find((l) => l.customerId === customerId);
  if (lead) lead.status = 'meeting_scheduled';
  return meeting;
}
