// Drizzle wraps driver errors in a DrizzleQueryError and keeps the original
// PostgreSQL error on `cause`. Route handlers that branch on SQLSTATE codes
// (unique violations, check violations, ...) must unwrap that chain first,
// otherwise every database constraint failure looks like an unknown 500.
function errorChain(error) {
  const chain = [];
  const seen = new Set();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    current = current.cause;
  }
  return chain;
}

function firstString(chain, key) {
  for (const item of chain) {
    const value = item[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

// Resolves application error codes (`STAFF_NOT_FOUND`, ...) as well as
// PostgreSQL SQLSTATE codes (`23505`, ...) raised anywhere in the cause chain.
export function getErrorCode(error) {
  return firstString(errorChain(error), "code");
}

export function getErrorConstraint(error) {
  return firstString(errorChain(error), "constraint") ?? firstString(errorChain(error), "constraint_name");
}

export function isUniqueViolation(error) {
  return getErrorCode(error) === "23505";
}

export function isCheckViolation(error) {
  return getErrorCode(error) === "23514";
}
