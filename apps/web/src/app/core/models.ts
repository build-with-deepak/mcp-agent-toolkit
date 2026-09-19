/** Mirrors the API's response shapes — plain interfaces, same reasoning as
 * the sibling demos. */

/* The old DemoSession type lived here. Sessions now come from the
 * identity service and are described in session.models.ts. */

export type ScenarioKey = 'logistics' | 'sales' | 'service';

export interface AgentScenarioTool {
  name: string;
  description: string;
}

/** Mirrors the API's AgentScenarioDto — the picker and preview modal's data source. */
export interface AgentScenario {
  key: ScenarioKey;
  label: string;
  description: string;
  suggestedPrompts: string[];
  tools: AgentScenarioTool[];
}
