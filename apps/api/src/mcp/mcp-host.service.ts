import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DbService } from '../db/db.service';
import { evaluate } from './tools/calculator';
import { guardReadOnlySql, MAX_RESULT_ROWS } from './tools/sql-guard';
import { fetchCurrentWeather } from './tools/weather';
import {
  checkDeliverySla,
  createEscalation,
  findAlternativeVehicle,
  findShipment,
  getWarehouseStatus,
  listDriverStatus,
} from './scenarios/logistics.data';
import {
  checkAvailability,
  checkPricing,
  createLead,
  findCustomer,
  listProducts,
  scheduleMeeting,
} from './scenarios/sales.data';
import {
  checkCustomerHistory,
  checkPolicy,
  createCase,
  getDeliveryStatus,
  getOrder,
} from './scenarios/service.data';
import { getAgentScenario, ScenarioKey } from './scenarios/registry';

export interface OllamaToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
}

export interface ToolCallOutcome {
  text: string;
  isError: boolean;
}

/**
 * A real MCP server and a real MCP client, connected over the SDK's
 * in-memory transport inside this process.
 *
 * Why bother with MCP at all for tools this service could just call as
 * functions: the protocol boundary is the demonstration. The agent loop
 * (agent.service.ts) talks ONLY to the MCP client — it discovers tools via
 * listTools() and invokes them via callTool(), exactly as it would against
 * an external MCP server over stdio or HTTP. Moving a tool out of this
 * process would change one transport line, not the agent. In-memory is the
 * right transport for a single-VPS demo because it adds no ports, no
 * subprocess supervision and no serialization overhead — while keeping the
 * protocol contract fully real (the SDK validates schemas both ways).
 */
@Injectable()
export class McpHostService implements OnModuleInit {
  private readonly logger = new Logger(McpHostService.name);
  private readonly server: McpServer;
  private readonly client: Client;
  private ready: Promise<void> | null = null;

  constructor(private readonly db: DbService) {
    this.server = new McpServer({
      name: 'mcp-agent-toolkit',
      version: '1.0.0',
    });
    this.client = new Client({ name: 'agent-loop', version: '1.0.0' });
    this.registerCommerceTools();
    this.registerLogisticsTools();
    this.registerSalesTools();
    this.registerServiceTools();
  }

  onModuleInit(): void {
    // Kick off the handshake at boot but don't block boot on it.
    void this.ensureConnected();
  }

