import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DbService } from '../db/db.service';
import { evaluate } from './tools/calculator';
import { guardReadOnlySql, MAX_RESULT_ROWS } from './tools/sql-guard';
import { fetchCurrentWeather } from './tools/weather';

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
    this.registerTools();
  }

  onModuleInit(): void {
    // Kick off the handshake at boot but don't block boot on it.
    void this.ensureConnected();
  }

  async listToolsForOllama(): Promise<OllamaToolSchema[]> {
    await this.ensureConnected();
    const { tools } = await this.client.listTools();
    return tools.map((tool) => ({
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

  private registerTools(): void {
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
}
