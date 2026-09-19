import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { streamSse } from '../../core/sse-client';

export interface ToolInfo {
  name: string;
  description: string;
}

/**
 * One entry in the live timeline the visitor watches. A 'tool' entry is
 * created the instant the call happens (status 'running', no result yet)
 * and is updated in place when its result arrives — so the trace shows the
 * real gap between "the agent decided to call this" and "the tool answered",
 * rather than only ever showing calls after the fact.
 */
export type TimelineEntry =
  | { kind: 'step'; step: number }
  | {
      kind: 'tool';
      name: string;
      args: string;
      status: 'running' | 'ok' | 'error';
      result: string | null;
      ms: number | null;
    };

/** Emoji badge per tool — a fast visual anchor in a trace with three tools. */
export const TOOL_ICONS: Partial<Record<string, string>> = {
  query_database: '🗄️',
  get_weather: '⛅',
  calculate: '🧮',
};

/**
 * Three guided prompts, not four — one per tool combination that best
 * shows what an agent actually is. At least one must chain two tools in a
 * single request; here two of three do, because a single-tool call reads
 * exactly like a plain chatbot and undersells the product. Table/column
 * names match apps/api/db/schema.sql (customers.city, products.category,
 * products.price_usd) so these always resolve against the real dataset.
 */
const SUGGESTIONS = [
  'What is the total revenue from customers in Dubai, and what is the weather there right now?',
  'Which product category made the most money?',
  'What would the three most expensive products cost together with 5% tax?',
];

@Component({
  selector: 'app-agent',
  imports: [FormsModule],
  templateUrl: './agent.component.html',
  styleUrl: './agent.component.scss',
})
export class AgentComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  private abortController: AbortController | null = null;

  readonly suggestions = SUGGESTIONS;
  readonly toolIcons = TOOL_ICONS;
  readonly question = signal('');
  readonly isRunning = signal(false);
  readonly tools = signal<ToolInfo[]>([]);
  readonly timeline = signal<TimelineEntry[]>([]);
  readonly answer = signal('');
  readonly summary = signal<{ steps: number; toolCalls: number; totalMs: number } | null>(null);
  readonly error = signal<string | null>(null);

  /** Populates AND runs — a first-time visitor shouldn't have to type
   * anything to see the trace happen. */
  useSuggestion(text: string): void {
    if (this.isRunning()) return;
    this.question.set(text);
    void this.ask();
  }

  async ask(): Promise<void> {
    const question = this.question().trim();
    const token = this.auth.token;
    if (!question || !token || this.isRunning()) return;

    this.timeline.set([]);
    this.answer.set('');
    this.summary.set(null);
    this.error.set(null);
    this.isRunning.set(true);
    this.abortController = new AbortController();

    try {
      const events = streamSse(
        '/api/agent/stream',
        { question },
        token,
        this.abortController.signal,
      );
      for await (const event of events) {
        switch (event.type) {
          case 'session':
            this.tools.set((event.data as { tools: ToolInfo[] }).tools);
            break;
          case 'step':
            this.timeline.update((list) => [
              ...list,
              { kind: 'step', step: (event.data as { step: number }).step },
            ]);
            break;
          case 'tool_call': {
            const data = event.data as { name: string; arguments: unknown };
            this.timeline.update((list) => [
              ...list,
              {
                kind: 'tool',
                name: data.name,
                args: JSON.stringify(data.arguments, null, 2),
                status: 'running',
                result: null,
                ms: null,
              },
            ]);
            break;
          }
          case 'tool_result': {
            const data = event.data as {
              name: string;
              result: string;
              isError: boolean;
              ms: number;
            };
            // Calls are awaited sequentially in the agent loop, so the
            // pending call is always the last entry — update it in place
            // rather than appending a second, disconnected entry.
            this.timeline.update((list) => {
              const lastIndex = list.length - 1;
              const last = list[lastIndex];
              if (!last || last.kind !== 'tool' || last.status !== 'running') {
                return list;
              }
              const next = [...list];
              next[lastIndex] = {
                ...last,
                status: data.isError ? 'error' : 'ok',
                result: data.result,
                ms: data.ms,
              };
              return next;
            });
            break;
          }
          case 'answer':
            this.answer.set((event.data as { text: string }).text);
            break;
          case 'done':
            this.summary.set(
              event.data as { steps: number; toolCalls: number; totalMs: number },
            );
            break;
          case 'error':
            this.error.set((event.data as { message: string }).message);
            break;
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        this.error.set((err as Error).message);
      }
    } finally {
      this.isRunning.set(false);
      this.abortController = null;
    }
  }

  ngOnDestroy(): void {
    this.abortController?.abort();
  }
}
