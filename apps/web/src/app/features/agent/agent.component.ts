import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { streamSse } from '../../core/sse-client';

export interface ToolInfo {
  name: string;
  description: string;
}

/** One entry in the live timeline the visitor watches. */
export type TimelineEntry =
  | { kind: 'step'; step: number }
  | { kind: 'tool_call'; name: string; args: string }
  | { kind: 'tool_result'; name: string; result: string; isError: boolean; ms: number };

const SUGGESTIONS = [
  'What is the total revenue from customers in Dubai, and what is the weather there right now?',
  'Which product category made the most money? Show the math.',
  'Compare order counts between London and New York customers, and tell me which city is warmer today.',
  'What would the three most expensive products cost together with 5% tax?',
];

@Component({
  selector: 'app-agent',
  imports: [FormsModule],
  templateUrl: './agent.component.html',
  styleUrl: './agent.component.scss',
})
export class AgentComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private abortController: AbortController | null = null;

  readonly suggestions = SUGGESTIONS;
  readonly question = signal('');
  readonly isRunning = signal(false);
  readonly tools = signal<ToolInfo[]>([]);
  readonly timeline = signal<TimelineEntry[]>([]);
  readonly answer = signal('');
  readonly summary = signal<{ steps: number; toolCalls: number; totalMs: number } | null>(null);
  readonly error = signal<string | null>(null);

  useSuggestion(text: string): void {
    this.question.set(text);
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
              { kind: 'tool_call', name: data.name, args: JSON.stringify(data.arguments, null, 2) },
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
            this.timeline.update((list) => [...list, { kind: 'tool_result', ...data }]);
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
