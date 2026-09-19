import { McpHostService } from './mcp-host.service';
import type { DbService } from '../db/db.service';

/**
 * This spec exercises the REAL MCP stack — SDK server, SDK client, actual
 * protocol handshake over the in-memory transport — with only Postgres
 * stubbed out. It is the strongest offline proof that the protocol wiring
 * works: schemas serialize, tools are discoverable, calls round-trip, and
 * error results carry isError instead of throwing.
 */
describe('McpHostService (protocol round-trip)', () => {
  let service: McpHostService;
  let dbQueries: string[];

  beforeEach(() => {
    dbQueries = [];
    const dbStub = {
      readonlyQuery: (sql: string) => {
        dbQueries.push(sql);
        return Promise.resolve({
          rows: [{ city: 'Dubai', total: '2482.00' }],
          rowCount: 1,
        });
      },
    } as unknown as DbService;
    service = new McpHostService(dbStub);
  });

  it('exposes exactly the logistics scenario\'s allowlisted tools over MCP list_tools, with schemas', async () => {
    const tools = await service.listToolsForOllama('logistics');
    const names = tools.map((tool) => tool.function.name).sort();
    expect(names).toEqual(
      [
        'check_delivery_sla',
        'create_escalation',
        'find_alternative_vehicle',
        'find_shipment',
        'get_warehouse_status',
        'get_weather',
        'list_driver_status',
        'notify_customer',
      ].sort(),
    );

    for (const tool of tools) {
      expect(tool.type).toBe('function');
      expect(tool.function.description.length).toBeGreaterThan(0);
      // inputSchema arrives as JSON Schema over the protocol — this is what
      // gets handed to Ollama verbatim.
      expect((tool.function.parameters as { type: string }).type).toBe(
        'object',
      );
    }
  });

  it("exposes exactly the sales scenario's allowlisted tools", async () => {
    const tools = await service.listToolsForOllama('sales');
    const names = tools.map((tool) => tool.function.name).sort();
    expect(names).toEqual(
      [
        'calculate',
        'check_availability',
        'check_pricing',
        'create_lead',
        'find_customer',
        'list_products',
        'schedule_meeting',
      ].sort(),
    );
  });

  it("exposes exactly the service scenario's allowlisted tools", async () => {
    const tools = await service.listToolsForOllama('service');
    const names = tools.map((tool) => tool.function.name).sort();
    expect(names).toEqual(
      [
        'calculate',
        'check_customer_history',
        'check_policy',
        'create_case',
        'get_delivery_status',
        'get_order',
      ].sort(),
    );
  });

  it('keeps query_database registered and directly callable even though no scenario allowlists it', async () => {
    // Retired from the scenario picker (none of the 3 scenarios fit it),
    // but the tool, its tests and its DB wiring stay in the repo — not
    // returned by listToolsForOllama for any scenario, but callTool()
    // doesn't filter, so it's still reachable directly.
    const logisticsTools = await service.listToolsForOllama('logistics');
    const salesTools = await service.listToolsForOllama('sales');
    const serviceTools = await service.listToolsForOllama('service');
    for (const tools of [logisticsTools, salesTools, serviceTools]) {
      expect(tools.map((t) => t.function.name)).not.toContain('query_database');
    }

    const outcome = await service.callTool('query_database', {
      sql: 'SELECT 1',
    });
    expect(outcome.isError).toBe(false);
  });

  it('round-trips a calculator call through the protocol', async () => {
    const outcome = await service.callTool('calculate', {
      expression: '(449 * 3) * 1.05',
    });
    expect(outcome.isError).toBe(false);
    const parsed = JSON.parse(outcome.text) as {
      expression: string;
      value: number;
    };
    expect(parsed.expression).toBe('(449 * 3) * 1.05');
    expect(parsed.value).toBeCloseTo(1414.35, 6); // IEEE 754 — not exactly 1414.35
  });

  it('returns calculator failures as isError results, not throws', async () => {
    const outcome = await service.callTool('calculate', { expression: '1/0' });
    expect(outcome.isError).toBe(true);
    expect(outcome.text).toMatch(/division by zero/i);
  });

  it('guards SQL before it reaches the database', async () => {
    const outcome = await service.callTool('query_database', {
      sql: 'DROP TABLE customers',
    });
    expect(outcome.isError).toBe(true);
    expect(outcome.text).toMatch(/read queries/i);
    expect(dbQueries).toHaveLength(0); // never reached the db layer
  });

  it('executes guarded SELECTs and returns rows as JSON text', async () => {
    const outcome = await service.callTool('query_database', {
      sql: 'SELECT city, sum(quantity) AS total FROM x GROUP BY city',
    });
    expect(outcome.isError).toBe(false);
    expect(dbQueries[0]).toMatch(/^SELECT \* FROM \(/);
    expect(dbQueries[0]).toMatch(/LIMIT 100$/);
    const parsed = JSON.parse(outcome.text) as {
      rowCount: number;
      rows: unknown[];
    };
    expect(parsed.rowCount).toBe(1);
  });

  it('reports an unknown tool as an error outcome', async () => {
    const outcome = await service.callTool('launch_missiles', {});
    expect(outcome.isError).toBe(true);
  });
});
