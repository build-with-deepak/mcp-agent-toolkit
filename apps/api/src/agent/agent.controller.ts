import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SseWriter } from '../common/sse';
import { McpHostService } from '../mcp/mcp-host.service';
import { AGENT_SCENARIOS } from '../mcp/scenarios/registry';
import { AgentService } from './agent.service';
import { AskDto } from './dto/ask.dto';
import { AgentScenarioDto } from './dto/agent-scenario.dto';

@Controller('api/agent')
export class AgentController {
  constructor(
    private readonly agent: AgentService,
    private readonly mcp: McpHostService,
  ) {}

  /**
   * The picker and preview modal need each scenario's label, description,
   * suggested prompts AND tool list before any question is asked — the
   * `session` SSE event only carries the active scenario's tools, and only
   * after a run starts, so a preview-before-you-ask UI needs this separate
   * route. Tool descriptions are read live from McpHostService rather than
   * duplicated here, so they can't drift from what a run actually uses.
   */
  @Get('scenarios')
  async scenarios(): Promise<AgentScenarioDto[]> {
    return Promise.all(
      AGENT_SCENARIOS.map(async (scenario) => {
        const tools = await this.mcp.listToolsForOllama(scenario.key);
        return {
          key: scenario.key,
          label: scenario.label,
          description: scenario.description,
          suggestedPrompts: scenario.suggestedPrompts,
          tools: tools.map((tool) => ({
            name: tool.function.name,
            description: tool.function.description,
          })),
        };
      }),
    );
  }

  /** POST + manual SSE — see the note on SseWriter for why not @Sse. */
  @Post('stream')
  async stream(@Body() dto: AskDto, @Res() res: Response): Promise<void> {
    const writer = new SseWriter(res);
    try {
      await this.agent.run(dto.scenarioKey, dto.question, (type, data) =>
        writer.send(type, data),
      );
    } catch (err) {
      // run() is designed not to throw; backstop so a surprise never leaves
      // the response hanging open.
      writer.send('error', {
        message: (err as Error).message || 'Something went wrong.',
      });
    } finally {
      writer.end();
    }
  }
}
