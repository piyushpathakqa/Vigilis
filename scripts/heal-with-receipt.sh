#!/usr/bin/env bash
#
# Run an Argus self-heal with a Treeship provenance receipt wrapped around it.
# Produces a signed, offline-verifiable record of exactly what the heal agent did
# (commands, exit codes, hashed args/outputs) — see docs/TREESHIP.md.
#
# This is the zero-dependency "Tier 1" integration: it wraps the existing `argus`
# CLI with the `treeship` CLI. Argus has no Treeship dependency.
#
# Usage: scripts/heal-with-receipt.sh <url> <spec>
#   scripts/heal-with-receipt.sh http://localhost:3100/login tests/generated/login.spec.ts
set -euo pipefail

URL="${1:?usage: heal-with-receipt.sh <url> <spec>}"
SPEC="${2:?usage: heal-with-receipt.sh <url> <spec>}"

if ! command -v treeship >/dev/null 2>&1; then
  echo "treeship not found. Install it, then run 'treeship init' once:"
  echo "  curl -fsSL treeship.dev/setup | sh"
  echo "  treeship init"
  exit 1
fi

# One signed session covering the whole heal run.
treeship session start

# Record the heal as a signed agent action (actor: agent://argus).
treeship attest action --actor agent://argus --action heal.dom-drift || true

# Wrap the actual Argus heal — its command, exit code, and hashed I/O are captured.
treeship wrap -- node --env-file=.env packages/cli/dist/index.js heal "$URL" --spec "$SPEC"

treeship session close
treeship session report

echo
echo "Verify locally:   treeship verify last"
echo "Share a receipt:  treeship hub push last   # → https://treeship.dev/verify/<id>"
