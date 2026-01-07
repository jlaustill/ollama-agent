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

**Terminal UI Approach**
- v1 split panes were confusing in practice
- v1 boxed/bordered layout felt cluttered
- **v2 Change:** Single chat view, raw markdown output
  - Plan printed at start like `cat plan.md` (raw markdown, no boxes)
  - User scrolls up to review plan and chat history
  - Input box fixed at bottom (standard terminal UX)
  - Update plan via chat ("update task 3") OR `/editPlan` command (opens nano/editor)
- **Keep:** Real-time updates, streaming output
- **Discard:** Split-screen, complex 6-state system, box borders

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

// For session-level states (Plan Mode vs Execute Mode), see Section 3.2
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

### 3.2 Session State Model

The system uses a 2×2 orthogonal state model:

**Dimension 1: Session Mode** (What phase are we in?)
- **Plan Mode**: Agent only edits plan_doc.md, no other work
  - User reviews and modifies plan
  - Agent proposes task additions
  - No code changes, no tool execution
- **Execute Mode**: Agent performs task work
  - Executes tools to accomplish tasks
  - Makes changes toward acceptance criteria
  - Can switch back to Plan Mode if new work requested

**Dimension 2: Execution Policy** (How are changes approved?)
- **Confirm Mode**: Agent shows diff → User approves → Change applied
- **Auto Mode**: Agent makes changes automatically to finish current task

**State Transitions:**
```
┌─────────────┐         User approves       ┌──────────────┐
│ PLAN MODE   │ ──────────────────────────→ │ EXECUTE MODE │
│             │                              │              │
│ • Edit plan │ ←────────────────────────── │ • Do work    │
└─────────────┘  (task not in current plan) └──────────────┘

Sessions always start in Plan Mode.
```

**2×2 Matrix:**
| | Confirm | Auto |
|---|---|---|
| **Plan** | Review plan changes before applying | Apply plan changes immediately |
| **Execute** | Approve each tool execution | Complete task autonomously |

**Note:** This is simpler than v1's 3×2=6 state system because the two dimensions are orthogonal and independent.

---

## 4. Directory Structure (example, subject to change)

```
simple-agent/
├── src/
│   ├── display/                    # DISPLAY LAYER
│   │   ├── tui/                    # Terminal UI (Ink/React)
│   │   │   ├── App.tsx             # Main TUI component
│   │   │   ├── components/
│   │   │   │   ├── ChatView.tsx    # Scrolling chat + plan history
│   │   │   │   ├── InputBox.tsx    # Fixed bottom input box
│   │   │   │   ├── StatusBar.tsx   # Top: agent status + spinner
│   │   │   │   └── MarkdownOutput.tsx # Raw markdown rendering
│   │   │   ├── hooks/              # Custom React hooks
│   │   │   │   ├── useAgentState.ts # Agent state management
│   │   │   │   └── useScroll.ts    # Scroll position management
│   │   │   └── theme.ts            # Colors, styling (no boxes)
│   │   ├── cli/                    # Command-line interface
│   │   │   ├── commands.ts         # Yargs command definitions
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
- Capture user input (keyboard, commands, slash commands)
- Render output (scrolling chat, raw markdown, no boxes)
- Format data for display (plans, progress, errors)
- Parse CLI arguments
- Handle scroll position (user can scroll up to see history)
- Provide progress callbacks to domain layer
- Handle `/editPlan` command (opens editor)

**What It Does NOT Do:**
- ❌ Business logic (plan validation, tool execution)
- ❌ Data access (Ollama API calls, file I/O)
- ❌ State management (agent state, session state)

**Example:**
```typescript
// ✅ GOOD: Display layer (simple scrolling chat)
import { Box, Text } from 'ink';
import React from 'react';

