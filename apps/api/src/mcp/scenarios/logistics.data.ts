/**
 * In-memory mock data for the Logistics Exception Agent scenario (Dubai
 * Logistics Co.). Deliberately not a database — these tools are typed
 * function calls, not "the LLM writes SQL" (that's what query_database
 * demonstrates), so structured in-process data is the honest choice here:
 * nothing about "genuine MCP tool calls" depends on the data living in
 * Postgres. Rebuilt fresh on every process restart, same philosophy as
 * DocumentsService's in-memory registry in the RAG demo.
 */

export interface Shipment {
  id: string;
  customerName: string;
  originWarehouseId: string;
  destinationCity: string;
  status: 'pending' | 'in_transit' | 'customs_clearance' | 'delayed' | 'delivered';
  etaIso: string;
  driverId: string | null;
  slaHours: number;
  hoursElapsed: number;
  lastUpdate: string;
}

export interface Driver {
  id: string;
  name: string;
  status: 'available' | 'on_route' | 'off_duty';
  vehicleType: string;
  currentCity: string;
}

export interface Warehouse {
  id: string;
  name: string;
  city: string;
  status: 'operational' | 'delayed' | 'closed';
  capacityUsedPercent: number;
}

export interface Escalation {
  id: string;
  shipmentId: string;
  reason: string;
  createdAtIso: string;
  status: 'open' | 'resolved';
}

export const warehouses: Warehouse[] = [
  { id: 'WH-DXB', name: 'Dubai Main Hub', city: 'Dubai', status: 'operational', capacityUsedPercent: 62 },
  { id: 'WH-AUH', name: 'Abu Dhabi Depot', city: 'Abu Dhabi', status: 'operational', capacityUsedPercent: 78 },
  { id: 'WH-JBL', name: 'Jebel Ali Port Facility', city: 'Dubai', status: 'delayed', capacityUsedPercent: 91 },
  { id: 'WH-SHJ', name: 'Sharjah Overflow', city: 'Sharjah', status: 'operational', capacityUsedPercent: 45 },
];

export const drivers: Driver[] = [
  { id: 'DRV-101', name: 'Rashid Al Marri', status: 'on_route', vehicleType: 'Box truck', currentCity: 'Dubai' },
  { id: 'DRV-102', name: 'Fatima Hassan', status: 'available', vehicleType: 'Van', currentCity: 'Dubai' },
  { id: 'DRV-103', name: 'Omar Sultan', status: 'available', vehicleType: 'Van', currentCity: 'Sharjah' },
  { id: 'DRV-104', name: 'Layla Ibrahim', status: 'off_duty', vehicleType: 'Box truck', currentCity: 'Abu Dhabi' },
  { id: 'DRV-105', name: 'Khalid Nasser', status: 'available', vehicleType: 'Refrigerated van', currentCity: 'Abu Dhabi' },
  { id: 'DRV-106', name: 'Mariam Saeed', status: 'on_route', vehicleType: 'Van', currentCity: 'Dubai' },
];

export const shipments: Shipment[] = [
  {
    id: 'DXB-1048',
    customerName: 'Al Futtaim Retail',
    originWarehouseId: 'WH-JBL',
    destinationCity: 'Abu Dhabi',
    status: 'delayed',
    etaIso: '2026-09-20T14:00:00.000Z',
    driverId: null,
    slaHours: 72,
    hoursElapsed: 58,
    lastUpdate: 'Held at Jebel Ali — warehouse over capacity (91%).',
  },
  {
    id: 'DXB-1049',
    customerName: 'Carrefour UAE',
    originWarehouseId: 'WH-DXB',
    destinationCity: 'Dubai',
    status: 'in_transit',
    etaIso: '2026-09-19T20:00:00.000Z',
    driverId: 'DRV-101',
    slaHours: 48,
    hoursElapsed: 12,
    lastUpdate: 'Left Dubai Main Hub, en route to destination.',
  },
  {
    id: 'DXB-1050',
    customerName: 'Lulu Hypermarket',
    originWarehouseId: 'WH-JBL',
    destinationCity: 'Muscat',
    status: 'customs_clearance',
    etaIso: '2026-09-22T09:00:00.000Z',
    driverId: null,
    slaHours: 96,
    hoursElapsed: 30,
    lastUpdate: 'In customs clearance at the Oman border, 26 hours so far.',
  },
  {
    id: 'DXB-1051',
    customerName: 'Spinneys',
    originWarehouseId: 'WH-SHJ',
    destinationCity: 'Sharjah',
    status: 'delivered',
    etaIso: '2026-09-18T16:00:00.000Z',
    driverId: 'DRV-103',
    slaHours: 48,
    hoursElapsed: 31,
    lastUpdate: 'Delivered, signed for by receiving dock.',
  },
  {
    id: 'DXB-1052',
    customerName: 'Union Coop',
    originWarehouseId: 'WH-AUH',
    destinationCity: 'Al Ain',
    status: 'pending',
    etaIso: '2026-09-21T12:00:00.000Z',
    driverId: null,
    slaHours: 48,
    hoursElapsed: 2,
    lastUpdate: 'Booked, awaiting warehouse pickup scan.',
  },
];

export const escalations: Escalation[] = [];

export function findShipment(shipmentId: string): Shipment | undefined {
  return shipments.find((s) => s.id.toLowerCase() === shipmentId.toLowerCase());
}

export function listDriverStatus(city?: string): Driver[] {
  return city ? drivers.filter((d) => d.currentCity.toLowerCase() === city.toLowerCase()) : drivers;
}

export function getWarehouseStatus(warehouseId: string): Warehouse | undefined {
  return warehouses.find((w) => w.id.toLowerCase() === warehouseId.toLowerCase());
}

export interface SlaCheck {
  shipmentId: string;
  slaHours: number;
  hoursElapsed: number;
  percentUsed: number;
  atRisk: boolean;
  breached: boolean;
}

export function checkDeliverySla(shipmentId: string): SlaCheck | undefined {
  const shipment = findShipment(shipmentId);
  if (!shipment) return undefined;
  const percentUsed = Math.round((shipment.hoursElapsed / shipment.slaHours) * 100);
  return {
    shipmentId: shipment.id,
    slaHours: shipment.slaHours,
    hoursElapsed: shipment.hoursElapsed,
    percentUsed,
    atRisk: percentUsed >= 75 && shipment.status !== 'delivered',
    breached: percentUsed >= 100 && shipment.status !== 'delivered',
  };
}

/** An available driver in the given city — the operations SOP's first move
 * once a shipment is flagged at risk. */
export function findAlternativeVehicle(city: string): Driver | undefined {
  return drivers.find(
    (d) => d.status === 'available' && d.currentCity.toLowerCase() === city.toLowerCase(),
  );
}

export function createEscalation(shipmentId: string, reason: string): Escalation {
  const escalation: Escalation = {
    id: `ESC-${String(escalations.length + 1).padStart(4, '0')}`,
    shipmentId,
    reason,
    createdAtIso: new Date().toISOString(),
    status: 'open',
  };
  escalations.push(escalation);
  return escalation;
}
