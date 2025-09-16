#!/usr/bin/env bash
set -euo pipefail

# Ensure the data directory exists
mkdir -p /app/data

# Fix ownership of mounted volume (if it's root-owned) so the app user can write
chown -R nodejs:nodejs /app/data || true

# Drop privileges and exec the actual command
exec gosu nodejs:nodejs "$@"