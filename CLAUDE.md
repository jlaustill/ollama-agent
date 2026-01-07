# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a v2 rewrite of an LLM-powered autonomous agent system that uses plans (markdown documents) as primary context instead of full conversation history. The agent can execute tasks by calling tools, managing a structured plan, and maintaining state through a terminal UI.

**Key Innovation:** Plan-based context management that enables long-running projects without context window explosion.

## Architecture Principles

### 3-Tier Layer Architecture

```
Display Layer (src/display)  - TUI, CLI, formatting
    ↓ calls
Domain Layer (src/domain)    - Business logic, orchestration
    ↓ calls
Data Layer (src/data)        - Ollama API, file I/O, databases
```

**Critical Rules:**
- Display → Domain only (one-way)
- Domain → Data only (one-way)
- Data has NO knowledge of Domain or Display
- NO circular dependencies ever

### Type Safety Requirements

- Enable ALL strict TypeScript options (`noUncheckedIndexedAccess`, `noImplicitReturns`, etc.)
- NO `any` types - use `unknown` when type is truly unknown
- NO `!` operator unless proven safe with explanatory comment
- Use branded types for IDs: `type PlanId = string & { __brand: 'PlanId' }`
- Exhaustive switch checks with `never` type
- Use discriminated unions for state management

### Code Quality Standards

All code MUST pass these checks before commit:
```bash
npm run typecheck  # Zero TypeScript errors
npm run lint       # Zero ESLint errors (Airbnb config)
npm run format:check  # Prettier formatting
npm test          # All tests passing
```

Pre-commit hooks enforce these automatically. **Never use `--no-verify`.**

## Development Workflow

### Phase 0: Tooling Setup (Do This FIRST)

Before writing ANY source code:

1. **Install dev dependencies:**
   ```bash
   npm install -D typescript @types/node prettier eslint \
     @typescript-eslint/parser @typescript-eslint/eslint-plugin \
     eslint-config-airbnb-base eslint-config-airbnb-typescript \
     eslint-plugin-import vitest @vitest/ui husky lint-staged
   ```

2. **Configure tsconfig.json with strict mode:**
   - `strict: true`
   - `noUnusedLocals: true`
   - `noUncheckedIndexedAccess: true`
   - `noImplicitReturns: true`
   - See ARCHITECTURE.md Section 7.1 for full config

3. **Setup pre-commit hooks:**
   ```bash
   npx husky install
   npx husky add .husky/pre-commit "npm run precommit"
   ```

4. **Verify setup works:**
   ```bash
   npm run lint && npm run typecheck && npm run format:check
   ```

### Phase 1-3: Bottom-Up Development

1. **Data Layer First** - Pure I/O, no business logic
2. **Domain Layer Second** - Business logic, orchestration
3. **Display Layer Last** - UI rendering, CLI parsing

Build and test each layer completely before moving to the next.

## Key Architectural Patterns

### State Machine Pattern

Agent state MUST be explicit discriminated union:

```typescript
type AgentState =
  | { type: 'idle' }
  | { type: 'planning'; currentTask: string }
  | { type: 'executing'; plan: Plan; taskIndex: number }
  | { type: 'waiting_approval'; pendingOperation: FileOperation }
  | { type: 'error'; error: Error; recoverable: boolean };
```

Never use magic strings or implicit state.

### Result Type Pattern

Return `Result<T, E>` instead of throwing errors for expected failures:

```typescript
type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

function readFile(path: string): Result<string, FileError> {
  // Implementation
}

// Caller handles explicitly
const result = readFile('test.txt');
if (result.success) {
  console.log(result.value); // TypeScript knows this exists
} else {
  console.error(result.error); // TypeScript knows this exists
}
```

### Dependency Injection

NO hidden defaults in constructors:

```typescript
// ❌ BAD: Hidden instantiation
constructor(config: Config, manager?: MemoryManager) {
  this.manager = manager || new MemoryManager();
}

// ✅ GOOD: Explicit dependencies
constructor(config: Config, manager: MemoryManager) {
  this.manager = manager;
}
```

### Pure Functions First

