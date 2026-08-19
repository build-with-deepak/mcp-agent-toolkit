/**
 * App-level validation for agent-written SQL — the first of two layers.
 *
 * The second, stronger layer is the `mcp_readonly` Postgres role the query
 * actually executes as (SELECT-only grants, read-only transactions, 5s
 * statement timeout — see db.service.ts). This guard exists to fail FAST
 * and with a message the agent can act on, and to catch shapes the role
 * can't express an opinion about (multi-statement input, unbounded result
 * sets).
 *
 * Known limitation, accepted: the keyword denylist is lexical, so a column
 * literally named "update" in a string literal would false-positive. For a
 * fixed demo schema that trade is free; the denylist is defense-in-depth
 * behind the role, not the load-bearing wall.
 */

const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|merge|drop|alter|create|grant|revoke|truncate|copy|vacuum|analyze|call|do|execute|prepare|deallocate|listen|notify|lock|reindex|cluster|refresh|comment|security|role|password|pg_sleep|pg_read_file|pg_ls_dir|pg_terminate_backend|set_config|dblink|set|reset)\b/i;

export const MAX_RESULT_ROWS = 100;

export class SqlValidationError extends Error {}

/**
 * Validates and normalizes a read query, returning the exact SQL to
 * execute: the caller's query wrapped in a row-capped subselect.
 */
export function guardReadOnlySql(rawSql: string): string {
  const withoutComments = rawSql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim();

  if (!withoutComments) {
    throw new SqlValidationError('Empty SQL query.');
  }

  // One statement only: a trailing semicolon is tolerated, an interior one
  // means a second statement is riding along.
  const stripped = withoutComments.replace(/;\s*$/, '');
  if (stripped.includes(';')) {
    throw new SqlValidationError(
      'Multiple SQL statements are not allowed — send one SELECT at a time.',
    );
  }

  if (!/^(select|with)\b/i.test(stripped)) {
    throw new SqlValidationError(
      'Only read queries are allowed — start with SELECT (or WITH … SELECT).',
    );
  }

  const forbidden = stripped.match(FORBIDDEN_KEYWORDS);
  if (forbidden) {
    throw new SqlValidationError(
      `The keyword "${forbidden[0]}" is not allowed in this read-only tool.`,
    );
  }

  // Row cap via subquery wrap rather than string-editing the caller's SQL:
  // appending "LIMIT 100" to a query that already ends in LIMIT/OFFSET (or
  // FOR UPDATE, which the wrap also neutralizes) produces invalid or
  // surprising SQL; a wrap is composable with anything a SELECT can be.
  return `SELECT * FROM (${stripped}) AS _guarded LIMIT ${MAX_RESULT_ROWS}`;
}