const App: React.FC<{
  messages: Message[];
  agentStatus: AgentState;
  onInput: (input: string) => void;
}> = ({ messages, agentStatus, onInput }) => {
  // Pure formatting - no business logic
  const formattedMessages = formatMessagesAsMarkdown(messages);

  return (
    <Box flexDirection="column">
      {/* Top status bar */}
      <StatusBar status={agentStatus} />

      {/* Scrolling chat area (plan + conversation) */}
      <ChatView messages={formattedMessages} />

      {/* Fixed bottom input */}
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

  return <ChatView content={formatPlan(plan)} />;
};
```

#### 5.1.1 Simple Scrolling UX

**Problems in v1:**
- Split-screen panes were confusing (too much competing info)
- Box borders felt cluttered and noisy
- Mode switching added unnecessary complexity (3 modes × 2 submodes = 6 states)

**v2 Solution: Single scrolling chat view (like a terminal)**

**Example Terminal Output:**
```
Status: Idle ⏸️

# Project Plan: Build REST API

## Goal
Create user authentication API with JWT tokens

## Goals
- Secure password storage
- Token-based authentication
- Protected API routes

## Acceptance Criteria
- [x] Users can register with email/password
- [x] Passwords are hashed with bcrypt
- [ ] Users can login and receive JWT token
- [ ] Protected routes verify JWT tokens
- [ ] Tokens expire after 24 hours

## Decisions Made
- **Decision:** Use bcrypt for password hashing
  - **Rationale:** Industry standard, built-in salting, configurable work factor
  - **Alternatives:** argon2 (more modern, but bcrypt widely tested)
- **Decision:** JWT tokens with 24h expiry
  - **Rationale:** Balance between security and UX

## Execution Log
- [2024-01-06 10:30] Setup Express + TypeScript → Success
- [2024-01-06 10:45] Created User model with bcrypt → Success

────────────────────────────────────────────────

User: Implement the /register endpoint

Agent: I'll create the registration endpoint with validation and password hashing.

🔧 read_file("src/models/User.ts")
   Reading User model schema...

🔧 write_file("src/routes/auth.ts")
   Creating authentication routes...

Agent: ✓ Created /register endpoint with:
- Email/password validation
- Bcrypt password hashing
- JWT token generation

Updated plan: Task marked complete ✓

────────────────────────────────────────────────
> _
```

**Key UX Features:**

**1. Raw Markdown Output**
- Plan printed at start like `cat plan.md`
- No boxes, no borders, just clean markdown
- Easy to read, familiar formatting

**2. Scrolling History**
- User scrolls up to see plan and old messages
- Input box stays fixed at bottom (standard terminal behavior)
- Infinite scroll buffer (configurable max lines)

**3. Updating the Plan**

**Via Natural Language:**
```
> Hey, can you update task 3 to resolved?

Agent: Marking "Implement /register endpoint" as complete...
Updated plan ✓
```

**Via `/editPlan` Command:**
```
> /editPlan

⚠️  Agent pauses execution (state: 'waiting_user_edit')
[Opens plan.md in nano (or $EDITOR)]
[User edits, saves, exits]
Agent reviews changes...
  • 2 tasks added
  • 1 task marked complete
Plan updated ✓
Agent resumes execution
```

⚠️ **IMPORTANT:** `/editPlan` is **agent-managed** editing:
1. Agent pauses all operations (mutual exclusion)
2. Agent opens editor and waits for you to finish
3. Agent reviews your changes and validates the plan
4. Agent resumes with updated plan

This is different from editing plan.md externally (which is unsupported - see Q4 in Section 11.1).

**Implementation:**
```typescript
// Display layer handles slash commands, delegates to domain
const InputBox: React.FC<{ onSubmit: (input: string) => void }> = ({ onSubmit }) => {
  const handleSubmit = (input: string) => {
    // Display just captures input, domain handles command logic
    onSubmit(input);
  };

  return <TextInput onSubmit={handleSubmit} placeholder="Type message or /editPlan..." />;
};

// Domain layer handles /editPlan command
async function handleUserInput(input: string, context: ExecutionContext): Promise<void> {
  if (input === '/editPlan') {
    // 1. Snapshot current plan
    const oldPlan = deepClone(context.planManager.getCurrentPlan());

    // 2. Pause agent (state transition)
    context.callbacks.onStateChange({ type: 'waiting_user_edit', snapshot: oldPlan });

    // 3. Open editor (blocking)
    const editor = process.env.EDITOR || 'nano';
    const child = spawn(editor, ['plan.md'], { stdio: 'inherit' });
    await new Promise((resolve) => child.on('close', resolve));

    // 4. Reload and validate
    const newPlan = context.planManager.reload();
    const validation = context.planManager.validate(newPlan);
    if (!validation.valid) {
      throw new Error(`Invalid plan: ${validation.errors.join(', ')}`);
    }

    // 5. Compute and display diff
    const diff = context.planManager.diff(oldPlan, newPlan);
    context.callbacks.onPlanUpdated(newPlan, diff);

    // 6. Resume agent
    context.callbacks.onStateChange({ type: 'idle' });
  } else {
    // Regular message processing
    await context.orchestrator.processMessage(input, context);
  }
}
```

**Benefits:**
- ✅ Simplified mode system (2×2 orthogonal states vs v1's 6 states) - clearer mental model
- ✅ Natural chat interface everyone understands
- ✅ Scroll up to see history (standard terminal UX)
- ✅ Raw markdown is clean and readable
- ✅ `/editPlan` gives power users direct file access
- ✅ Fixed input box is familiar (like bash, zsh, fish)

---

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

**Why This Separation Matters:**

**Multi-Provider Support:** We WILL support multiple local LLM providers (Ollama, Llama.cpp, LocalAI). Clean data layer separation means:
- Define abstract `LLMClient` interface in domain layer
- Implement concrete adapters (OllamaClient, LlamaCppClient, LocalAIClient) in data layer
- Swap providers via configuration without touching orchestrator or UI
- Example: User can run `--provider llama.cpp` to switch from Ollama to Llama.cpp without code changes

**Future-Proofing:** As new local LLM runtimes emerge, we can add adapters without refactoring business logic.

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

**📖 For detailed LLM prompt engineering specifications, see [PROMPTS.md](./PROMPTS.md)**

This section covers the core modules in each layer. For complete details on:
- Tool calling format (Claude Code style)
- OllamaClient.call() interface and context assembly
- Plan document structure with acceptance criteria and decisions
- models.json format and model selection
- AGENTS.md conventions
- Message history formatting
- Response examples and tool schema generation

Refer to the dedicated PROMPTS.md document.

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
  acceptanceCriteria?: AcceptanceCriterion[];
  decisionsMade?: Decision[];
  decisionsRejected?: Decision[];
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
      status: 'planning',
      goal,
      acceptanceCriteria: [],
      decisionsMade: [],
      decisionsRejected: [],
      executionLog: [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
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

    if (!plan.acceptanceCriteria || plan.acceptanceCriteria.length === 0) {
      errors.push({ field: 'acceptanceCriteria', message: 'At least one acceptance criterion is required' });
    }

    if (plan.acceptanceCriteria.some(ac => !ac.description || ac.description.trim().length === 0)) {
      errors.push({ field: 'acceptanceCriteria', message: 'All acceptance criteria must have descriptions' });
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
  yargs \
  vectra \
  better-sqlite3

npm install -D \
  @types/react \
  @types/yargs
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

**Note on CLI Parsing:** This project uses **Yargs** for command-line argument parsing. Yargs is preferred over Commander.js for:
- **Excellent TypeScript support:** Strong type inference for options and arguments
- **Rich validation:** Built-in validators (`.choices()`, `.number()`, `.string()`, custom validators)
- **Auto-generated help:** Professional-looking, customizable help text
- **Powerful features:** Middleware, command aliases, positional arguments with validation
- **Type-safe commands:** Full TypeScript support for command handlers with inferred argument types

**Example Yargs Command:**
```typescript
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

interface PlanArgs {
  goal: string;
  model?: string;
  autonomous: boolean;
}

const cli = yargs(hideBin(process.argv))
  .command<PlanArgs>(
    'plan <goal>',
    'Create a new plan',
    (yargs) => {
      return yargs
        .positional('goal', {
          type: 'string',
          describe: 'Goal to accomplish',
          demandOption: true,
        })
        .option('model', {
          type: 'string',
          describe: 'LLM model to use',
          default: 'qwen2.5-coder:7b',
          choices: ['qwen2.5-coder:7b', 'qwen2.5-coder:32b', 'llama3.1:8b'],
        })
        .option('autonomous', {
          type: 'boolean',
          describe: 'Run in autonomous mode',
          default: false,
        });
    },
    (argv) => {
      // argv is fully typed as PlanArgs!
      console.log(`Planning: ${argv.goal}`);
      console.log(`Model: ${argv.model}`);
      console.log(`Autonomous: ${argv.autonomous}`);
    }
  )
  .strict()
  .demandCommand(1, 'You need at least one command')
  .help()
  .parse();
```

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

interface Plan {
  planId: PlanId;
  sessionId: SessionId;
  status: PlanStatus;
  goal: string;
  acceptanceCriteria: AcceptanceCriterion[];
  decisionsMade: Decision[];
  decisionsRejected: Decision[];
  executionLog: LogEntry[];
  metadata: PlanMetadata;
}

type PlanStatus = 'planning' | 'in_progress' | 'blocked' | 'completed' | 'failed';

interface AcceptanceCriterion {
  description: string;
  completed: boolean;
  notes?: string;
}

interface Decision {
  title: string;
  rationale: string;
  alternatives?: string[];
  timestamp: number;
}

interface LogEntry {
  timestamp: number;
  action: string;
  result: string;
  toolsUsed: string[];
}

interface PlanMetadata {
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

**Note:** This structure is designed to provide rich context to the LLM:
- **Acceptance Criteria** - Clear definition of "done"
- **Decisions Made** - Documents why we chose specific approaches
- **Decisions Rejected** - Prevents backtracking to failed approaches
- **Execution Log** - Summarized history of key actions and results

For detailed serialization format and usage, see [PROMPTS.md](./PROMPTS.md).

**Agent State:**
```typescript
/**
 * AgentState represents the agent execution loop state.
 *
 * Note: This is separate from Session Mode (Plan/Execute) documented in Section 3.2.
 * These states describe what the agent is currently doing within Execute Mode.
 */
type AgentState =
  | { type: 'idle' }
  | { type: 'planning'; currentGoal: string }        // Planning within Execute Mode
  | { type: 'executing_tool'; tool: string; args: Record<string, unknown> }
  | { type: 'tool_completed'; result: ToolResult }
  | { type: 'waiting_approval'; operation: PendingOperation }  // Confirm mode
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

**Q1: Should we support multiple LLM providers?**
- **Decision:** ✅ **YES - Multiple LOCAL providers only**
- **Local-only requirement:** MUST work offline (after models pulled) - NO cloud APIs ever
- **Planned support:**
  - Phase 1: Ollama only (MVP)
  - Future: Llama.cpp, LocalAI, and other local providers
  - NEVER: OpenAI, Anthropic, or any cloud APIs
- **Architecture impact:** This is a KEY reason for clean data layer separation
  - Abstract `LLMClient` interface in domain layer
  - Concrete implementations (OllamaClient, LlamaCppClient, LocalAIClient) in data layer
  - Swap providers without touching orchestrator or UI code
- **Implementation:** Start with Ollama, add adapter pattern when second provider is needed

**Q2: How to handle streaming in the orchestrator loop?**
- **Decision:** Implement **Hybrid Streaming** in Phase 4
- **Rationale:** Stream thinking/reasoning for UX, buffer tool calls for structured execution
- **Why:** Tool execution (file I/O, shell) dominates latency, not token generation. Streaming is primarily UX improvement.

**Hybrid Streaming Pattern:**
```
1. Stream "thinking" content → Display immediately in TUI
2. Buffer "tool_calls" JSON → Parse when complete
3. Execute tools → After full response received
```

**Technical Approach:**
- Ollama streams JSON Lines (NDJSON format, one object per line)
- Parse each line as it arrives:
  - `{"thinking": "text"}` → Stream to ChatView (execute mode)
  - `{"tool_calls": [...]}` → Accumulate in buffer
  - `{"done": true}` → Parse buffered tool calls, execute
- Ink/React updates UI incrementally as thinking streams in

**Example Stream:**
```json
{"thinking": "I need to check the file structure first..."}
{"thinking": "Let me read the package.json to understand dependencies..."}
{"tool_calls": [{"name": "read_file", "args": {"path": "package.json"}}]}
{"done": true}
```

**Benefits:**
- ✅ Immediate feedback (user sees agent "thinking")
- ✅ Structured tool execution (no partial JSON execution)
- ✅ Works with all local LLM providers (NDJSON is standard)
- ✅ Minimal orchestrator changes (still executes complete tool calls)

**Implementation:** Start with batch (Phase 1-3), add streaming in Phase 4 after core loop is stable

**Type Definitions for Streaming:**
```typescript
type ChatChunk =
  | { type: 'thinking'; content: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
  | { type: 'done'; done: true };

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}
```

**Data Layer:** `OllamaClient.chatStream()` already implements NDJSON parsing (see section 7.3)
**Domain Layer:** `AgentOrchestrator` accumulates chunks, executes tools when `done: true` received
**Display Layer:** `App.tsx` subscribes to thinking chunks, updates ChatView in real-time (when in execute mode)

**Q3: Should tools be async iterators (for progress updates)?**
- **Decision:** ✅ **YES - Hybrid approach for long-running tools**
- **Rationale:** Long-running tools (shell_exec, file_search) need progress feedback; fast tools (read_file) don't
- **What this is:** Tool OUTPUT streaming (not LLM streaming - that's Q2)

**The Problem:**
```typescript
// Current: Batch tools - no feedback until complete
const result = await shellExec({ command: "npm test" });
// User sees NOTHING for 30 seconds while tests run
// Then sees entire output at once
// Feels frozen/broken during execution
```

**Proposed: Streaming Tools:**
```typescript
// Long-running tools yield progress updates
for await (const chunk of shellExec({ command: "npm test" })) {
  // chunk = { type: 'stdout', data: 'Running tests...\n' }
  // chunk = { type: 'stdout', data: '✓ test 1 passed\n' }
  // chunk = { type: 'stdout', data: '✓ test 2 passed\n' }
  // chunk = { type: 'exit', code: 0 }
}
// User sees real-time output, knows it's working
```

**Hybrid Approach - Categorize by Latency:**

**Stream These (>2s typical latency):**
- `shell_exec` - Commands run for seconds/minutes, need stdout/stderr streaming
- `file_search` - Searching thousands of files, yield matches as found
- `git_clone` - Network operations with progress indicators

**Don't Stream These (<100ms typical latency):**
- `read_file` - Instant for normal files
- `write_file` - Instant write + sync
- `list_directory` - Fast enough for batch

**Type Definitions:**
```typescript
// Tools can return either sync results OR streaming progress
type ToolExecutor<T> =
  | (() => Promise<T>)                          // Fast tools
  | (() => AsyncIterator<ToolProgress<T>>);     // Slow tools

type ToolProgress<T> =
  | { type: 'progress'; data: string }          // Partial output
  | { type: 'result'; data: T; done: true };    // Final result

// Example: shell_exec streams stdout
type ShellProgress =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'exit'; code: number; done: true };
```

**Benefits:**
- ✅ Users see long-running tools making progress
- ✅ Can cancel tools that are going in wrong direction
- ✅ Better UX for autonomous mode (not stuck waiting)
- ✅ Simple tools stay simple (no streaming overhead)

**Implementation Complexity:**
- Domain: `AgentOrchestrator` handles both sync and async tool results
- Display: `App.tsx` shows streaming output in real-time
- Data: Only implement streaming for slow tools (`shell_exec`, `file_search`)

**Timeline:** Phase 3 (after basic tool calling works in Phase 2)

**Q4: How to handle plan editing and conflicts?**
- **Decision:** ✅ **Two modes: Agent-managed editing vs External editing**

**Note:** For the overall session mode system (Plan Mode vs Execute Mode), see Section 3.2. This question specifically addresses file editing within Execute Mode.

**1. Agent-Managed Editing (`/editPlan` command):**
- ✅ **FULLY SUPPORTED** - User types `/editPlan` in TUI
- Agent pauses execution (state: 'waiting_user_edit')
- Agent opens editor ($EDITOR or nano) and waits for completion
- Agent reviews changes, validates plan structure
- Agent computes and displays diff
- Agent resumes with updated plan

**Why this works:**
```
┌─────────────────────────────────────────────┐
│ Mutual Exclusion via Agent State Machine   │
├─────────────────────────────────────────────┤
│ • Only one writer at a time (agent OR user) │
│ • Agent controls timing via state           │
│ • No concurrent writes → no conflicts       │
│ • Simple implementation, clear ownership    │
└─────────────────────────────────────────────┘
```

**Implementation:**
```typescript
// Agent-managed editing - fully supported
async handleEditPlan(context: ExecutionContext): Promise<void> {
  // 1. Snapshot for diff
  const oldPlan = deepClone(context.planManager.getCurrentPlan());

  // 2. Pause agent (mutual exclusion)
  context.callbacks.onStateChange({ type: 'waiting_user_edit', snapshot: oldPlan });

  // 3. Open editor (blocking)
  const editor = process.env.EDITOR || 'nano';
  const child = spawn(editor, ['plan.md'], { stdio: 'inherit' });
  await new Promise((resolve) => child.on('close', resolve));

  // 4. Reload and validate
  const newPlan = context.planManager.reload();
  const validation = context.planManager.validate(newPlan);
  if (!validation.valid) throw new Error('Invalid plan');

  // 5. Review changes
  const diff = context.planManager.diff(oldPlan, newPlan);
  context.callbacks.onPlanUpdated(newPlan, diff);

  // 6. Resume agent
  context.callbacks.onStateChange({ type: 'idle' });
}
```

**2. External Editing (outside agent):**
- ❌ **UNSUPPORTED** - User edits plan.md in another terminal/editor while agent runs
- Agent ignores external changes
- Agent overwrites on next save
- **Agent wins** - plan.md is agent-managed output

**Why external edits are unsupported:**
```
plan.md is OUTPUT, not INPUT (when agent is running)
- Generated/managed by agent
- Users can VIEW it (it's markdown)
- Users CANNOT reliably edit it externally while agent runs
- External changes will be overwritten
```

**Last write wins - no conflict detection:**
```typescript
// Simple save - no locking, no file watching needed
async savePlan(plan: Plan): Promise<void> {
  await fs.writeFile('plan.md', serialize(plan));
  // Agent owns this file during execution
}
```

**Benefits:**
- ✅ Simple implementation (no file locking, no watching)
- ✅ No conflict resolution UI needed
- ✅ Clear ownership: Agent manages plan.md
- ✅ Users can still view plan.md for reference
- ✅ `/editPlan` provides controlled editing when needed

**Documentation:**
```markdown
# plan.md Editing

⚠️ **TWO WAYS TO EDIT:**

✅ **SUPPORTED: Via `/editPlan` command**
Type `/editPlan` in the agent TUI:
- Agent pauses and opens your editor
- You edit, save, exit
- Agent reviews changes and continues

❌ **UNSUPPORTED: External editing**
While agent is running, do NOT edit plan.md externally:
- Changes will be lost (agent overwrites)
- Use `/editPlan` command instead

✅ You can:
- View plan.md in any editor (read-only)
- Copy content for reference
- Version control it with git
- Edit freely when agent is not running

❌ Do not (while agent running):
- Edit plan.md in another terminal
- Open multiple agent sessions on same plan
- Sync plan.md across machines
```

**Edge Case: Multiple Sessions**
If user runs two agent sessions in same directory:
- Both will write to plan.md → last write wins
- This is **unsupported use case**
- Document: "One agent session per plan.md"

**Future: Multi-Agent (Only if needed)**
If we ever support true multi-agent collaboration:
- Then consider OT/CRDTs for conflict resolution
- Requires distributed consensus, much complexity
- Not needed for MVP or single-agent use

**Decision:** Two-mode approach - agent-managed editing via `/editPlan` (supported), external editing (unsupported, agent wins).

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
- Run agent on cloud VM with LOCAL Ollama instance (NOT cloud LLM APIs)
- Requires: Multi-tenancy, authentication, resource limits
- Note: Still 100% local processing, just hosted on cloud infrastructure
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

**Documentation:**
- Architecture overview: This document (ARCHITECTURE.md)
- LLM prompt engineering: [PROMPTS.md](./PROMPTS.md)
- Development guidelines: [CLAUDE.md](./CLAUDE.md)

**Existing Codebase:**
- v1 source: `./simple-agent/`

**Technologies:**
- [TypeScript](https://www.typescriptlang.org/)
- [Axios](https://axios-http.com/) - HTTP client
- [Yargs](https://yargs.js.org/) - CLI argument parser
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
