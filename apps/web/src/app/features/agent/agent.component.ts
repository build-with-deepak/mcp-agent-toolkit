import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthPanelComponent } from '../../core/auth-panel.component';
import { AuthService } from '../../core/auth.service';
import { streamSse } from '../../core/sse-client';
import { AgentScenario } from '../../core/models';
import { ScenarioPickerComponent } from '../scenario-picker/scenario-picker.component';

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
  | { kind: 'step'; step: number; maxSteps: number }
  | {
      kind: 'tool';
      name: string;
      args: string;
      status: 'running' | 'ok' | 'error';
      result: string | null;
      ms: number | null;
    };

/** Emoji badge per tool — a fast visual anchor in a trace. Unmapped tools
 * fall back to a generic wrench, so a new scenario's tools degrade
 * gracefully rather than needing an icon before they can ship. */
export const TOOL_ICONS: Partial<Record<string, string>> = {
  query_database: '🗄️',
  get_weather: '⛅',
  calculate: '🧮',
  find_shipment: '📦',
  list_driver_status: '🧑‍✈️',
  get_warehouse_status: '🏭',
  check_delivery_sla: '⏱️',
  find_alternative_vehicle: '🚐',
  create_escalation: '🚨',
  notify_customer: '📣',
  find_customer: '🔍',
  list_products: '📋',
  check_pricing: '💰',
  check_availability: '📦',
  create_lead: '🌱',
  schedule_meeting: '📅',
  get_order: '🧾',
  get_delivery_status: '🚚',
  check_policy: '📖',
  check_customer_history: '🗂️',
  create_case: '🗃️',
};

@Component({
  selector: 'app-agent',
  imports: [FormsModule, AuthPanelComponent, ScenarioPickerComponent],
  templateUrl: './agent.component.html',
  styleUrl: './agent.component.scss',
})
export class AgentComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  private abortController: AbortController | null = null;

  readonly toolIcons = TOOL_ICONS;
  readonly scenario = signal<AgentScenario | null>(null);
  readonly suggestions = computed(() => this.scenario()?.suggestedPrompts ?? []);
  readonly question = signal('');
  readonly isRunning = signal(false);
  readonly tools = signal<ToolInfo[]>([]);
  readonly maxSteps = signal(0);
  readonly timeline = signal<TimelineEntry[]>([]);
  readonly answer = signal('');
  readonly summary = signal<{ steps: number; toolCalls: number; totalMs: number } | null>(null);
  readonly error = signal<string | null>(null);

  selectScenario(scenario: AgentScenario): void {
    this.scenario.set(scenario);
    this.resetRun();
  }

  changeScenario(): void {
    this.scenario.set(null);
    this.resetRun();
  }

  private resetRun(): void {
    this.question.set('');
    this.timeline.set([]);
    this.answer.set('');
    this.summary.set(null);
    this.error.set(null);
    this.tools.set([]);
  }

  /** The tool schema's own description, read from the `session` event —
   * "Checking shipment status" reads better mid-trace than the raw function
   * name, and this is free: the data is already sent, just unused until now. */
  toolDescription(name: string): string | null {
    return this.tools().find((tool) => tool.name === name)?.description ?? null;
  }

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
    const scenarioKey = this.scenario()?.key;
    if (!question || !token || !scenarioKey || this.isRunning()) return;

    this.timeline.set([]);
    this.answer.set('');
    this.summary.set(null);
    this.error.set(null);
    this.isRunning.set(true);
    this.abortController = new AbortController();

    try {
      const events = streamSse(
        '/api/agent/stream',
        { question, scenarioKey },
        token,
        this.abortController.signal,
      );
      for await (const event of events) {
        switch (event.type) {
          case 'session': {
            const data = event.data as { tools: ToolInfo[]; maxSteps: number };
            this.tools.set(data.tools);
            this.maxSteps.set(data.maxSteps);
            break;
          }
          case 'step':
            this.timeline.update((list) => [
              ...list,
              {
                kind: 'step',
                step: (event.data as { step: number }).step,
                maxSteps: this.maxSteps(),
              },
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