  /**
   * Every tool is registered once, at construction, on one long-lived
   * server — not one McpServer per scenario, which would triple handshake
   * bookkeeping for no protocol-fidelity gain (the SDK's schema validation
   * is identical either way). The only per-request cost of a scenario is
   * this filter: down to the active scenario's allowlisted tool names,
   * before the Ollama-facing schema is built.
   */
  async listToolsForOllama(scenarioKey: ScenarioKey): Promise<OllamaToolSchema[]> {
    await this.ensureConnected();
    const scenario = getAgentScenario(scenarioKey);
    const allowed = new Set(scenario?.toolNames ?? []);
    const { tools } = await this.client.listTools();
    return tools
      .filter((tool) => allowed.has(tool.name))
      .map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description ?? '',
          parameters: tool.inputSchema,
        },
      }));
  }

  /**
   * Invokes a tool through the MCP client. Tool failures come back as
   * `isError` results rather than throws — the agent loop feeds them to
   * the model as tool output, so the model can recover (retry a fixed SQL
   * query, pick another city) instead of the whole run dying.
   */
  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolCallOutcome> {
    await this.ensureConnected();
    try {
      const result = await this.client.callTool({ name, arguments: args });
      const text = (
        result.content as { type: string; text?: string }[] | undefined
      )
        ?.filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('\n');
      return { text: text || '(no output)', isError: result.isError === true };
    } catch (err) {
      // Protocol-level failure (unknown tool, schema mismatch) — still fed
      // back to the model as an error result, same recovery path.
      return {
        text: `Tool call failed: ${(err as Error).message}`,
        isError: true,
      };
    }
  }

  private ensureConnected(): Promise<void> {
    this.ready ??= (async () => {
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      await Promise.all([
        this.server.connect(serverTransport),
        this.client.connect(clientTransport),
      ]);
      this.logger.log(
        'MCP client ⇄ server handshake complete (in-memory transport).',
      );
    })();
    return this.ready;
  }

  private registerCommerceTools(): void {
    this.server.registerTool(
      'query_database',
      {
        title: 'Query the commerce database (read-only)',
        description:
          'Run a read-only SQL SELECT against a PostgreSQL commerce database. ' +
          'Tables: customers(id, name, city, country, created_at), ' +
          'products(id, name, category, price_usd), ' +
          'orders(id, customer_id, ordered_at, status), ' +
          'order_items(order_id, product_id, quantity, unit_price_usd). ' +
          `Results are capped at ${MAX_RESULT_ROWS} rows. Only SELECT/WITH is accepted.`,
        inputSchema: {
          sql: z.string().describe('A single SQL SELECT statement'),
        },
      },
      async ({ sql }) => {
        try {
          const guarded = guardReadOnlySql(sql);
          const { rows, rowCount } = await this.db.readonlyQuery(guarded);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ rowCount, rows }, null, 2),
              },
            ],
          };
        } catch (err) {
          return {
            content: [{ type: 'text', text: (err as Error).message }],
            isError: true,
          };
        }
      },
    );

    this.server.registerTool(
      'get_weather',
      {
        title: 'Current weather for a city',
        description:
          'Get the current weather (temperature °C, wind, humidity, conditions) for a named city.',
        inputSchema: { city: z.string().describe('City name, e.g. "Dubai"') },
      },
      async ({ city }) => {
        try {
          const weather = await fetchCurrentWeather(city);
          return {
            content: [{ type: 'text', text: JSON.stringify(weather, null, 2) }],
          };
        } catch (err) {
          return {
            content: [{ type: 'text', text: (err as Error).message }],
            isError: true,
          };
        }
      },
    );

    this.server.registerTool(
      'calculate',
      {
        title: 'Arithmetic calculator',
        description:
          'Evaluate an arithmetic expression. Supports + - * / % ^, parentheses, ' +
          'and the functions sqrt, abs, round, floor, ceil, min, max.',
        inputSchema: {
          expression: z.string().describe('e.g. "(449 * 3) * 1.05"'),
        },
      },
      ({ expression }) => {
        try {
          const value = evaluate(expression);
          return {
            content: [
              { type: 'text', text: JSON.stringify({ expression, value }) },
            ],
          };
        } catch (err) {
          return {
            content: [{ type: 'text', text: (err as Error).message }],
            isError: true,
          };
        }
      },
    );
  }

  /** Logistics Exception Agent scenario — Dubai Logistics Co. */
  private registerLogisticsTools(): void {
    this.server.registerTool(
      'find_shipment',
      {
        title: 'Look up a shipment',
        description: 'Find a shipment by its tracking ID (e.g. "DXB-1048") and return its current status, ETA, SLA and last update.',
        inputSchema: { shipmentId: z.string().describe('Tracking ID, e.g. "DXB-1048"') },
      },
      ({ shipmentId }) => notFoundAsError(findShipment(shipmentId), `No shipment with ID "${shipmentId}".`),
    );

    this.server.registerTool(
      'list_driver_status',
      {
        title: 'List driver status',
        description: 'List drivers and their current status (available, on_route, off_duty), optionally filtered to one city.',
        inputSchema: { city: z.string().optional().describe('Optional city filter, e.g. "Dubai"') },
      },
      ({ city }) => jsonResult(listDriverStatus(city)),
    );

    this.server.registerTool(
      'get_warehouse_status',
      {
        title: 'Get warehouse status',
        description: 'Look up a warehouse by ID (e.g. "WH-JBL") and return its operational status and capacity utilization.',
        inputSchema: { warehouseId: z.string().describe('Warehouse ID, e.g. "WH-JBL"') },
      },
      ({ warehouseId }) =>
        notFoundAsError(getWarehouseStatus(warehouseId), `No warehouse with ID "${warehouseId}".`),
    );

    this.server.registerTool(
      'check_delivery_sla',
      {
        title: 'Check a shipment against its delivery SLA',
        description: 'Compute how much of a shipment\'s SLA window has been used, and whether it is at risk of or has breached its SLA.',
        inputSchema: { shipmentId: z.string().describe('Tracking ID, e.g. "DXB-1048"') },
      },
      ({ shipmentId }) =>
        notFoundAsError(checkDeliverySla(shipmentId), `No shipment with ID "${shipmentId}".`),
    );

    this.server.registerTool(
      'find_alternative_vehicle',
      {
        title: 'Find an alternative vehicle',
        description: 'Find an available driver/vehicle in a given city — the first move once a shipment is flagged at risk, before escalating.',
        inputSchema: { city: z.string().describe('City to search in, e.g. "Dubai"') },
      },
      ({ city }) =>
        notFoundAsError(findAlternativeVehicle(city), `No available driver found in ${city}.`),
    );

    this.server.registerTool(
      'create_escalation',
      {
        title: 'Create a customer escalation',
        description: 'Open a customer escalation case for a shipment. Use only when no alternative vehicle is available.',
        inputSchema: {
          shipmentId: z.string().describe('Tracking ID, e.g. "DXB-1048"'),
          reason: z.string().describe('Why this shipment is being escalated'),
        },
      },
      ({ shipmentId, reason }) => jsonResult(createEscalation(shipmentId, reason)),
    );

    this.server.registerTool(
      'notify_customer',
      {
        title: 'Notify a customer (simulated)',
        description: 'Send a status update to a shipment\'s customer. Simulated for this demo — no message is actually sent.',
        inputSchema: {
          shipmentId: z.string().describe('Tracking ID, e.g. "DXB-1048"'),
          message: z.string().describe('The update to send'),
        },
      },
      ({ shipmentId, message }) =>
        jsonResult({ shipmentId, message, sent: true, simulated: true }),
    );
  }

  /** Sales / Lead Qualification Agent scenario — Al Noor Trading Co. */
  private registerSalesTools(): void {
    this.server.registerTool(
      'find_customer',
      {
        title: 'Find a customer',
        description: 'Search customers by name, company or email.',
        inputSchema: { query: z.string().describe('Name, company or email to search for') },
      },
      ({ query }) => jsonResult(findCustomer(query)),
    );

    this.server.registerTool(
      'list_products',
      {
        title: 'List products',
        description: 'List products for sale, optionally filtered by category ("warehouse-tech" or "warehouse-equipment").',
        inputSchema: { category: z.string().optional().describe('Optional category filter') },
      },
      ({ category }) => jsonResult(listProducts(category)),
    );

    this.server.registerTool(
      'check_pricing',
      {
        title: 'Check volume pricing',
        description: 'Get the unit price, volume discount and total for a product ID and quantity.',
        inputSchema: {
          productId: z.string().describe('Product ID, e.g. "PRD-01"'),
          quantity: z.number().int().positive().describe('Requested quantity'),
        },
      },
      ({ productId, quantity }) =>
        notFoundAsError(checkPricing(productId, quantity), `No product with ID "${productId}".`),
    );

    this.server.registerTool(
      'check_availability',
      {
        title: 'Check stock availability',
        description: 'Check whether a product ID has enough stock for a requested quantity.',
        inputSchema: {
          productId: z.string().describe('Product ID, e.g. "PRD-01"'),
          quantity: z.number().int().positive().describe('Requested quantity'),
        },
      },
      ({ productId, quantity }) =>
        notFoundAsError(checkAvailability(productId, quantity), `No product with ID "${productId}".`),
    );

    this.server.registerTool(
      'create_lead',
      {
        title: 'Create a lead',
        description: 'Record a new sales lead for a customer and one or more products of interest.',
        inputSchema: {
          customerId: z.string().describe('Customer ID, e.g. "CUST-01"'),
          productIds: z.array(z.string()).describe('Product IDs of interest'),
          notes: z.string().describe('Context for this lead'),
        },
      },
      ({ customerId, productIds, notes }) => jsonResult(createLead(customerId, productIds, notes)),
    );

    this.server.registerTool(
      'schedule_meeting',
      {
        title: 'Schedule a follow-up meeting',
        description: 'Schedule a follow-up meeting with a customer, marking their most recent lead as meeting_scheduled.',
        inputSchema: {
          customerId: z.string().describe('Customer ID, e.g. "CUST-01"'),
          whenIso: z.string().describe('ISO 8601 date/time for the meeting'),
          notes: z.string().describe('Meeting agenda or context'),
        },
      },
      ({ customerId, whenIso, notes }) => jsonResult(scheduleMeeting(customerId, whenIso, notes)),
    );
  }

  /** Customer Service Resolution Agent scenario — Al Noor Trading Co. */
  private registerServiceTools(): void {
    this.server.registerTool(
      'get_order',
      {
        title: 'Look up an order',
        description: 'Find an order by ID and return its items, status and order date.',
        inputSchema: { orderId: z.string().describe('Order ID, e.g. "ORD-5001"') },
      },
      ({ orderId }) => notFoundAsError(getOrder(orderId), `No order with ID "${orderId}".`),
    );

    this.server.registerTool(
      'get_delivery_status',
      {
        title: 'Get delivery status',
        description: 'Get the carrier status, expected delivery date and any delay for an order.',
        inputSchema: { orderId: z.string().describe('Order ID, e.g. "ORD-5001"') },
      },
      ({ orderId }) => notFoundAsError(getDeliveryStatus(orderId), `No delivery record for order "${orderId}".`),
    );

    this.server.registerTool(
      'check_policy',
      {
        title: "Check the company's written policy",
        description: 'Look up policy text by topic: "late-delivery-compensation", "damaged-goods", or "returns".',
        inputSchema: { topic: z.string().describe('Policy topic') },
      },
      ({ topic }) => notFoundAsError(checkPolicy(topic), `No policy found for topic "${topic}".`),
    );

    this.server.registerTool(
      'check_customer_history',
      {
        title: "Check a customer's case history",
        description: 'Get a customer\'s prior case count and lifetime value, for judging how a new case should be handled.',
        inputSchema: { customerId: z.string().describe('Customer ID, e.g. "CUST-01"') },
      },
      ({ customerId }) =>
        notFoundAsError(checkCustomerHistory(customerId), `No history found for customer "${customerId}".`),
    );

    this.server.registerTool(
      'create_case',
      {
        title: 'Open a resolved case',
        description: 'Open a case for an order with a reason and, if applicable, a compensation amount computed from policy.',
        inputSchema: {
          orderId: z.string().describe('Order ID, e.g. "ORD-5001"'),
          reason: z.string().describe('Reason for the case'),
          compensationUsd: z
            .number()
            .nullable()
            .describe('Compensation amount in USD, or null if none applies'),
        },
      },
      ({ orderId, reason, compensationUsd }) =>
        jsonResult(createCase(orderId, reason, compensationUsd)),
    );
  }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/** Shared not-found shape for lookups — `undefined` becomes an MCP error
 * result instead of `"undefined"` text, so the model gets a clear signal
 * to try a different ID rather than treating a miss as a normal answer. */
function notFoundAsError<T>(value: T | undefined, message: string) {
  if (value === undefined) {
    return { content: [{ type: 'text' as const, text: message }], isError: true };
  }
  return jsonResult(value);
}
