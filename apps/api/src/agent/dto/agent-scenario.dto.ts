export class AgentScenarioToolDto {
  name!: string;
  description!: string;
}

export class AgentScenarioDto {
  key!: string;
  label!: string;
  description!: string;
  suggestedPrompts!: string[];
  /** Sourced live from McpHostService, not duplicated by hand — so this
   * list can never drift from what the scenario actually registers. */
  tools!: AgentScenarioToolDto[];
}
