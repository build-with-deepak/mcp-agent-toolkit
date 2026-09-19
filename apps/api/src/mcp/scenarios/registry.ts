export type ScenarioKey = 'logistics' | 'sales' | 'service';

export interface ScenarioMeta {
  key: ScenarioKey;
  label: string;
  description: string;
  systemPrompt: string;
  /** Allowlist into the full set of tools registered on the MCP server —
   * McpHostService.listToolsForOllama() filters down to these. */
  toolNames: string[];
  suggestedPrompts: string[];
}

export const AGENT_SCENARIOS: ScenarioMeta[] = [
  {
    key: 'logistics',
    label: 'Logistics Exception Agent',
    description:
      'Dubai Logistics Co. — investigate a delayed shipment across warehouses, drivers and SLAs, then recommend and act on a fix.',
    systemPrompt:
      'You are an operations assistant for Dubai Logistics Co., a UAE freight and last-mile delivery company. ' +
      'You have tools to look up shipments, drivers, warehouses and delivery SLAs, check the weather at a ' +
      'destination, find an alternative vehicle, create a customer escalation, and notify a customer. ' +
      'Use tools to answer factually — never invent a shipment status, driver, or SLA number you could look up. ' +
      "When a shipment is at risk or delayed, follow the company's own escalation pattern: check the shipment, " +
      'check for an available alternative vehicle, and only escalate if no alternative exists. Answer concisely, ' +
      'and state which tool results your answer is based on.',
    toolNames: [
      'find_shipment',
      'list_driver_status',
      'get_warehouse_status',
      'check_delivery_sla',
      'find_alternative_vehicle',
      'create_escalation',
      'notify_customer',
      'get_weather',
    ],
    suggestedPrompts: [
      'Shipment DXB-1048 is delayed. Investigate what happened and recommend what to do.',
      'Which drivers are available in Dubai right now?',
      'Shipment DXB-1050 is heading to Muscat through customs — check the weather there and the shipment SLA.',
    ],
  },
  {
    key: 'sales',
    label: 'Sales / Lead Qualification Agent',
    description:
      'Al Noor Trading Co. — find a customer, check pricing and stock, and qualify a lead through to a scheduled meeting.',
    systemPrompt:
      'You are a sales assistant for Al Noor Trading Co., a UAE B2B distributor of warehouse equipment and ' +
      'technology. You have tools to find a customer, list products, check volume pricing, check stock ' +
      'availability, create a lead, and schedule a follow-up meeting. Use tools to answer factually — never ' +
      'invent a price, stock level, or customer detail you could look up. Use the calculator for any quote math ' +
      'beyond what check_pricing already returns. Answer concisely, and state which tool results your answer is ' +
      'based on.',
    toolNames: [
      'find_customer',
      'list_products',
      'check_pricing',
      'check_availability',
      'create_lead',
      'schedule_meeting',
      'calculate',
    ],
    suggestedPrompts: [
      'Qasimi Hardware Trading wants 50 barcode scanners — check pricing and stock, then create a lead.',
      "Find Costa Build Supplies and tell me what tier customer they are.",
      'Quote 30 GPS fleet trackers for Zaabi Industrial and schedule a follow-up meeting for next week.',
    ],
  },
  {
    key: 'service',
    label: 'Customer Service Resolution Agent',
    description:
      "Al Noor Trading Co. — resolve a customer's case using their order, delivery status, and the company's own compensation policy.",
    systemPrompt:
      'You are a customer service assistant for Al Noor Trading Co. You have tools to look up an order, its ' +
      "delivery status, the company's written policies, a customer's case history, the calculator, and a way to " +
      'open a resolved case with a compensation amount. Use tools to answer factually — never invent an order ' +
      'status or a compensation number; compute it from the actual policy text and the calculator. Answer ' +
      'concisely, and state which tool results your answer is based on.',
    toolNames: [
      'get_order',
      'get_delivery_status',
      'check_policy',
      'check_customer_history',
      'create_case',
      'calculate',
    ],
    suggestedPrompts: [
      'Order ORD-5001 is delayed — check the policy and calculate what compensation the customer is owed.',
      "Customer CUST-03 wants to open a case for order ORD-5004. What's their history, and what should we offer?",
      "What's our returns policy, and does order ORD-5002 qualify?",
    ],
  },
];

export function getAgentScenario(key: string): ScenarioMeta | undefined {
  return AGENT_SCENARIOS.find((scenario) => scenario.key === key);
}
