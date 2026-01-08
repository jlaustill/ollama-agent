#!/usr/bin/env node

import React from "react";
import { render } from "ink";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import App from "./display/components/App";

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

// Start TUI
// Yargs automatically handles --help and --version (exits before reaching here)
// Use USER_CWD from shell script (user's original directory), fallback to process.cwd()
const userCwd = process.env.USER_CWD ?? process.cwd();
render(<App cwd={userCwd} debugMode={args.debug} />, { patchConsole: true });
