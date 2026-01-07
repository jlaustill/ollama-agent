#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Entry point for ollama-agent v2
 */

// Get package.json version
const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = dirname(currentFilename);
const packageJson = JSON.parse(
  readFileSync(join(currentDirname, "..", "package.json"), "utf-8"),
) as { version: string };

interface CliArgs {
  debug: boolean;
}

const cli = yargs(hideBin(process.argv))
  .version(packageJson.version)
  .alias("version", "v")
  .option("debug", {
    alias: "d",
    type: "boolean",
    description: "Enable debug output",
    default: false,
  })
  .help()
  .alias("help", "h")
  .strict()
  .parseSync();

const args = cli as CliArgs;

// Placeholder - will be replaced with actual agent orchestration
// eslint-disable-next-line no-console
console.log("ollama-agent v2");
// eslint-disable-next-line no-console
console.log(`Debug mode: ${args.debug ? "enabled" : "disabled"}`);

process.exit(0);
