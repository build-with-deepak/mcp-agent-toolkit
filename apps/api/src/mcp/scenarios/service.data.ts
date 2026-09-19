/**
 * In-memory mock data for the Customer Service Resolution Agent scenario —
 * the same Al Noor Trading Co. universe as sales.data.ts, on its post-sale
 * side. Orders reference customer IDs from sales.data.ts so a case can be
 * resolved against a real customer's real order history.
 */

export interface Order {
  id: string;
  customerId: string;
  items: { productName: string; qty: number; unitPriceUsd: number }[];
  status: 'processing' | 'shipped' | 'delivered' | 'delayed';
  orderedAtIso: string;
}

export interface DeliveryStatus {
  orderId: string;
  carrierStatus: string;
  expectedIso: string;
  delayHours: number;
}

export interface Policy {
  topic: string;
  text: string;
}

export interface CustomerHistory {
  customerId: string;
  priorCases: number;
  lifetimeValueUsd: number;
}

export interface Case {
  id: string;
  orderId: string;
  reason: string;
  compensationUsd: number | null;
  status: 'open' | 'resolved';
}

export const orders: Order[] = [
  {
    id: 'ORD-5001',
    customerId: 'CUST-01',
    items: [{ productName: 'Industrial barcode scanner', qty: 20, unitPriceUsd: 149 }],
    status: 'delayed',
    orderedAtIso: '2026-09-10T09:00:00.000Z',
  },
  {
    id: 'ORD-5002',
    customerId: 'CUST-02',
    items: [{ productName: 'Pallet jack, manual, 2.5t', qty: 3, unitPriceUsd: 210 }],
    status: 'delivered',
    orderedAtIso: '2026-09-05T09:00:00.000Z',
  },
  {
    id: 'ORD-5003',
    customerId: 'CUST-04',
    items: [
      { productName: 'Heavy-duty shelving unit', qty: 8, unitPriceUsd: 320 },
      { productName: 'GPS fleet tracker', qty: 15, unitPriceUsd: 89 },
    ],
    status: 'shipped',
    orderedAtIso: '2026-09-14T09:00:00.000Z',
  },
  {
    id: 'ORD-5004',
    customerId: 'CUST-03',
    items: [{ productName: 'Thermal label printer', qty: 5, unitPriceUsd: 175 }],
    status: 'delayed',
    orderedAtIso: '2026-09-08T09:00:00.000Z',
  },
];

export const deliveryStatuses: DeliveryStatus[] = [
  { orderId: 'ORD-5001', carrierStatus: 'Held at origin warehouse, over capacity', expectedIso: '2026-09-21T00:00:00.000Z', delayHours: 30 },
  { orderId: 'ORD-5002', carrierStatus: 'Delivered on schedule', expectedIso: '2026-09-07T00:00:00.000Z', delayHours: 0 },
  { orderId: 'ORD-5003', carrierStatus: 'In transit, on schedule', expectedIso: '2026-09-17T00:00:00.000Z', delayHours: 0 },
  { orderId: 'ORD-5004', carrierStatus: 'Customs delay on imported parts', expectedIso: '2026-09-19T00:00:00.000Z', delayHours: 48 },
];

/** Mirrors Gulf Business Services' RAG-scenario compensation logic in
 * spirit — a fixed, lookupable policy rather than a rule the model invents. */
export const policies: Policy[] = [
  {
    topic: 'late-delivery-compensation',
    text: 'A delayed order qualifies for compensation once the delay exceeds 24 hours past the original expected date: 5% of order value per full day late, capped at 25% of order value. Compensation is issued as account credit, not a refund, unless the customer explicitly requests a refund.',
  },
  {
    topic: 'damaged-goods',
    text: 'Damaged goods are eligible for a full replacement or refund if reported within 7 days of delivery with photo evidence. No compensation is issued for damage reported after 7 days without a documented exception approved by a supervisor.',
  },
  {
    topic: 'returns',
    text: 'Unopened stock items may be returned within 14 days for a full refund minus a 10% restocking fee. Custom or special-order items are non-returnable.',
  },
];

export const customerHistories: CustomerHistory[] = [
  { customerId: 'CUST-01', priorCases: 1, lifetimeValueUsd: 42000 },
  { customerId: 'CUST-02', priorCases: 0, lifetimeValueUsd: 8500 },
  { customerId: 'CUST-03', priorCases: 3, lifetimeValueUsd: 15200 },
  { customerId: 'CUST-04', priorCases: 0, lifetimeValueUsd: 61000 },
  { customerId: 'CUST-05', priorCases: 2, lifetimeValueUsd: 6300 },
];

export const cases: Case[] = [];

export function getOrder(orderId: string): Order | undefined {
  return orders.find((o) => o.id.toLowerCase() === orderId.toLowerCase());
}

export function getDeliveryStatus(orderId: string): DeliveryStatus | undefined {
  return deliveryStatuses.find((d) => d.orderId.toLowerCase() === orderId.toLowerCase());
}

export function checkPolicy(topic: string): Policy | undefined {
  return policies.find((p) => p.topic.toLowerCase() === topic.toLowerCase());
}

export function checkCustomerHistory(customerId: string): CustomerHistory | undefined {
  return customerHistories.find((h) => h.customerId === customerId);
}

export function createCase(orderId: string, reason: string, compensationUsd: number | null): Case {
  const record: Case = {
    id: `CASE-${String(cases.length + 1).padStart(4, '0')}`,
    orderId,
    reason,
    compensationUsd,
    status: compensationUsd !== null ? 'resolved' : 'open',
  };
  cases.push(record);
  return record;
}
