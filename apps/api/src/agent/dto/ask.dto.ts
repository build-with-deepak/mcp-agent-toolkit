import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { AGENT_SCENARIOS } from '../../mcp/scenarios/registry';
import type { ScenarioKey } from '../../mcp/scenarios/registry';

const SCENARIO_KEYS = AGENT_SCENARIOS.map((scenario) => scenario.key);

export class AskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000, {
    message: 'Question is too long — keep it under 1000 characters.',
  })
  question!: string;

  @IsIn(SCENARIO_KEYS, {
    message: `scenarioKey must be one of: ${SCENARIO_KEYS.join(', ')}`,
  })
  scenarioKey!: ScenarioKey;
}