Prefer pure functions (no side effects) for testability:

```typescript
// ✅ GOOD: Pure, fast to test
export const calculateTotal = (items: Item[]) =>
  items.reduce((sum, item) => sum + item.price, 0);

// ❌ BAD: Side effects hidden
function formatTaskList(tasks: Task[]): string {
  console.log('Formatting...'); // Side effect!
  return tasks.map(t => t.description).join('\n');
}
```

## Layer Responsibilities

### Display Layer (`src/display/`)

**Does:**
- Capture user input (TUI, CLI)
- Render output (Blessed panels, terminal)
- Format data for display
- Parse CLI arguments (Commander.js)

**Does NOT:**
- Business logic (plan validation, tool execution)
- Data access (Ollama API, file I/O)
- State management

### Domain Layer (`src/domain/`)

**Does:**
- Agent orchestration (tool calling loop)
- State machine management
- Business rules validation
- Context building for LLM
- Safety policy enforcement

**Does NOT:**
- HTTP requests (delegates to data layer)
- File I/O (delegates to data layer)
- UI rendering (delegates to display layer)

### Data Layer (`src/data/`)

**Does:**
- HTTP requests to Ollama API
- File system operations
- Database queries (SQLite, Vectra)
- Shell command execution
- Serialization/deserialization

**Does NOT:**
- Business rules
- Orchestration logic
- UI concerns

## Key Modules

### AgentOrchestrator (`src/domain/agent/AgentOrchestrator.ts`)

Main execution loop that:
- Processes user messages
- Builds LLM context
- Calls Ollama API
- Parses responses
- Executes tools
- Manages state transitions
- Enforces iteration limits

**Test with mocked dependencies (Ollama, ToolRegistry, PlanManager).**

### PlanManager (`src/domain/plan/PlanManager.ts`)

CRUD operations for plans:
- Create, load, save plans
- Validate plan structure
- Compute diffs between plan versions
- Add/update tasks
- Append to execution log

**Plans are markdown files that serve as persistent context.**

### ToolRegistry (`src/domain/tools/ToolRegistry.ts`)

Tool management:
- Register tools with validation
- Execute tools with parameter validation
- Batch parallel tool execution
- Generate schemas for LLM prompts

**Performance:** Execute independent tools in parallel (5 reads = 1 batch, not 5 iterations).

### OllamaClient (`src/data/models/OllamaClient.ts`)

Pure HTTP client for Ollama:
- `chat()` - Synchronous chat completion
- `chatStream()` - Streaming responses
- `generateEmbedding()` - Text embeddings
- `healthCheck()` - Ollama availability

**No business logic - just HTTP calls with error handling.**

## Data Models

### Plan Structure

```typescript
interface Plan {
  planId: PlanId;               // Branded string type
  sessionId: SessionId;
  goal: string;                 // Main objective
  goals: string[];              // Sub-goals
  architecture: Architecture;    // Design decisions
  tasks: PlanTask[];            // Task list
  executionLog: PlanLogEntry[]; // Append-only log
  metadata: PlanMetadata;       // Timestamps, version
}

interface PlanTask {
  id: TaskId;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  notes?: string;
  createdAt: number;
  updatedAt: number;
}
```

Plans are serialized to markdown files in `.simple-agent/` directory.

## Testing Strategy

### Test Hierarchy (Fast → Slow)

1. **Pure functions** - Fastest, no mocking
2. **Classes with injected dependencies** - Mock dependencies
3. **Integration tests** - Test layer interactions
4. **E2E tests** - Full workflow (slow)

### Coverage Requirements

- 80%+ overall coverage
- 100% coverage for domain layer (business logic)
- Integration tests for critical paths
- At least one E2E test for complete workflow

### Test Patterns

```typescript
describe('AgentOrchestrator', () => {
  it('should execute tool and return response', async () => {
    // Mock dependencies
    const mockOllama = { chat: vi.fn().mockResolvedValue(...) };
    const mockRegistry = { execute: vi.fn().mockResolvedValue(...) };

    // Execute
    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.processMessage('Read file', {
      ollama: mockOllama,
      toolRegistry: mockRegistry,
      // ... other mocks
    }, {});

    // Assert
    expect(result).toBe('Expected response');
    expect(mockOllama.chat).toHaveBeenCalledTimes(2);
  });
});
```

