/**
 * Single source of runtime config — same pattern as the sibling demos
 * (rag-privacy-first, llm-multi-model-router).
 */
export interface AppConfig {
  port: number;
  corsOrigin: string;
  auth: {
    jwtSecret: string;
    tokenTtl: string;
  };
  db: {
    url: string;
    /**
     * Password for the `mcp_readonly` Postgres role the DB tool connects
     * as. The role is created/updated at migration time; the agent's SQL
     * never runs as the owning user. See db.service.ts.
     */
    readonlyPassword: string;
  };
  ollama: {
    baseUrl: string;
    /**
     * Must be a tool-calling-capable model. Plain llama3:8b does NOT
     * reliably emit tool calls — llama3.1:8b (or newer) does, which is why
     * the default differs from the sibling demos.
     */
    model: string;
  };
  agent: {
    /** Hard ceiling on reasoning iterations — a runaway loop's backstop. */
    maxSteps: number;
    maxQuestionChars: number;
  };
  rateLimit: {
    ttlMs: number;
    limit: number;
  };
}

const DEV_ONLY_SECRET = 'dev-only-secret-change-me';

export default (): { app: AppConfig } => {
  const jwtSecret = process.env.JWT_SECRET ?? DEV_ONLY_SECRET;
  if (process.env.NODE_ENV === 'production' && jwtSecret === DEV_ONLY_SECRET) {
    throw new Error('JWT_SECRET must be set in production.');
  }

  return {
    app: {
      port: Number(process.env.PORT ?? 3000),
      corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
      auth: {
        jwtSecret,
        tokenTtl: process.env.DEMO_TOKEN_TTL ?? '2h',
      },
      db: {
        url:
          process.env.DATABASE_URL ??
          'postgres://mcp:mcp@localhost:5432/mcp_demo',
        readonlyPassword:
          process.env.MCP_READONLY_PASSWORD ?? 'readonly-dev-only',
      },
      ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL ?? 'llama3.1:8b',
      },
      agent: {
        maxSteps: Number(process.env.AGENT_MAX_STEPS ?? 6),
        maxQuestionChars: Number(process.env.MAX_QUESTION_CHARS ?? 1000),
      },
      rateLimit: {
        ttlMs: Number(process.env.RATE_LIMIT_TTL_MS ?? 60 * 1000),
        limit: Number(process.env.RATE_LIMIT_LIMIT ?? 10),
      },
    },
  };
};
