import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AgentScenario } from './models';

@Injectable({ providedIn: 'root' })
export class AgentScenariosService {
  private readonly http = inject(HttpClient);

  /** Label, description, suggested prompts and full tool list for all 3
   * scenarios — lets the picker and preview modal show what an agent can
   * do before any question is asked. */
  async getScenarios(): Promise<AgentScenario[]> {
    return firstValueFrom(this.http.get<AgentScenario[]>('/api/agent/scenarios'));
  }
}
