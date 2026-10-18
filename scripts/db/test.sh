#!/usr/bin/env bash
# scripts/db/test.sh — run the SQL security suites. Needs psql and a THROWAWAY
# database: the tests insert rows that cannot be deleted, by design.
#   TEST_OWNER_URL  superuser or owner connection to the throwaway database
#   TEST_APP_URL    the same database as ark_app_login
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${TEST_OWNER_URL:?set TEST_OWNER_URL}"; : "${TEST_APP_URL:?set TEST_APP_URL}"
DATABASE_URL="$TEST_OWNER_URL" node scripts/db/migrate.mjs
psql "$TEST_APP_URL"   -q -v ON_ERROR_STOP=1 -f tests/test_security.sql  2>&1 | grep -E 'PASS|FAIL|ALL TESTS'
psql "$TEST_OWNER_URL" -q -v ON_ERROR_STOP=1 -f tests/test_forced_rls.sql 2>&1 | grep -oE '(PASS|FAIL).*'
