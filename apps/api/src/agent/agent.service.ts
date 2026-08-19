import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import { McpHostService, type OllamaToolSchema } from '../mcp/mcp-host.service';

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OllamaToolCall[];
}

export interface AgentEventSink {
  (type: string, data: unknown): void;
}

const SYSTEM_PROMPT =
  'You are a data assistant with access to tools: a read-only SQL database of a ' +
  'commerce dataset, a current-weather lookup, and a calculator. Use tools to ' +
  'answer factually — never invent numbers you could query or compute. When a ' +
  'tool returns an error, read the error, fix your input and try again rather ' +
  'than giving up. Answer concisely, and state which tool results your answer ' +
  'is based on.';

/**
 * The agent loop: model → tool calls → results → model, until the model
 * answers in prose or the step ceiling is hit.
 *
 * Loop steps are NON-streaming Ollama calls on purpose. Whether a response
 * is a tool call or the final answer is only knowable once it's complete,
 * and tool-call responses are short. What the visitor watches live is the
 * genuinely interesting stream — the tool invocations and their results as
 * SSE events, as they happen — not tokens of JSON being decoded. The final
 * prose answer arrives as one event; the trade-off is noted in the README.
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly ollama: AppConfig['ollama'];
  private readonly maxSteps: number;

  constructor(
    private readonly mcp: McpHostService,
    configService: ConfigService<{ app: AppConfig }, true>,
  ) {
    const config = configService.get('app', { infer: true });
    this.ollama = config.ollama;
    this.maxSteps = config.agent.maxSteps;
  }

  /** Never throws — every failure path emits an `error` event. */
  async run(question: string, emit: AgentEventSink): Promise<void> {
    const started = Date.now();
    let tools: OllamaToolSchema[];
    try {
      tools = await this.mcp.listToolsForOllama();
    } catch (err) {
      emit('error', {
        message: `Could not load tools: ${(err as Error).message}`,
      });
      return;
    }

    emit('session', {
      tools: tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
      })),
      maxSteps: this.maxSteps,
    });

    const messages: OllamaChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: question },
    ];

    let toolCallCount = 0;

    for (let step = 1; step <= this.maxSteps; step++) {
      emit('step', { step });

      let message: OllamaChatMessage;
      try {
        message = await this.chat(messages, tools);
      } catch (err) {
        emit('error', { message: (err as Error).message });
        return;
      }

      if (!message.tool_calls?.length) {
        emit('answer', {
          text: message.content || '(the model returned an empty answer)',
        });
        emit('done', {
          steps: step,
          toolCalls: toolCallCount,
          totalMs: Date.now() - started,
        });
        return;
      }

      messages.push(message);

      for (const call of message.tool_calls) {
        toolCallCount++;
        emit('tool_call', {
          name: call.function.name,
          arguments: call.function.arguments,
        });

        const callStarted = Date.now();
        const outcome = await this.mcp.callTool(
          call.function.name,
          call.function.arguments,
        );

        emit('tool_result', {
          name: call.function.name,
          result: outcome.text,
          isError: outcome.isError,
          ms: Date.now() - callStarted,
        });

        // Errors go back to the model as tool output too — recovery is the
        // model's job (fix the SQL, pick another city), and watching it
        // recover is half the demo.
        messages.push({ role: 'tool', content: outcome.text });
      }
    }

    emit('error', {
      message: `Stopped after ${this.maxSteps} reasoning steps without a final answer — try a more specific question.`,
    });
  }

  private async chat(
    messages: OllamaChatMessage[],
    tools: unknown[],
  ): Promise<OllamaChatMessage> {
    let res: Response;
    try {
      res = await fetch(`${this.ollama.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollama.model,
          messages,
          tools,
          stream: false,
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (err) {
      this.logger.error(`Ollama unreachable: ${(err as Error).message}`);
      throw new Error(
        'The local model is unreachable — it may be cold-starting. Try again shortly.',
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(
        `Ollama chat returned ${res.status}: ${text.slice(0, 300)}`,
      );
      throw new Error(
        res.status === 404
          ? `Model "${this.ollama.model}" is not available on this server — it may need pulling, and note that tool calling requires llama3.1 or newer.`
          : 'The local model returned an error. Try again shortly.',
      );
    }

    const body = (await res.json()) as { message?: OllamaChatMessage };
    if (!body.message) {
      throw new Error('The model returned no message.');
    }
    return body.message;
  }
}
