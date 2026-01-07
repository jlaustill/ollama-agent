# Simple Agent v2.0 - Architecture Document

**Status:** Design Phase
**Last Updated:** 2026-01-06
**Authors:** Architecture Review + User Feedback

---

## Table of Contents

1. [Lessons Learned](#1-lessons-learned)
2. [Core Principles](#2-core-principles)
3. [Architecture Overview](#3-architecture-overview)
4. [Directory Structure](#4-directory-structure)
5. [Layer Responsibilities](#5-layer-responsibilities)
6. [Module Design](#6-module-design)
7. [Development Workflow](#7-development-workflow)
8. [Data Models](#8-data-models)
9. [Migration Strategy](#9-migration-strategy)
10. [Success Metrics](#10-success-metrics)

---

## 1. Lessons Learned

### 1.1 What Worked Well ✅

**Plan-Based Context Management**
- Using markdown plans as context instead of full conversation history is genuinely innovative
- Enables long-running projects without context window explosion
- Plan structure (goal → tasks → execution log) maps naturally to user mental model
- **Keep:** The core plan concept, markdown persistence, task tracking

**Safety-First Tool Design**
- Protected files (`.env`, `package.json`), command whitelists, size limits prevented disasters
- Confirmation wrappers gave users control without being annoying
- **Keep:** All safety guards, expand to more tools

**Mode-Based Execution**
- Planning mode (structure) vs. Executing mode (implementation) is a clear separation
- TUI with split panes (chat + plan) provided excellent visibility
- **Keep:** Mode concept, TUI approach, real-time updates

**Factory Pattern for Tools**
- Easy to add new tools without touching core agent
- Clean dependency injection of working directory, timeouts, etc.
- **Keep:** Tool registry pattern, factory functions

### 1.2 What Didn't Work ❌

**Mixed Concerns Throughout Codebase**
- Agent.ts: 495 lines mixing orchestration, context building, memory management, model selection
- PlanMode.ts: CLI logic + TUI management + agent orchestration + file approval system
- ContextBuilder.ts: Plan formatting + semantic search + mode instructions
- **Problem:** Difficult to test, debug, or modify any single concern

**Dependency Management Chaos**
- Agent constructor takes 5 optional parameters, each defaulting to new instances
- Circular knowledge: Agent knows about Memory, Memory knows about Agent config
- Tool wrapping creates shadow tool systems (original tools + wrapped versions)
- **Problem:** Hard to reason about object lifecycles, initialization order matters

**Type Safety Gaps**
- 11 TypeScript errors in "production-ready" code
- `noUncheckedIndexedAccess` enabled but then ignored with `!` operators
- Tool parameter validation happens at runtime, not compile time
- **Problem:** Type system not helping prevent bugs

**Unclear Execution Flow**
- Three modes (Plan/Interactive/Autonomous) × Two submodes (planning/executing) = 6 states
- No state machine, no clear transitions
- User types `/go` but unclear what happens under the hood
- **Problem:** Users confused, developers confused, bugs hide in edge cases

**Testing Absent**
- No unit tests, integration tests, or E2E tests
- Test files (`test-*.js`) are manual scripts
- Vitest configured but unused
- **Problem:** Refactoring is terrifying, regressions invisible

**Tool Execution Performance**
- Sequential execution even for independent operations
- 5 file reads = 5 LLM round-trips instead of 1 batch
- **Problem:** 5x slower than necessary for I/O-bound workflows

### 1.3 Key Insights 💡

**Insight 1: Layers Should Not Know About Each Other's Internals**
- Current: Agent directly creates OllamaClient, MemoryManager, ToolExecutor
- Better: Domain layer orchestrates, but doesn't instantiate infrastructure

**Insight 2: Configuration Is Code**
- Model selection rules in JSON that get runtime-parsed
- Plan structure defined implicitly through markdown rendering
- Better: TypeScript types, compile-time validation

**Insight 3: The Real Complexity Is Orchestration**
- Tool calling loop, iteration limits, context building, mode switching
- This is the core value - everything else is infrastructure
- Better: Make orchestration explicit, test it thoroughly

**Insight 4: TypeScript ≠ JavaScript with Types**
- Using `any`, `!`, ignoring errors defeats the purpose
- Better: Embrace strict types, use discriminated unions, exhaustive checks

---

## 2. Core Principles

### Principle 1: **Separation of Concerns via 3-Tier Architecture**

```
┌─────────────────────────────────────────────┐
│          DISPLAY LAYER (src/display)        │
│  - TUI rendering                │
│  - CLI parsing                 │
│  - User interaction                         │
│  - Progress visualization                   │
│  ↓ calls                                    │
├─────────────────────────────────────────────┤
│         DOMAIN LAYER (src/domain)           │
│  - Agent orchestration                      │
│  - Plan management logic                    │
│  - Tool execution coordination              │
│  - Business rules                           │
│  ↓ calls                                    │
├─────────────────────────────────────────────┤
│          DATA LAYER (src/data)              │
│  - Ollama API client (src/data/models)      │
│  - File system operations                   │
│  - Vector database (Vectra)                 │
│  - Session persistence (SQLite)             │
└─────────────────────────────────────────────┘
```

**Rules:**
- Display → Domain (one-way only)
- Domain → Data (one-way only)
- Data has NO knowledge of Domain or Display
- NO circular dependencies

### Principle 2: **Explicit Over Implicit**

**Explicit State Machines:**
```typescript
type AgentState =
  | { type: 'idle' }
  | { type: 'planning', currentTask: string }
  | { type: 'executing', plan: Plan, taskIndex: number }
  | { type: 'waiting_approval', pendingOperation: FileOperation }
  | { type: 'error', error: Error, recoverable: boolean };
```

**Explicit Dependencies:**
```typescript
// NO: Hidden defaults
constructor(config: Config, manager?: MemoryManager) {
  this.manager = manager || new MemoryManager(); // ❌ Hidden creation
}

// YES: Explicit requirements
constructor(config: Config, manager: MemoryManager) {
  this.manager = manager; // ✅ Caller provides
}
```

**Explicit Workflows:**
```typescript
// NO: Magic strings
if (mode === 'executing') { ... } // ❌ What modes exist?

// YES: Discriminated unions
type Mode = { type: 'planning' } | { type: 'executing', plan: Plan };
switch (mode.type) {
  case 'planning': ...
  case 'executing': ...
}
```

### Principle 3: **Type Safety First**

- Enable **all** strict TypeScript options
- NO `any`, `unknown` only when truly unknown
- NO `!` unless proven safe with comment explaining why
- Use branded types for IDs: `type PlanId = string & { __brand: 'PlanId' }`
- Exhaustive switch checks with `never`

### Principle 4: **Testability By Design**

- Pure functions wherever possible (no side effects)
- Small, focused modules (< 200 lines)
- Clear input/output contracts
- Mock-friendly interfaces

### Principle 5: **Performance By Default**

- Parallel execution for independent operations
- Streaming responses, not batch-only
- Lazy loading, not upfront
- Measure first, optimize second (but design for it)

### Principle 6: **Safety Without Friction**

- Dangerous operations require confirmation (but queue them, don't block)
- Protected files, command whitelists (motivated from v1)
- Size limits, timeouts (carry forward)
- Clear error messages with recovery suggestions

### Principle 7: **Tooling Before Code**

```bash
# Phase 0: Setup (BEFORE any src/ code)
npm init -y
npm install -D typescript prettier eslint husky lint-staged
npx husky init
# Configure .prettierrc, .eslintrc, tsconfig.json
# Write pre-commit hook
# THEN start coding
```

### Principle 8: **No Magic, No Clever**

- Straightforward code > clever abstractions
- NO dependency injection containers (overkill)
- NO complex metaprogramming
- NO dynamic code generation
- Boring is good

---

## 3. Architecture Overview

### 3.1 High-Level System Design

```
┌──────────────────────────────────────────────────────────────────┐
│                         DISPLAY LAYER                            │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ TUI Manager  │  │ CLI Parser   │  │ Progress Renderer    │  │
│  │              │  │              │  │ (Formatters)         │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                  │                     │              │
└─────────┼──────────────────┼─────────────────────┼──────────────┘
          │                  │                     │
          └──────────────────┴─────────────────────┘
                             │
┌──────────────────────────────▼───────────────────────────────────┐
│                         DOMAIN LAYER                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │            Agent Orchestrator (State Machine)            │    │
│  │  - AgentStateMachine (explicit states & transitions)    │    │
│  │  - AgentOrchestrator (tool calling loop)                │    │
│  └────────┬──────────────┬──────────────┬───────────────────┘   │
│           │              │              │                        │
│  ┌────────▼────┐  ┌──────▼──────┐  ┌───▼────────────┐          │
│  │   Plan      │  │   Tool      │  │   Context      │          │
│  │   Manager   │  │   Registry  │  │   Builder      │          │
│  │             │  │             │  │                │          │
│  │ - Create    │  │ - Execute   │  │ - Build        │          │
│  │ - Update    │  │ - Batch     │  │ - Summarize    │          │
│  │ - Validate  │  │ - Validate  │  │ - Truncate     │          │
│  └─────────────┘  └─────────────┘  └────────────────┘          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                             │
                             │ calls
                             │
┌──────────────────────────────▼───────────────────────────────────┐
│                         DATA LAYER                               │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐  │
│  │  Ollama    │  │  Vectra    │  │  SQLite    │  │   File   │  │
│  │  Client    │  │  Memory    │  │  Sessions  │  │  System  │  │
│  │            │  │            │  │            │  │          │  │
│  │ - Chat     │  │ - Embed    │  │ - Create   │  │ - Read   │  │
│  │ - Embed    │  │ - Search   │  │ - Load     │  │ - Write  │  │
│  │ - Health   │  │ - Store    │  │ - Update   │  │ - List   │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Request Flow Example

**User:** "Read package.json and create a summary"

```
1. [DISPLAY] TUI captures input
   → calls display/cli/handleUserInput()

2. [DISPLAY] CLI parses command
   → calls domain/orchestrator.processMessage()

3. [DOMAIN] Orchestrator creates execution context
   → calls domain/contextBuilder.build()
   → calls data/vectra.searchRelevantMemories()
   → calls data/sqlite.loadPlan()

4. [DOMAIN] Orchestrator calls LLM
   → calls data/ollama.chat()
   → LLM returns: { tool_call: { tool: 'read_file', args: {path: 'package.json'} } }

5. [DOMAIN] Orchestrator executes tool
   → calls domain/toolRegistry.execute('read_file', ...)
   → tool calls data/filesystem.readFile()
   → returns file content

6. [DOMAIN] Orchestrator calls LLM again
   → calls data/ollama.chat()
   → LLM returns: { response: "Summary: ..." }

7. [DOMAIN] Orchestrator updates plan
   → calls domain/planManager.addLogEntry()
   → calls data/filesystem.writePlan()

8. [DOMAIN] Orchestrator stores memory
   → calls data/vectra.storeMemory()

9. [DOMAIN] Returns result to display
   → display/tui.renderResponse()
```

**Key Points:**
- Display never touches data layer
- Domain coordinates but doesn't implement infrastructure
- Data layer is pure I/O, no business logic

---

## 4. Directory Structure (example, subject to change)

```
simple-agent/
├── src/
│   ├── display/                    # DISPLAY LAYER
│   │   ├── tui/                    # Terminal UI (Ink/React)
│   │   │   ├── App.tsx             # Main TUI component
│   │   │   ├── components/
│   │   │   │   ├── PlanPanel.tsx   # Right pane: plan visualization
│   │   │   │   ├── ChatPanel.tsx   # Left pane: conversation
│   │   │   │   ├── InputBox.tsx    # Bottom: user input
│   │   │   │   └── StatusBar.tsx   # Status + mode display
│   │   │   ├── hooks/              # Custom React hooks
│   │   │   │   └── useAgentState.ts # Agent state management
│   │   │   └── theme.ts            # Colors, styling
│   │   ├── cli/                    # Command-line interface
│   │   │   ├── commands.ts         # Commander.js setup
│   │   │   ├── interactive.ts      # Interactive mode handler
│   │   │   ├── autonomous.ts       # Autonomous mode handler
│   │   │   └── plan.ts             # Plan mode handler
│   │   ├── formatters/             # Output formatting
│   │   │   ├── planFormatter.ts    # Render plans as markdown/table
│   │   │   ├── diffFormatter.ts    # Visualize plan diffs
│   │   │   ├── progressFormatter.ts# Iteration progress bars
│   │   │   └── errorFormatter.ts   # User-friendly error messages
│   │   └── types/                  # Display-specific types
│   │       ├── TUIConfig.ts
│   │       └── ProgressInfo.ts
│   │
│   ├── domain/                     # DOMAIN LAYER (Business Logic)
│   │   ├── agent/                  # Agent orchestration
│   │   │   ├── AgentOrchestrator.ts        # Main loop
│   │   │   ├── AgentStateMachine.ts        # State management
│   │   │   ├── AgentConfig.ts              # Configuration
│   │   │   └── types/
│   │   │       ├── AgentState.ts           # State discriminated union
│   │   │       └── AgentEvent.ts           # Events that trigger transitions
│   │   ├── plan/                   # Plan management
│   │   │   ├── PlanManager.ts              # CRUD operations
│   │   │   ├── PlanValidator.ts            # Validation rules
│   │   │   ├── PlanDiffer.ts               # Compute diffs
│   │   │   └── types/
│   │   │       ├── Plan.ts                 # Plan model
│   │   │       ├── PlanTask.ts             # Task model
│   │   │       └── PlanUpdate.ts           # Update operations
│   │   ├── tools/                  # Tool management
│   │   │   ├── ToolRegistry.ts             # Register & lookup
│   │   │   ├── ToolExecutor.ts             # Execute with validation
│   │   │   ├── ToolBatcher.ts              # Batch parallel calls
│   │   │   ├── definitions/                # Tool definitions
│   │   │   │   ├── files/
│   │   │   │   │   ├── ReadFileTool.ts
│   │   │   │   │   ├── WriteFileTool.ts
│   │   │   │   │   ├── EditFileTool.ts
│   │   │   │   │   └── ListDirTool.ts
│   │   │   │   ├── shell/
│   │   │   │   │   └── ShellTool.ts
│   │   │   │   ├── plan/
│   │   │   │   │   ├── InitializePlanTool.ts
│   │   │   │   │   └── UpdatePlanTool.ts
│   │   │   │   └── web/
│   │   │   │       ├── SearchTool.ts
│   │   │   │       └── FetchTool.ts
│   │   │   └── types/
│   │   │       ├── Tool.ts                 # Tool interface
│   │   │       ├── ToolResult.ts           # Result type
│   │   │       └── ToolParameter.ts        # Parameter spec
│   │   ├── context/                # Context building
│   │   │   ├── ContextBuilder.ts           # Assemble context
│   │   │   ├── ContextTruncator.ts         # Fit in token limits
│   │   │   ├── ContextSummarizer.ts        # Summarize iterations
│   │   │   └── types/
│   │   │       └── ContextConfig.ts
│   │   ├── safety/                 # Safety guards
│   │   │   ├── FileProtector.ts            # Protected files list
│   │   │   ├── CommandGuard.ts             # Dangerous command detection
│   │   │   ├── SizeLimiter.ts              # File/output size checks
│   │   │   └── ConfirmationQueue.ts        # Queue pending approvals
│   │   └── types/                  # Shared domain types
│   │       ├── Message.ts                  # Chat message
│   │       └── Config.ts                   # Global config
│   │
│   ├── data/                       # DATA LAYER (Infrastructure)
│   │   ├── models/                 # LLM interactions
│   │   │   ├── OllamaClient.ts             # HTTP client for Ollama API
│   │   │   ├── ModelSelector.ts            # Select model by task type
│   │   │   ├── StreamHandler.ts            # Handle streaming responses
│   │   │   └── types/
│   │   │       ├── ChatRequest.ts
│   │   │       ├── ChatResponse.ts
│   │   │       └── EmbeddingResponse.ts
│   │   ├── memory/                 # Vector memory
│   │   │   ├── VectraAdapter.ts            # Vectra operations
│   │   │   ├── EmbeddingGenerator.ts       # Create embeddings
│   │   │   └── types/
│   │   │       ├── MemoryEntry.ts
│   │   │       └── SearchResult.ts
│   │   ├── sessions/               # Session persistence
│   │   │   ├── SQLiteAdapter.ts            # SQLite operations
│   │   │   └── types/
│   │   │       └── Session.ts
│   │   ├── filesystem/             # File operations
│   │   │   ├── FileReader.ts               # Read with safety checks
│   │   │   ├── FileWriter.ts               # Write with protections
│   │   │   ├── FileEditor.ts               # Edit operations
│   │   │   └── DirectoryLister.ts          # List directories
│   │   ├── plans/                  # Plan persistence
│   │   │   ├── PlanRepository.ts           # Save/load plans
│   │   │   └── MarkdownSerializer.ts       # Plan ↔ Markdown
│   │   └── shell/                  # Shell execution
│   │       ├── ShellExecutor.ts            # Execute commands
│   │       └── CommandValidator.ts         # Pre-execution checks
│   │
│   ├── shared/                     # Shared utilities
│   │   ├── errors/                 # Custom error types
│   │   │   ├── AgentError.ts
│   │   │   ├── ToolError.ts
│   │   │   └── DataError.ts
│   │   ├── utils/                  # Pure utility functions
│   │   │   ├── pathHelpers.ts              # Path resolution, tilde expansion
│   │   │   ├── stringHelpers.ts            # Truncation, sanitization
│   │   │   ├── jsonHelpers.ts              # Safe JSON parsing
│   │   │   └── timeHelpers.ts              # Timestamp formatting
│   │   └── types/                  # Global type definitions
│   │       ├── Result.ts                   # Result<T, E> type
│   │       └── Brand.ts                    # Branded type helpers
│   │
│   └── index.ts                    # Entry point
│
├── tests/                          # Test files (mirror src/)
│   ├── unit/                       # Pure function tests
│   │   ├── domain/
│   │   └── shared/
│   ├── integration/                # Layer interaction tests
│   │   ├── agent-orchestration.test.ts
│   │   └── plan-lifecycle.test.ts
│   └── e2e/                        # End-to-end scenarios
│       └── complete-workflow.test.ts
│
├── config/                         # Configuration files
│   ├── models.json                 # Model selection rules
│   └── defaults.json               # Default settings
│
├── scripts/                        # Build/dev scripts
│   ├── setup.sh                    # Initial setup
│   └── check-models.ts             # Verify Ollama models
│
├── .eslintrc.json                  # ESLint config (Airbnb)
├── .prettierrc                     # Prettier config
├── tsconfig.json                   # TypeScript config (strict)
├── vitest.config.ts                # Vitest config
├── package.json
└── ARCHITECTURE.md                 # This document
```

**Key Points:**
- Clear layer boundaries (display/ vs domain/ vs data/)
- Each module has its own types/ subdirectory
- Tests mirror source structure
- Shared utilities in shared/, not scattered

---

## 5. Layer Responsibilities

### 5.1 Display Layer (`src/display/`)

**Purpose:** User interaction, rendering, CLI parsing

**Responsibilities:**
- Capture user input (keyboard, commands)
- Render output (TUI panels, terminal output)
- Format data for display (plans, progress, errors)
- Parse CLI arguments 
- Provide progress callbacks to domain layer

**What It Does NOT Do:**
- ❌ Business logic (plan validation, tool execution)
- ❌ Data access (Ollama API calls, file I/O)
- ❌ State management (agent state, session state)

**Example:**
```typescript
// ✅ GOOD: Display layer (Ink/React component)
import { Box, Text } from 'ink';
import React from 'react';

const App: React.FC<{ plan: Plan; onInput: (input: string) => void }> = ({ plan, onInput }) => {
  const markdown = formatPlanAsMarkdown(plan); // Formatting only

  return (
    <Box flexDirection="column">
      <PlanPanel content={markdown} />
      <InputBox onSubmit={onInput} />
    </Box>
  );
};

// ❌ BAD: Display layer doing business logic
const App: React.FC<{ plan: Plan }> = ({ plan }) => {
  // Validation belongs in domain!
  if (plan.tasks.length === 0) {
    plan.tasks.push({ description: 'Default task', status: 'pending' });
  }

  return <PlanPanel content={formatPlan(plan)} />;
};
```

### 5.2 Domain Layer (`src/domain/`)

**Purpose:** Business logic, orchestration, coordination

**Responsibilities:**
- Orchestrate agent execution loop
- Manage agent state machine
- Validate business rules
- Coordinate tool execution
- Assemble context for LLM
- Enforce safety policies
- Manage plan lifecycle

**What It Does NOT Do:**
- ❌ HTTP requests (delegates to data layer)
- ❌ File I/O (delegates to data layer)
- ❌ UI rendering (delegates to display layer)

**Example:**
```typescript
// ✅ GOOD: Domain layer orchestrating
class AgentOrchestrator {
  async processMessage(
    userMessage: string,
    ollama: OllamaClient,        // Data layer injected
    planManager: PlanManager,    // Domain collaborator
    toolRegistry: ToolRegistry   // Domain collaborator
  ): Promise<string> {
    // Business logic: build context
    const context = await this.contextBuilder.build(userMessage);

    // Delegate to data layer for LLM call
    const response = await ollama.chat(context);

    // Business logic: interpret response
    if (this.isToolCall(response)) {
      const result = await toolRegistry.execute(response.tool, response.args);
      return this.processMessage(result.output, ollama, planManager, toolRegistry);
    }

    return response.content;
  }
}

// ❌ BAD: Domain layer doing infrastructure
class AgentOrchestrator {
  async processMessage(userMessage: string): Promise<string> {
    // Domain shouldn't know about HTTP!
    const response = await axios.post('http://localhost:11434/api/chat', {...});
    return response.data;
  }
}
```

### 5.3 Data Layer (`src/data/`)

**Purpose:** Infrastructure, I/O, external systems

**Responsibilities:**
- HTTP requests to Ollama API
- File system operations
- Database queries (SQLite, Vectra)
- Shell command execution
- Serialization/deserialization
- Error handling for infrastructure failures

**What It Does NOT Do:**
- ❌ Business rules (plan validation, tool approval logic)
- ❌ Orchestration (agent loops, context building)
- ❌ UI concerns (formatting, rendering)

**Example:**
```typescript
// ✅ GOOD: Data layer is pure I/O
class OllamaClient {
  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await axios.post<ChatResponse>(
        `${this.baseUrl}/api/chat`,
        request,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new DataError(`Ollama API error: ${error.response?.statusText || error.message}`, { cause: error });
      }
      throw new DataError('Failed to call Ollama API', { cause: error });
    }
  }
}

// ❌ BAD: Data layer doing business logic
class OllamaClient {
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Business logic about model selection doesn't belong here!
    if (request.messages.some(m => m.content.includes('architecture'))) {
      request.model = 'qwen2.5-coder:32b';
    }

    const response = await axios.post(`${this.baseUrl}/api/chat`, request);
    return response.data;
  }
}
```

---

## 6. Module Design

### 6.1 Agent Orchestrator (Domain)

**File:** `src/domain/agent/AgentOrchestrator.ts`

**Responsibility:** Execute the tool-calling loop

**Interface:**
```typescript
interface AgentOrchestrator {
  /**
   * Process a user message and return the final response
   *
   * @param message - User input
   * @param context - Execution context (dependencies)
   * @param callbacks - Progress notifications
   * @returns Final agent response
   */
  processMessage(
    message: string,
    context: ExecutionContext,
    callbacks: ProgressCallbacks
  ): Promise<string>;
}

interface ExecutionContext {
  ollama: OllamaClient;
  planManager: PlanManager;
  toolRegistry: ToolRegistry;
  contextBuilder: ContextBuilder;
  config: AgentConfig;
}

interface ProgressCallbacks {
  onStateChange?(state: AgentState): void;
  onToolCall?(tool: string, args: Record<string, unknown>): void;
  onToolResult?(tool: string, result: ToolResult): void;
  onThinking?(thought: string): void;
  onIterationComplete?(iteration: number, summary: string): void;
}
```

**Implementation Pattern:**
```typescript
class AgentOrchestrator {
  async processMessage(
    message: string,
    context: ExecutionContext,
    callbacks: ProgressCallbacks
  ): Promise<string> {
    let state: AgentState = { type: 'idle' };
    let iterations = 0;
    const maxIterations = context.config.maxIterations;

    while (iterations < maxIterations) {
      iterations++;

      // Build LLM context
      const llmMessages = await context.contextBuilder.build(state, message);

      // Call LLM
      const response = await context.ollama.chat({
        model: context.config.model,
        messages: llmMessages,
      });

      // Parse response
      const parsed = this.parseResponse(response.message.content);

      // Transition state based on response
      if (parsed.type === 'tool_call') {
        state = { type: 'executing_tool', tool: parsed.tool, args: parsed.args };
        callbacks.onStateChange?.(state);

        // Execute tool (synchronously for now, batch later)
        const result = await context.toolRegistry.execute(parsed.tool, parsed.args);
        callbacks.onToolResult?.(parsed.tool, result);

        // Add result to context for next iteration
        state = { type: 'tool_completed', result };

      } else if (parsed.type === 'final_response') {
        state = { type: 'completed', response: parsed.response };
        callbacks.onStateChange?.(state);
        return parsed.response;

      } else {
        // Unparseable response
        state = { type: 'error', error: new Error('Invalid response format') };
        callbacks.onStateChange?.(state);
        throw state.error;
      }
    }

    // Hit max iterations
    throw new Error(`Reached max iterations (${maxIterations})`);
  }

  private parseResponse(content: string): ParsedResponse {
    // JSON parsing logic
    // Returns discriminated union: { type: 'tool_call' } | { type: 'final_response' }
  }
}
```

**Testing Strategy:**
```typescript
describe('AgentOrchestrator', () => {
  it('should execute tool call and return response', async () => {
    // Mock dependencies
    const mockOllama = {
      chat: vi.fn()
        .mockResolvedValueOnce({
          message: { content: JSON.stringify({ tool_call: { tool: 'read_file', ... } }) }
        })
        .mockResolvedValueOnce({
          message: { content: JSON.stringify({ response: 'File content is...' }) }
        })
    };

    const mockToolRegistry = {
      execute: vi.fn().mockResolvedValue({ success: true, output: 'file contents' })
    };

    // Execute
    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.processMessage('Read package.json', {
      ollama: mockOllama,
      toolRegistry: mockToolRegistry,
      // ... other mocks
    }, {});

    // Assert
    expect(result).toBe('File content is...');
    expect(mockOllama.chat).toHaveBeenCalledTimes(2);
    expect(mockToolRegistry.execute).toHaveBeenCalledWith('read_file', expect.any(Object));
  });
});
```

### 6.2 Plan Manager (Domain)

**File:** `src/domain/plan/PlanManager.ts`

**Responsibility:** CRUD operations for plans, validation, diffing

**Interface:**
```typescript
interface PlanManager {
  create(sessionId: string, goal: string): Plan;
  load(sessionId: string): Plan | null;
  save(plan: Plan): void;
  update(plan: Plan, updates: PlanUpdate): Plan;
  validate(plan: Plan): ValidationResult;
  diff(oldPlan: Plan, newPlan: Plan): PlanDiff;
  addTask(plan: Plan, task: PlanTask): Plan;
  updateTaskStatus(plan: Plan, taskIndex: number, status: TaskStatus): Plan;
  addLogEntry(plan: Plan, entry: PlanLogEntry): Plan;
}

type ValidationResult =
  | { valid: true }
  | { valid: false; errors: ValidationError[] };

interface PlanUpdate {
  goal?: string;
  goals?: string[];
  architecture?: Partial<Architecture>;
  tasks?: PlanTask[];
}
```

**Implementation:**
```typescript
class PlanManager {
  constructor(private repository: PlanRepository) {}

  create(sessionId: string, goal: string): Plan {
    return {
      planId: crypto.randomUUID(),
      sessionId,
      goal,
      goals: [],
      architecture: { overview: '', dataFlow: '', decisions: [] },
      tasks: [],
      executionLog: [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        status: 'planning',
      },
    };
  }

  update(plan: Plan, updates: PlanUpdate): Plan {
    const updated = {
      ...plan,
      ...updates,
      metadata: {
        ...plan.metadata,
        updatedAt: Date.now(),
        version: plan.metadata.version + 1,
      },
    };

    // Validate before saving
    const validation = this.validate(updated);
    if (!validation.valid) {
      throw new DomainError('Invalid plan update', { errors: validation.errors });
    }

    // Delegate persistence to data layer
    this.repository.save(updated);

    return updated;
  }

  validate(plan: Plan): ValidationResult {
    const errors: ValidationError[] = [];

    if (!plan.goal || plan.goal.trim().length === 0) {
      errors.push({ field: 'goal', message: 'Goal is required' });
    }

    if (plan.tasks.some(t => !t.description || t.description.trim().length === 0)) {
      errors.push({ field: 'tasks', message: 'All tasks must have descriptions' });
    }

    // More validation rules...

    return errors.length === 0
      ? { valid: true }
      : { valid: false, errors };
  }
}
```

### 6.3 Tool Registry (Domain)

**File:** `src/domain/tools/ToolRegistry.ts`

**Responsibility:** Register tools, execute with validation, batch parallel calls

**Interface:**
```typescript
interface ToolRegistry {
  register(tool: Tool): void;
  unregister(toolName: string): void;
  list(): Tool[];
  getSchema(toolName: string): ToolSchema;
  getAllSchemas(): string; // Formatted for LLM prompt

  execute(toolName: string, args: Record<string, unknown>): Promise<ToolResult>;
  executeBatch(calls: ToolCall[]): Promise<ToolResult[]>; // Parallel execution
}

interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}
```

**Implementation with Batching:**
```typescript
class ToolRegistry {
  private tools = new Map<string, Tool>();

  async execute(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${toolName}' not found`,
      };
    }

    // Validate parameters
    const validation = this.validateParameters(tool, args);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid parameters: ${validation.errors.join(', ')}`,
      };
    }

    // Execute
    try {
      return await tool.execute(args);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async executeBatch(calls: ToolCall[]): Promise<ToolResult[]> {
    // Execute all calls in parallel
    return Promise.all(
      calls.map(call => this.execute(call.tool, call.args))
    );
  }

  private validateParameters(tool: Tool, args: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    for (const param of tool.parameters) {
      if (param.required && !(param.name in args)) {
        errors.push(`Missing required parameter: ${param.name}`);
      }

      if (param.name in args && typeof args[param.name] !== param.type) {
        errors.push(`Parameter '${param.name}' must be of type ${param.type}`);
      }
    }

    return errors.length === 0
      ? { valid: true }
      : { valid: false, errors };
  }
}
```

### 6.4 Ollama Client (Data)

**File:** `src/data/models/OllamaClient.ts`

**Responsibility:** HTTP communication with Ollama API

**Interface:**
```typescript
interface OllamaClient {
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest): AsyncIterator<ChatChunk>;
  generateEmbedding(model: string, text: string): Promise<number[]>;
  listModels(): Promise<Model[]>;
  healthCheck(): Promise<boolean>;
}

interface ChatRequest {
  model: string;
  messages: Message[];
  format?: 'json';
  options?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };
}

interface ChatResponse {
  model: string;
  message: Message;
  done: boolean;
}
```

**Implementation:**
```typescript
class OllamaClient {
  constructor(
    private baseUrl: string = 'http://localhost:11434',
    private timeout: number = 300000
  ) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await axios.post<ChatResponse>(
        `${this.baseUrl}/api/chat`,
        request,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.timeout,
        }
      );

      return response.data;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new DataError('Request timeout', { cause: error });
        }
        throw new DataError(
          `Ollama API error: ${error.response?.status} ${error.response?.statusText || error.message}`,
          { cause: error }
        );
      }
      throw new DataError('Failed to call Ollama API', { cause: error });
    }
  }

  async *chatStream(request: ChatRequest): AsyncIterator<ChatChunk> {
    const response = await axios.post(
      `${this.baseUrl}/api/chat`,
      { ...request, stream: true },
      {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'stream',
      }
    );

    const stream = response.data;
    const decoder = new TextDecoder();

    // Handle stream data events
    for await (const chunk of stream) {
      const text = decoder.decode(chunk);
      const lines = text.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          yield JSON.parse(line) as ChatChunk;
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000, // 5s timeout for health check
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## 7. Development Workflow

### 7.1 Phase 0: Tooling Setup (BEFORE any code)

**Step 1: Initialize Project**
```bash
npm init -y
```

**Step 2: Install Dev Dependencies**
```bash
npm install -D \
  typescript \
  @types/node \
  prettier \
  eslint \
  @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin \
  eslint-config-airbnb-base \
  eslint-config-airbnb-typescript \
  eslint-plugin-import \
  vitest \
  @vitest/ui \
  husky \
  lint-staged
```

**Step 3: Install Runtime Dependencies**
```bash
npm install \
  axios \
  ink \
  react \
  commander \
  vectra \
  better-sqlite3

npm install -D \
  @types/react
```

**Note on HTTP Client:** This project uses **Axios** as the standard HTTP client for all RESTful API calls. Axios is preferred over native `fetch` for:
- Automatic JSON transformation (no need for `JSON.stringify()` or `.json()`)
- Built-in timeout support (simpler than AbortController)
- Automatic error throwing on non-2xx status codes
- Request/response interceptors for logging and error handling
- Better TypeScript support for request/response types

**Note on Terminal UI:** This project uses **Ink** (React for CLIs) for building the terminal interface. Ink is preferred over Blessed for:
- **React-based:** Familiar component model, hooks, and state management
- **Better TypeScript support:** Strong typing for props and components
- **Modern patterns:** Functional components, custom hooks, context API
- **Testing:** Easier to test with React Testing Library
- **Composability:** Clean component composition and reusability

**Step 4: Configure TypeScript (`tsconfig.json`)**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",

    "outDir": "./dist",
    "rootDir": "./src",

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,

    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 5: Configure Prettier (`.prettierrc`)**
```json
{}
```
IMPORTANT, USE DEFAULTS, ZERO EXCEPTIONS

**Step 6: Configure ESLint (`.eslintrc.json`)**
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "extends": [
    "airbnb-base",
    "airbnb-typescript/base",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "plugins": ["@typescript-eslint"],
  "rules": {
    "no-console": "off",
    "import/prefer-default-export": "off",
    "class-methods-use-this": "off",
    "@typescript-eslint/no-use-before-define": ["error", { "functions": false }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "import/extensions": ["error", "always", { "ignorePackages": true }]
  }
}
```

**Step 7: Configure Vitest (`vitest.config.ts`)**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/types/**'],
    },
  },
});
```

**Step 8: Configure Git Hooks (`package.json`)**
```json
{
  "scripts": {
    "prepare": "husky install",
    "lint": "eslint 'src/**/*.ts'",
    "format": "prettier --write 'src/**/*.ts'",
    "format:check": "prettier --check 'src/**/*.ts'",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "build": "tsc",
    "precommit": "lint-staged"
  },
  "lint-staged": {
    "src/**/*.ts": [
      "prettier --write",
      "eslint --fix",
      "vitest related --run"
    ]
  }
}
```

**Step 9: Initialize Husky**
```bash
npx husky install
npx husky add .husky/pre-commit "npm run precommit"
```

**Step 10: Verify Setup**
```bash
# Create dummy file to test
mkdir -p src
echo "export const test = 'hello';" > src/test.ts

# Should pass
npm run format:check
npm run lint
npm run typecheck

# Should fail (intentionally break formatting)
echo "export   const   test='hello';" > src/test.ts
npm run format:check  # Fails

# Auto-fix
npm run format
npm run format:check  # Passes now

# Clean up
rm src/test.ts
```

**✅ Checkpoint:** You should have:
- All commands (`lint`, `format`, `typecheck`) passing
- Pre-commit hook running on `git commit`
- Zero TypeScript errors, zero ESLint errors

### 7.2 Phase 1: Data Layer (Bottom-Up)

**Rationale:** Build infrastructure first, no dependencies on business logic

**Order:**
1. `src/data/models/OllamaClient.ts` - Pure HTTP client
2. `src/data/filesystem/FileReader.ts` - File operations
3. `src/data/memory/VectraAdapter.ts` - Vector storage
4. `src/data/sessions/SQLiteAdapter.ts` - Session persistence

**Test as you go:**
```bash
# After each module
npm test src/data/models/OllamaClient.test.ts
```

### 7.3 Phase 2: Domain Layer (Business Logic)

**Order:**
1. `src/domain/tools/definitions/*` - Individual tools (no dependencies)
2. `src/domain/tools/ToolRegistry.ts` - Tool registration & validation
3. `src/domain/plan/PlanManager.ts` - Plan CRUD (depends on data layer for persistence)
4. `src/domain/context/ContextBuilder.ts` - Assemble context for LLM
5. `src/domain/agent/AgentOrchestrator.ts` - Main loop (depends on all above)

### 7.4 Phase 3: Display Layer (UI)

**Order:**
1. `src/display/formatters/*` - Pure formatting functions
2. `src/display/cli/commands.ts` - CLI parsing
3. `src/display/tui/*` - TUI components
4. `src/index.ts` - Wire everything together

### 7.5 Development Rules

**Rule 1: No Code Without Tests**
- Every module gets a `.test.ts` file
- Aim for 80%+ coverage
- Integration tests for critical paths

**Rule 2: Commit Often**
```bash
# Good commits
git commit -m "feat(data): add OllamaClient with streaming support"
git commit -m "test(domain): add ToolRegistry validation tests"
git commit -m "fix(agent): prevent infinite loop on max iterations"

# Bad commits
git commit -m "updates"
git commit -m "WIP"
```

**Rule 3: Pre-Commit Hook is Law**
- If pre-commit fails, fix the issues
- Do NOT use `git commit --no-verify`
- Do NOT disable hooks

**Rule 4: Type Safety First**
```typescript
// ✅ GOOD
function processPlan(plan: Plan): Result<string, PlanError> {
  if (!plan.goal) {
    return { success: false, error: { type: 'missing_goal' } };
  }
  return { success: true, value: plan.goal };
}

// ❌ BAD
function processPlan(plan: any): string {
  return plan.goal || 'default';
}
```

**Rule 5: Pure Functions Where Possible**
```typescript
// ✅ GOOD: Pure function
function formatTaskList(tasks: PlanTask[]): string {
  return tasks.map((t, i) => `${i}. ${t.description}`).join('\n');
}

// ❌ BAD: Side effects hidden
function formatTaskList(tasks: PlanTask[]): string {
  console.log('Formatting tasks...'); // Side effect!
  return tasks.map((t, i) => `${i}. ${t.description}`).join('\n');
}
```

---

## 8. Data Models

### 8.1 Core Domain Types

**Plan:**
```typescript
type PlanId = string & { __brand: 'PlanId' };
type SessionId = string & { __brand: 'SessionId' };
type TaskId = string & { __brand: 'TaskId' };

interface Plan {
  planId: PlanId;
  sessionId: SessionId;
  goal: string;
  goals: string[];
  architecture: Architecture;
  tasks: PlanTask[];
  executionLog: PlanLogEntry[];
  metadata: PlanMetadata;
}

interface Architecture {
  overview: string;
  dataFlow: string;
  decisions: ArchitectureDecision[];
}

interface ArchitectureDecision {
  title: string;
  rationale: string;
  timestamp: number;
}

interface PlanTask {
  id: TaskId;
  description: string;
  status: TaskStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

interface PlanLogEntry {
  timestamp: number;
  type: LogEntryType;
  content: string;
  taskId?: TaskId;
}

type LogEntryType =
  | 'task_start'
  | 'task_complete'
  | 'thought'
  | 'tool_call'
  | 'error'
  | 'iteration_summary';

interface PlanMetadata {
  createdAt: number;
  updatedAt: number;
  version: number;
  status: PlanStatus;
  modelUsed: string;
  totalDuration: number;
  toolCalls: number;
  filesModified: string[];
}

type PlanStatus = 'planning' | 'executing' | 'completed' | 'failed';
```

**Agent State:**
```typescript
type AgentState =
  | { type: 'idle' }
  | { type: 'planning'; currentGoal: string }
  | { type: 'executing_tool'; tool: string; args: Record<string, unknown> }
  | { type: 'tool_completed'; result: ToolResult }
  | { type: 'waiting_approval'; operation: PendingOperation }
  | { type: 'completed'; response: string }
  | { type: 'error'; error: Error; recoverable: boolean };

interface PendingOperation {
  type: 'file_write' | 'file_edit' | 'shell_command';
  description: string;
  tool: string;
  args: Record<string, unknown>;
}
```

**Tool Types:**
```typescript
interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
}

interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
```

**Message Types:**
```typescript
interface Message {
  role: MessageRole;
  content: string;
  timestamp?: number;
}

type MessageRole = 'system' | 'user' | 'assistant';

interface ChatRequest {
  model: string;
  messages: Message[];
  format?: 'json';
  options?: ChatOptions;
}

interface ChatOptions {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
}

interface ChatResponse {
  model: string;
  message: Message;
  done: boolean;
  total_duration?: number;
}
```

### 8.2 Result Type Pattern

```typescript
// Instead of throwing errors, return Result type
type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

// Usage
function readFile(path: string): Result<string, FileError> {
  try {
    const content = fs.readFileSync(path, 'utf-8');
    return { success: true, value: content };
  } catch (error) {
    return {
      success: false,
      error: { type: 'not_found', path, cause: error }
    };
  }
}

// Caller handles explicitly
const result = readFile('test.txt');
if (result.success) {
  console.log(result.value); // TypeScript knows this exists
} else {
  console.error(result.error.type); // TypeScript knows this exists
}
```

---

## 9. Migration Strategy

v1 can be referenced in the /simple-agent directory, but this is a net new project, NOT a migration

---

## 10. Success Metrics

### 10.1 Code Quality Metrics

**TypeScript Strictness:**
- ✅ Zero TypeScript errors
- ✅ `strict: true` enabled
- ✅ No `any` types (except in JSON parsing edge cases)
- ✅ No `!` operators (except with explaining comments)

**Test Coverage:**
- ✅ 80%+ overall coverage
- ✅ 100% coverage for domain layer (business logic)
- ✅ Integration tests for critical paths
- ✅ E2E test for complete workflow

**Linting:**
- ✅ Zero ESLint errors
- ✅ Zero Prettier issues
- ✅ Pre-commit hooks passing

### 10.2 Architecture Metrics

**Separation of Concerns:**
- ✅ Display layer imports zero data layer modules
- ✅ Data layer imports zero domain layer modules
- ✅ No circular dependencies

**Module Size:**
- ✅ Average file size < 200 lines
- ✅ No file > 500 lines
- ✅ Functions < 50 lines

**Coupling:**
- ✅ Each module has < 5 dependencies
- ✅ Core orchestrator has < 10 dependencies

### 10.3 Performance Metrics

**Tool Execution:**
- ✅ Parallel tool execution (5 reads in 1 iteration vs. 5)
- ✅ < 100ms overhead per tool call
- ✅ Streaming responses (chunks visible in < 1s)

**Memory Usage:**
- ✅ < 100MB for typical session (1000 messages)
- ✅ Context window < 8K tokens (fits in all models)

**Latency:**
- ✅ Tool call → result in < 5s (local file operations)
- ✅ LLM call → response in < 30s (depends on model)

### 10.4 User Experience Metrics

**Clarity:**
- ✅ User knows current agent state (idle/planning/executing)
- ✅ Tool calls show what they're doing
- ✅ Errors have actionable messages

**Control:**
- ✅ File operations require confirmation (unless auto mode)
- ✅ User can interrupt long-running tasks (Ctrl+C)
- ✅ User can undo plan changes

**Reliability:**
- ✅ No crashes in normal operation
- ✅ Graceful degradation (Ollama down → clear error)
- ✅ Session recovery (can resume after crash)

---

## 11. Open Questions & Future Work

### 11.1 Unresolved Design Questions

**Q1: Should we support multiple LLM providers (OpenAI, Anthropic)?**
- **Current:** Ollama-only
- **Consideration:** Abstract `LLMClient` interface, implement multiple adapters
- **Decision:** Start with Ollama, abstract later if needed

**Q2: How to handle streaming in the orchestrator loop?**
- **Current:** Batch responses only
- **Consideration:** Need to parse incomplete JSON during streaming
- **Decision:** Phase 4 enhancement, batch for now

**Q3: Should tools be async iterators (for progress updates)?**
- **Current:** Tools return single result
- **Example:** `shell_exec` could yield partial stdout
- **Decision:** Nice-to-have, not MVP

**Q4: How to handle plan conflicts (concurrent edits)?**
- **Current:** Last write wins
- **Consideration:** Operational transform, CRDTs, or version locking
- **Decision:** Not a problem for single-agent, defer

### 11.2 Future Enhancements

**Multi-Agent Collaboration:**
- Architect agent designs, coder agent implements, reviewer agent checks
- Requires: Agent orchestrator that manages multiple agent instances
- Timeline: Post-MVP

**Plan Templates:**
- Pre-defined task lists for common workflows (feature, bugfix, refactor)
- Requires: Template library, template rendering
- Timeline: Phase 5

**Web UI:**
- Browser-based alternative to TUI
- Requires: HTTP server, WebSocket for streaming, React frontend
- Timeline: Post-MVP (TUI first)

**Plugin System:**
- User-defined tools via plugin API
- Requires: Sandboxed execution, plugin loader
- Timeline: Post-MVP

**Cloud Deployment:**
- Run agent as a service (shared Ollama instance)
- Requires: Multi-tenancy, authentication, resource limits
- Timeline: Far future

---

## 12. Appendix

### 12.1 Glossary

**Display Layer:** UI components, CLI parsing, rendering
**Domain Layer:** Business logic, orchestration, rules
**Data Layer:** Infrastructure, I/O, external systems
**Tool:** Function agent can call (read_file, execute_shell, etc.)
**Plan:** Structured task list with architecture decisions
**Agent State:** Current status of agent (idle, executing, error, etc.)
**Context:** Information fed to LLM (plan + memories + recent messages)
**Orchestrator:** Main loop that coordinates tool calling

### 12.2 References

**Existing Codebase:**
- v1 source: `./simple-agent/`
- Architecture review: This document

**Technologies:**
- [TypeScript](https://www.typescriptlang.org/)
- [Axios](https://axios-http.com/) - HTTP client
- [Ollama](https://ollama.ai/)
- [Ink](https://github.com/vadimdemedes/ink) - React for CLIs
- [React](https://react.dev/) - UI library (used by Ink)
- [Vectra](https://github.com/microsoft/vectra) - Local vector DB
- [Vitest](https://vitest.dev/) - Testing framework

### 12.3 Contributors

**Original Design:** v1 implementation (single developer)
**Architecture Review:** Claude Code (this document)
**v2 Design:** Collaborative (user feedback + architectural insights)

---

**End of Architecture Document**

*This is a living document. Update as design evolves.*
