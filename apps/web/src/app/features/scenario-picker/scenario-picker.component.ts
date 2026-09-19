import { Component, OnInit, inject, output, signal } from '@angular/core';
import { InfoModalComponent } from '../../core/info-modal.component';
import { AgentScenariosService } from '../../core/agent-scenarios.service';
import { AgentScenario, ScenarioKey } from '../../core/models';

/** Emoji glyph per scenario — a fast visual anchor across 3 cards, same
 * fallback-to-generic pattern as the per-tool icons in the trace view. */
const SCENARIO_ICONS: Record<ScenarioKey, string> = {
  logistics: '🚚',
  sales: '🤝',
  service: '🎧',
};

@Component({
  selector: 'app-scenario-picker',
  imports: [InfoModalComponent],
  templateUrl: './scenario-picker.component.html',
  styleUrl: './scenario-picker.component.scss',
})
export class ScenarioPickerComponent implements OnInit {
  private readonly scenariosService = inject(AgentScenariosService);

  readonly icons = SCENARIO_ICONS;
  readonly scenarios = signal<AgentScenario[]>([]);
  readonly loadingCatalog = signal(true);
  readonly previewKey = signal<ScenarioKey | null>(null);
  readonly error = signal<string | null>(null);

  readonly selected = output<AgentScenario>();

  async ngOnInit(): Promise<void> {
    try {
      this.scenarios.set(await this.scenariosService.getScenarios());
    } catch {
      this.error.set('Could not load the scenarios. Refresh to try again.');
    } finally {
      this.loadingCatalog.set(false);
    }
  }

  preview(key: ScenarioKey): void {
    this.previewKey.set(key);
  }

  closePreview(): void {
    this.previewKey.set(null);
  }

  previewScenario(): AgentScenario | undefined {
    return this.scenarios().find((scenario) => scenario.key === this.previewKey());
  }

  use(key: ScenarioKey): void {
    const scenario = this.scenarios().find((s) => s.key === key);
    if (scenario) this.selected.emit(scenario);
  }
}
