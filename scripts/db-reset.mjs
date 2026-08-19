#!/usr/bin/env node
/**
 * Drops and recreates the sample dataset tables. The API re-applies
 * db/schema.sql (tables + fixed sample rows + read-only grants) on its
 * next boot or first query, so the full reset flow is: run this, restart
 * the api container/process.
 *
 * The dataset is fixed and read-only for visitors, so this exists for
 * schema-change deployments rather than routine cleanup — there is no
 * visitor-written data in this demo to clean up.
 *
 *   DATABASE_URL=postgres://... node scripts/db-reset.mjs
 */
import pg from 'pg';

const url = process.env.DATABASE_URL ?? 'postgres://mcp:mcp@localhost:5432/mcp_demo';
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  await client.query('DROP TABLE IF EXISTS order_items, orders, products, customers CASCADE');
  console.log('[db-reset] sample tables dropped — restart the API to recreate and reseed.');
} catch (err) {
  console.error(`[db-reset] failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
