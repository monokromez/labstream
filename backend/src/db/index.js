import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema.js";

function bindPositionalParameters(statement, parameters) {
  const fragments = [];
  let segmentStart = 0;
  let index = 0;
  let state = "normal";

  while (index < statement.length) {
    const char = statement[index];
    const next = statement[index + 1];
    if (state === "single") {
      if (char === "'" && next === "'") { index += 2; continue; }
      if (char === "'") state = "normal";
      index += 1; continue;
    }
    if (state === "double") {
      if (char === '"' && next === '"') { index += 2; continue; }
      if (char === '"') state = "normal";
      index += 1; continue;
    }
    if (state === "line-comment") {
      if (char === "\n") state = "normal";
      index += 1; continue;
    }
    if (state === "block-comment") {
      if (char === "*" && next === "/") { state = "normal"; index += 2; continue; }
      index += 1; continue;
    }
    if (char === "'" ) { state = "single"; index += 1; continue; }
    if (char === '"') { state = "double"; index += 1; continue; }
    if (char === "-" && next === "-") { state = "line-comment"; index += 2; continue; }
    if (char === "/" && next === "*") { state = "block-comment"; index += 2; continue; }
    if (char === "$" && /\d/.test(next ?? "")) {
      let end = index + 1;
      while (/\d/.test(statement[end] ?? "")) end += 1;
      const parameterIndex = Number(statement.slice(index + 1, end)) - 1;
      if (parameterIndex < 0 || parameterIndex >= parameters.length) {
        throw new Error(`Missing SQL parameter for $${parameterIndex + 1}`);
      }
      fragments.push(sql.raw(statement.slice(segmentStart, index)));
      const parameter = parameters[parameterIndex];
      if (Array.isArray(parameter)) {
        // Drizzle/Postgres.js treats a JS array interpolated as one SQL value
        // as a row expression. Build a PostgreSQL ARRAY constructor instead,
        // so casts such as `::uuid[]` and `::request_status[]` work with ANY.
        const arrayType = statement.slice(end).match(/^\s*::\s*([a-zA-Z_][\w.]*)\s*\[\]/)?.[1];
        if (!arrayType) throw new Error(`Array SQL parameter $${parameterIndex + 1} must have an explicit PostgreSQL array cast`);
        fragments.push(sql.raw("ARRAY["));
        fragments.push(sql.join(parameter.map((value) => sql`${value}::${sql.raw(arrayType)}`), sql.raw(", ")));
        fragments.push(sql.raw("]"));
      } else {
        fragments.push(sql`${parameter}`);
      }
      segmentStart = end;
      index = end;
      continue;
    }
    index += 1;
  }

  fragments.push(sql.raw(statement.slice(segmentStart)));
  return sql.join(fragments, sql.empty());
}

function queryClient(executor) {
  return {
    unsafe(statement, parameters = []) {
      return executor.execute(bindPositionalParameters(statement, parameters));
    },
  };
}

// Importing backend modules never opens a database connection. Routes use the
// compatibility query interface, but statements are parameterized and executed
// through Drizzle. The Drizzle schema mirrors the canonical SQL schema.
export function createDatabase({ connectionString, ssl = "require" }) {
  if (!connectionString) throw new Error("DATABASE_URL is required when DATABASE_ENABLED=true");
  const driver = postgres(connectionString, { max: 5, ssl, connect_timeout: 5, prepare: false });
  const db = drizzle(driver, { schema });
  const client = {
    ...queryClient(db),
    begin: (callback) => db.transaction((transaction) => callback(queryClient(transaction))),
  };
  return { client, db, close: () => driver.end({ timeout: 5 }) };
}
