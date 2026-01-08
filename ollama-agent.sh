#!/usr/bin/env bash
# Wrapper script to run ollama-agent v2 with tsx (no build needed)

# Save the user's original working directory
USER_DIR="$(pwd)"

# Resolve the actual script location (following symlinks)
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"

# Change to script directory to run tsx
cd "$SCRIPT_DIR"

# For now, just run the entry point directly
# Pass user's original directory as environment variable
USER_CWD="$USER_DIR" npx tsx src/cli.ts "$@"
