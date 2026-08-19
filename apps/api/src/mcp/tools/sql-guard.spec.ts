import { guardReadOnlySql, SqlValidationError } from './sql-guard';

describe('guardReadOnlySql', () => {
  it('wraps a plain SELECT in a row-capped subselect', () => {
    const guarded = guardReadOnlySql('SELECT * FROM customers');
    expect(guarded).toBe(
      'SELECT * FROM (SELECT * FROM customers) AS _guarded LIMIT 100',
    );
  });

  it('accepts a CTE (WITH … SELECT)', () => {
    const guarded = guardReadOnlySql(
      'WITH d AS (SELECT id FROM customers WHERE city = $$Dubai$$) SELECT count(*) FROM d',
    );
    expect(guarded).toContain('WITH d AS');
    expect(guarded).toMatch(/LIMIT 100$/);
  });

  it('tolerates a single trailing semicolon', () => {
    expect(() => guardReadOnlySql('SELECT 1;')).not.toThrow();
  });

  it('rejects multi-statement input', () => {
    expect(() => guardReadOnlySql('SELECT 1; DROP TABLE customers')).toThrow(
      SqlValidationError,
    );
  });

  it('rejects non-SELECT statements', () => {
    expect(() => guardReadOnlySql('UPDATE customers SET name = $$x$$')).toThrow(
      /read queries/i,
    );
  });

  it('rejects forbidden keywords hiding inside a SELECT', () => {
    expect(() =>
      guardReadOnlySql('SELECT 1 WHERE EXISTS (SELECT pg_sleep(10))'),
    ).toThrow(/pg_sleep/);
    expect(() =>
      guardReadOnlySql('SELECT set_config($$a$$, $$b$$, false)'),
    ).toThrow(SqlValidationError);
  });

  it('strips comments before validating, so a commented DROP is not a bypass', () => {
    expect(() =>
      guardReadOnlySql('SELECT 1 -- ; DROP TABLE customers'),
    ).not.toThrow();
    expect(guardReadOnlySql('SELECT 1 /* delete */')).toContain('SELECT 1');
  });

  it('does not false-positive on "offset", which contains "set"', () => {
    expect(() =>
      guardReadOnlySql('SELECT id FROM orders ORDER BY id OFFSET 5'),
    ).not.toThrow();
  });

  it('rejects empty input', () => {
    expect(() => guardReadOnlySql('  -- just a comment ')).toThrow(/empty/i);
  });
});