## Technology Stack

- **Runtime:** Node.js with Volta version management
- **Language:** TypeScript (strict mode)
- **HTTP Client:** Axios (all RESTful API calls)
- **LLM Backend:** Ollama (local models)
- **Vector DB:** Vectra (local embeddings)
- **Session Store:** SQLite
- **TUI:** Blessed (terminal UI library)
- **CLI:** Commander.js
- **Testing:** Vitest
- **Linting:** ESLint (Airbnb config)
- **Formatting:** Prettier

**Note:** Axios is the standard HTTP client for all API communications. It provides automatic JSON transformation, built-in timeout support, better error handling, and request/response interceptors.

## Safety & Performance

### Safety Mechanisms

- Protected files list (`.env`, `package.json`, etc.)
- Dangerous command blacklist
- File size limits
- Confirmation queue for destructive operations
- Shell command validation

**These are carried over from v1 - reference `safetyGuards.ts` when implementing.**

### Performance Optimizations

- **Parallel tool execution:** Batch independent tool calls
- **Streaming responses:** Use `chatStream()` for real-time output
- **Context truncation:** Keep LLM context under 8K tokens
- **Memory efficiency:** Target <100MB for typical sessions

## Development Rules

1. **No code without tests** - Every module gets `.test.ts` file
2. **Commit often** - Commit after each module/feature
3. **Pre-commit hook is law** - Never skip with `--no-verify`
4. **Pure functions where possible** - Easier to test
5. **Small modules** - Target <200 lines per file, <50 lines per function
6. **Explicit dependencies** - No hidden instantiation
7. **Type safety first** - Strict TypeScript, discriminated unions
8. **Bottom-up development** - Data → Domain → Display

## Common Patterns

### Module File Structure

```
src/domain/tools/
├── ToolRegistry.ts           # Main implementation
├── ToolRegistry.test.ts      # Unit tests
├── definitions/              # Individual tools
│   ├── files/
│   │   ├── ReadFileTool.ts
│   │   └── WriteFileTool.ts
│   └── shell/
│       └── ShellTool.ts
└── types/                    # Module-specific types
    ├── Tool.ts
    └── ToolResult.ts
```

### Error Handling

Use custom error types for different layers:

```typescript
// src/shared/errors/
class AgentError extends Error { /* ... */ }
class ToolError extends Error { /* ... */ }
class DataError extends Error { /* ... */ }
```

Throw errors for unexpected failures, return `Result<T, E>` for expected failures.

### Commit Message Format

```bash
feat(data): add OllamaClient with streaming support
test(domain): add ToolRegistry validation tests
fix(agent): prevent infinite loop on max iterations
refactor(plan): extract validation to PlanValidator
```

## Migration from v1

**Do NOT migrate in place.** Build v2 as a clean parallel codebase.

### What to Port Directly

- Safety guards
- Tool definitions (file operations, shell execution)
- Model selection logic
- Plan markdown serialization

### What to Rewrite

- Agent orchestration (too tangled in v1)
- Context building (mixed concerns in v1)
- TUI state management
- CLI mode handling (consolidate 3 modes)

See ARCHITECTURE.md Section 9 for full migration strategy.

## References

- **Architecture Document:** `ARCHITECTURE.md` - Complete design specification
- **v1 Codebase:** Reference for safety mechanisms and tool implementations
- **Ollama API:** https://ollama.ai/
- **Vectra:** https://github.com/microsoft/vectra
- **Blessed:** https://github.com/chjj/blessed

## Getting Started

For new contributors:

1. Read ARCHITECTURE.md in full (essential context)
2. Setup tooling (Phase 0 in Development Workflow)
3. Start with Data Layer (`src/data/models/OllamaClient.ts`)
4. Write tests alongside implementation
5. Follow layer boundaries strictly

This is a rewrite project with a clear architectural vision. The goal is correctness and maintainability, not speed.
