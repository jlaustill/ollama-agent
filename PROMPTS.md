# PROMPTS.md - LLM Prompt Engineering Specification

**Status:** Design Complete
**Last Updated:** 2026-01-07
**Related:** ARCHITECTURE.md, CLAUDE.md

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tool Calling Format](#2-tool-calling-format)
3. [OllamaClient Interface](#3-ollamaclient-interface)
4. [Plan Document Structure](#4-plan-document-structure)
   - 4.1 TypeScript Interface
   - 4.2 Markdown Serialization Format
   - 4.3 Serialization/Deserialization Implementation
5. [models.json Format](#5-modelsjson-format)
6. [AGENTS.md Convention](#6-agentsmd-convention)
7. [Message History Format](#7-message-history-format)
8. [Response Examples](#8-response-examples)
9. [Tool Schema Generation](#9-tool-schema-generation)
10. [Implementation Examples](#10-implementation-examples)
11. [Testing Guidelines](#11-testing-guidelines)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Overview

### 1.1 Design Philosophy

This system uses **Claude Code's tool calling format** as the standard for LLM interactions. This provides:

- **Proven reliability** - Tested across millions of interactions
- **Clear structure** - Unambiguous JSON parsing
- **Easy debugging** - Human-readable format
- **Future-proof** - Extensible for new tool types

### 1.2 Context Assembly Strategy

The `OllamaClient.call()` method assembles context from multiple sources:

```
┌─────────────────────────────────────────────────────────┐
│                   Context Assembly                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. AGENTS.md        → Agent behavior (permanent)       │
│  2. models.json      → Model-specific tuning            │
│  3. responseFormat   → Tool calling spec                │
│  4. responseExamples → Few-shot learning                │
│  5. planDoc          → Current task context             │
│  6. messageHistory   → Conversational context (last 5)  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key principle:** Separate concerns for maintainability:
- Permanent behavior → Version-controlled files (AGENTS.md)
- Model tuning → Configuration (models.json)
- Dynamic context → Runtime assembly (planDoc, messageHistory)

---

## 2. Tool Calling Format

### 2.1 Response Structure

The LLM **MUST** respond with one of these JSON formats:

#### **Tool Calls (Action Needed)**

```json
{
  "tool_calls": [
    {
      "name": "read_file",
      "parameters": {
        "file_path": "/path/to/file.ts"
      }
    }
  ]
}
```

#### **Multiple Tool Calls (Parallel Execution)**

```json
{
  "tool_calls": [
    {
      "name": "read_file",
      "parameters": {"file_path": "package.json"}
    },
    {
      "name": "read_file",
      "parameters": {"file_path": "README.md"}
    }
  ]
}
```

#### **Final Response (No Tools Needed)**

```json
{
  "response": "I've completed the task. The bug was in the authentication middleware where tokens weren't being validated correctly."
}
```

### 2.2 Format Rules

**CRITICAL:**
- `tool_calls` is an **array** (enables batching)
- Use `parameters` not `args` (matches Claude Code)
- Use `response` for final answers
- **NEVER** mix `tool_calls` and `response` in same JSON

**Valid:**
```json
{"tool_calls": [...]}
{"response": "..."}
```

**INVALID:**
```json
{"tool_calls": [...], "response": "..."}  // ❌ Mixed format
{"action": "read_file", "args": {...}}    // ❌ Wrong structure
```

### 2.3 Response Format Specification String

```markdown
You MUST respond with valid JSON in one of these formats:

## Tool Calls
When you need to perform actions, use the tool_calls format:

{
  "tool_calls": [
    {
      "name": "tool_name",
      "parameters": {
        "param1": "value1",
        "param2": "value2"
      }
    }
  ]
}

**Rules:**
- tool_calls is an ARRAY (can contain multiple tools)
- Each tool call has "name" (string) and "parameters" (object)
- Parameter names MUST match tool definitions exactly
- You can call multiple independent tools in parallel

## Final Response
When you're done and want to respond to the user:

{
  "response": "Your message to the user here"
}

**Rules:**
- Use "response" field for final answers
- NEVER mix tool_calls and response in same JSON
- Be concise and specific
```

---

## 3. OllamaClient Interface

### 3.1 Method Signature

```typescript
// src/data/models/OllamaClient.ts

interface CallParams {
  modelPrompt: string;        // From models.json - model-specific instructions
  agentMd: string;            // From ~/AGENTS.md - system behavior
  planDoc: string;            // Current plan with status, criteria, decisions
  responseFormat: string;     // Tool calling format spec
  messageHistory: Message[];  // Last 5 user messages + agent actions
  responseExamples: string[]; // Few-shot examples
  model?: string;             // Override default model
  options?: ChatOptions;      // Temperature, etc.
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

interface ChatOptions {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
}
```

### 3.2 Implementation

```typescript
class OllamaClient {
  constructor(
    private baseUrl: string = 'http://localhost:11434',
    private timeout: number = 300000
  ) {}

  /**
   * Call Ollama with structured context assembly
   * Formats all inputs optimally for the model
   */
  async call(params: CallParams): Promise<ChatResponse> {
    // Assemble messages in optimal order for Ollama
    const messages = this.assembleMessages(params);

    // Call Ollama with JSON format enforcement
    return this.chat({
      model: params.model || 'qwen2.5-coder:7b',
      messages,
      format: 'json', // Force JSON response
      options: params.options || { temperature: 0.2 } // Low temp for reliable JSON
    });
  }

  /**
   * Assemble context into Ollama message format
   * Order matters for model performance!
   */
  private assembleMessages(params: CallParams): OllamaMessage[] {
    const messages: OllamaMessage[] = [];

    // 1. SYSTEM MESSAGE: Agent behavior + response format
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(
        params.agentMd,
        params.responseFormat,
        params.responseExamples
      )
    });

    // 2. MODEL-SPECIFIC INSTRUCTIONS
    if (params.modelPrompt) {
      messages.push({
        role: 'system',
        content: params.modelPrompt
      });
    }

    // 3. PLAN CONTEXT (always fresh)
    messages.push({
      role: 'system',
      content: `# Current Plan\n\n${params.planDoc}`
    });

    // 4. MESSAGE HISTORY (last 5 interactions)
    messages.push(...params.messageHistory);

    return messages;
  }

  private buildSystemPrompt(
    agentMd: string,
    responseFormat: string,
    examples: string[]
  ): string {
    return `${agentMd}

# Response Format

${responseFormat}

# Examples

${examples.join('\n\n')}`;
  }

  // ... existing chat(), chatStream(), etc.
}
```

### 3.3 Design Rationale

**Why this interface?**

1. **Separation of concerns:**
   - `agentMd` = permanent behavior
   - `modelPrompt` = model-specific tuning
   - `planDoc` = dynamic task context
   - `messageHistory` = conversational context

2. **Data layer handles formatting:**
   - Domain layer provides raw inputs
   - Data layer assembles optimally for Ollama
   - Easy to swap providers (Llama.cpp, LocalAI) later

3. **Type safety:**
   - `CallParams` interface enforces all required context
   - `Message` interface ensures proper history format
   - No implicit dependencies

### 3.4 Three-Stage Workflow (Planning → Execution → Summarization)

**Core Principle:** Context is ALWAYS bounded to `plan_doc.md + last 5 messages + current ask`. The plan_doc.md IS the memory - it's a living, summarized document that grows through structured workflow, not by dumping full conversation history.

#### 3.4.1 Overview

Every user request follows this 3-stage cycle:

```
┌─────────────────────────────────────────────────┐
│  STAGE 1: PLANNING                              │
│  ┌──────────────────────────────────────────┐   │
│  │ Input:  plan_doc.md + user ask           │   │
│  │ Model:  Planning model                   │   │
│  │ Output: Task list (step 1, 2, 3, ...)   │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│  STAGE 2: EXECUTION                             │
│  ┌──────────────────────────────────────────┐   │
│  │ Input:  plan_doc.md + last 5 messages   │   │
│  │         + current task                   │   │
│  │ Model:  Execution model                  │   │
│  │ Loop:   Work through task list           │   │
│  │ Prompt: User for feedback as needed      │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│  STAGE 3: SUMMARIZATION                         │
│  ┌──────────────────────────────────────────┐   │
│  │ Input:  What we just did (full context) │   │
│  │ Model:  Summarize model                  │   │
│  │ Output: Log entry for plan_doc.md        │   │
│  │ Show:   To user for approval/correction  │   │
│  │ Save:   Update plan_doc.md with entry    │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**Key Design:**
- No truncation needed - context is naturally bounded
- Summarization is **proactive** (normal workflow), not reactive (emergency)
- User participates in memory formation ("we also did X!")
- plan_doc.md becomes authoritative memory going forward

---

#### 3.4.2 Stage 1: Planning

**Purpose:** Break down user request into concrete, executable steps

**Input Context:**
```typescript
{
  modelPrompt: models['qwen2.5-coder:32b'].prompt,  // Use larger planning model
  agentMd: await fs.readFile('~/AGENTS.md', 'utf-8'),
  planDoc: currentPlanDoc,
  responseFormat: TASK_LIST_FORMAT,
  messageHistory: [],  // Planning doesn't need history
  responseExamples: PLANNING_EXAMPLES
}
```

**Response Format:**
```json
{
  "task_list": [
    {
      "step": 1,
      "description": "Read README.md to understand current state",
      "tool": "read_file",
      "params": {"file_path": "README.md"}
    },
    {
      "step": 2,
      "description": "Compare current README against work done in last 5 messages and plan_doc.md",
      "tool": "analyze",
      "params": {}
    },
    {
      "step": 3,
      "description": "Identify missing sections that need to be added",
      "tool": "analyze",
      "params": {}
    },
    {
      "step": 4,
      "description": "Write updated README.md with all recent changes documented",
      "tool": "write_file",
      "params": {"file_path": "README.md"}
    },
    {
      "step": 5,
      "description": "Show diff to user for approval",
      "tool": "show_diff",
      "params": {}
    }
  ]
}
```

**Example Planning Prompt:**
```markdown
You are a planning model. Break down the user's request into concrete, executable steps.

User request: "Please update the README.md with the changes we have made"

Current plan_doc.md:
[Full plan_doc.md content here]

Create a task list that:
1. Identifies what information is needed (read files, check status, etc.)
2. Specifies analysis steps (compare, identify gaps, etc.)
3. Defines output actions (write files, show diffs, etc.)
4. Includes user interaction points (approval, feedback, etc.)

Return as JSON with this format:
{
  "task_list": [
    {"step": 1, "description": "...", "tool": "...", "params": {...}},
    ...
  ]
}
```

**Implementation:**
```typescript
// src/domain/agent/PlanningStage.ts

class PlanningStage {
  constructor(
    private ollama: OllamaClient,
    private planManager: PlanManager
  ) {}

  async generateTaskList(userRequest: string): Promise<Task[]> {
    const planDoc = await this.planManager.loadPlan();

    const response = await this.ollama.call({
      modelPrompt: 'You are a planning model. Break requests into executable steps.',
      agentMd: await fs.readFile(expandTilde('~/AGENTS.md'), 'utf-8'),
      planDoc: this.planManager.serializeToMarkdown(),
      responseFormat: TASK_LIST_FORMAT,
      messageHistory: [],
      responseExamples: PLANNING_EXAMPLES,
      model: 'qwen2.5-coder:32b', // Use larger model for planning
      options: { temperature: 0.3 }
    });

    const parsed = JSON.parse(response.message.content);
    return parsed.task_list;
  }
}
```

---

#### 3.4.3 Stage 2: Execution

**Purpose:** Execute task list, calling tools and interacting with user

**Input Context (for each task):**
```typescript
{
  modelPrompt: models['qwen2.5-coder:7b'].prompt,  // Use fast execution model
  agentMd: await fs.readFile('~/AGENTS.md', 'utf-8'),
  planDoc: currentPlanDoc,
  responseFormat: TOOL_CALLING_FORMAT,
  messageHistory: last5Messages,  // NOW we include conversation context
  responseExamples: EXECUTION_EXAMPLES
}
```

**Execution Loop:**
```typescript
// src/domain/agent/ExecutionStage.ts

class ExecutionStage {
  constructor(
    private ollama: OllamaClient,
    private toolRegistry: ToolRegistry,
    private messageHistory: MessageHistoryManager,
    private planManager: PlanManager
  ) {}

  async executeTaskList(
    tasks: Task[],
    callbacks: ProgressCallbacks
  ): Promise<ExecutionResult> {
    const results: TaskResult[] = [];

    for (const task of tasks) {
      callbacks.onTaskStart?.(task);

      // Execute this specific task with bounded context
      const result = await this.executeTask(task);

      results.push(result);

      // Stop if task failed critically
      if (result.status === 'failed' && result.critical) {
        break;
      }

      // Check if user wants to stop
      if (result.userRequested === 'stop') {
        break;
      }

      callbacks.onTaskComplete?.(task, result);
    }

    return {
      tasks,
      results,
      completed: results.every(r => r.status === 'success')
    };
  }

  private async executeTask(task: Task): Promise<TaskResult> {
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      iterations++;

      // Build context with last 5 messages + current task
      const response = await this.ollama.call({
        modelPrompt: 'Execute the current task step.',
        agentMd: await fs.readFile(expandTilde('~/AGENTS.md'), 'utf-8'),
        planDoc: this.planManager.serializeToMarkdown(),
        responseFormat: TOOL_CALLING_FORMAT,
        messageHistory: this.messageHistory.getHistory(), // Last 5 messages
        responseExamples: EXECUTION_EXAMPLES,
        model: 'qwen2.5-coder:7b',
        options: { temperature: 0.2 }
      });

      // Add task context to message
      const taskContext = `Current task: ${task.description}`;
      this.messageHistory.addUserMessage(taskContext);
      this.messageHistory.addAssistantMessage(response.message.content);

      const parsed = this.parseResponse(response.message.content);

      if (parsed.type === 'tool_calls') {
        // Execute tools
        const toolResults = await this.toolRegistry.executeBatch(parsed.calls);

        // Add results to history
        const resultsText = this.formatToolResults(toolResults);
        this.messageHistory.addUserMessage(`Tool results:\n${resultsText}`);

        // Continue loop
        continue;
      }

      if (parsed.type === 'response') {
        // Task complete
        return {
          status: 'success',
          output: parsed.response,
          iterations
        };
      }

      // Check if user approval needed
      if (parsed.type === 'request_approval') {
        const approved = await this.requestUserApproval(parsed.question);
        if (!approved) {
          return {
            status: 'failed',
            error: 'User rejected',
            userRequested: 'stop'
          };
        }
        continue;
      }
    }

    return {
      status: 'failed',
      error: 'Max iterations reached',
      iterations: maxIterations
    };
  }
}
```

**Key Points:**
- Each task execution uses: `plan_doc.md + last 5 messages + current task`
- Context naturally bounded - no truncation needed
- User can provide feedback during execution
- Execution continues until task list complete or user stops

---

#### 3.4.4 Stage 3: Summarization

**Purpose:** Compact what was just done into a log entry for plan_doc.md

**Input Context:**
```typescript
{
  modelPrompt: 'You are a summarizer. Create concise log entries.',
  agentMd: await fs.readFile('~/AGENTS.md', 'utf-8'),
  planDoc: currentPlanDoc,
  responseFormat: LOG_ENTRY_FORMAT,
  messageHistory: executionMessages,  // ALL messages from execution stage
  responseExamples: SUMMARIZATION_EXAMPLES
}
```

**Response Format:**
```json
{
  "log_entry": {
    "action": "Updated README.md with recent changes",
    "details": "Added documentation for new authentication flow, JWT token handling, and password reset feature. Removed outdated deployment instructions.",
    "result": "✓ README.md now reflects all work completed in this session",
    "tools_used": ["read_file", "write_file", "show_diff"]
  },
  "acceptance_criteria_updates": [
    {
      "description": "Document authentication flow",
      "completed": true
    }
  ],
  "decisions_made": []
}
```

**User Approval Flow:**
```typescript
// src/domain/agent/SummarizationStage.ts

class SummarizationStage {
  constructor(
    private ollama: OllamaClient,
    private planManager: PlanManager,
    private chatLogger: ChatLogger
  ) {}

  async summarizeWorkAndUpdatePlan(
    executionResult: ExecutionResult
  ): Promise<void> {
    // Generate summary from execution
    const summary = await this.generateSummary(executionResult);

    // Show to user for approval/correction
    const approved = await this.showSummaryToUser(summary);

    if (!approved.accepted) {
      // User provided corrections
      summary.log_entry.details = approved.correctedDetails;
      summary.log_entry.action = approved.correctedAction;
    }

    // Update plan_doc.md with new log entry
    await this.planManager.addLogEntry({
      timestamp: Date.now(),
      action: summary.log_entry.action,
      result: summary.log_entry.result,
      toolsUsed: summary.log_entry.tools_used
    });

    // Update acceptance criteria if any were completed
    for (const update of summary.acceptance_criteria_updates) {
      await this.planManager.updateAcceptanceCriterion(update);
    }

    // Add any new decisions made
    for (const decision of summary.decisions_made) {
      await this.planManager.addDecision(decision);
    }

    // Save updated plan
    await this.planManager.savePlan();

    // Log the updated plan to chat_history.log
    const updatedPlan = this.planManager.serializeToMarkdown();
    await this.chatLogger.logPlanShown(updatedPlan);
  }

  private async generateSummary(
    executionResult: ExecutionResult
  ): Promise<Summary> {
    const response = await this.ollama.call({
      modelPrompt: 'You are a summarizer. Create concise log entries for what was just done.',
      agentMd: await fs.readFile(expandTilde('~/AGENTS.md'), 'utf-8'),
      planDoc: this.planManager.serializeToMarkdown(),
      responseFormat: LOG_ENTRY_FORMAT,
      messageHistory: executionResult.allMessages,
      responseExamples: SUMMARIZATION_EXAMPLES,
      model: 'qwen2.5-coder:7b',
      options: { temperature: 0.1 }
    });

    return JSON.parse(response.message.content);
  }

  private async showSummaryToUser(summary: Summary): Promise<UserApproval> {
    // Display summary to user in TUI
    console.log('\n=== Work Summary ===');
    console.log(`Action: ${summary.log_entry.action}`);
    console.log(`Details: ${summary.log_entry.details}`);
    console.log(`Result: ${summary.log_entry.result}`);
    console.log(`Tools: ${summary.log_entry.tools_used.join(', ')}`);

    if (summary.acceptance_criteria_updates.length > 0) {
      console.log('\nAcceptance Criteria Completed:');
      summary.acceptance_criteria_updates.forEach(u => {
        console.log(`  ✓ ${u.description}`);
      });
    }

    // Prompt user
    const response = await prompt(
      'Does this summary look correct? (yes/no/edit): '
    );

    if (response === 'yes') {
      return { accepted: true };
    }

    if (response === 'edit') {
      const correctedAction = await prompt('Action: ');
      const correctedDetails = await prompt('Details: ');

      return {
        accepted: false,
        correctedAction,
        correctedDetails
      };
    }

    return { accepted: true }; // Default accept on 'no' or unclear
  }
}
```

**Critical Feature: User Participation**

The user gets to correct/enhance the summary BEFORE it's saved:

```
=== Work Summary ===
Action: Updated README.md with recent changes
Details: Added documentation for authentication flow and JWT tokens
Result: ✓ README.md now reflects completed work
Tools: read_file, write_file

Does this summary look correct? (yes/no/edit): edit
Action: Updated README.md with authentication and deployment docs
Details: Added auth flow docs, JWT guide, AND fixed deployment section with new Kubernetes config
```

This ensures the plan_doc.md memory is accurate and complete.

---

#### 3.4.5 Complete Workflow Example

**User Request:** "Please update the README.md with the changes we have made"

**Stage 1 - Planning:**
```
→ Call planning model
← Returns task list:
  1. Read README.md
  2. Compare against plan_doc.md and last 5 messages
  3. Identify missing documentation
  4. Write updated README.md
  5. Show diff for approval
```

**Stage 2 - Execution:**
```
→ Execute step 1: read_file("README.md")
← Tool result: [current README content]

→ Execute step 2: analyze (LLM compares)
← Response: "Found 3 undocumented features"

→ Execute step 3: analyze
← Response: "Need to add: auth flow, JWT guide, password reset"

→ Execute step 4: write_file("README.md")
← Tool result: ✓ File written

→ Execute step 5: show_diff
← User approves diff
```

**Stage 3 - Summarization:**
```
→ Call summarize model with ALL execution messages
← Returns:
  {
    "log_entry": {
      "action": "Updated README.md documentation",
      "details": "Added auth flow, JWT guide, password reset docs",
      "result": "✓ Complete",
      "tools_used": ["read_file", "write_file"]
    }
  }

→ Show summary to user
User: "yes"

→ Update plan_doc.md with new log entry
→ Save plan_doc.md
→ Log updated plan to chat_history.log
```

**Result:** plan_doc.md now contains this new log entry, providing context for future requests.

---

#### 3.4.6 Why This Design Works

**1. Context Always Bounded:**
- Planning: `plan_doc.md + user ask` (~5K tokens)
- Execution: `plan_doc.md + last 5 messages + task` (~8K tokens)
- Summarization: `plan_doc.md + execution messages` (~10K tokens)

**2. No Context Window Explosion:**
- Full conversation history NOT sent
- plan_doc.md IS the memory (already summarized)
- Execution messages immediately summarized after task

**3. User Participates in Memory:**
- Sees summary before it's saved
- Can correct: "we also did X!"
- Ensures accurate memory going forward

**4. Natural Workflow:**
- Feels like working with human assistant
- User sees progress through plan_doc.md log
- Clear checkpoints (planning, execution, summarization)

---

## 4. Plan Document Structure

### 4.1 TypeScript Interface

```typescript
interface Plan {
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

### 4.2 Markdown Serialization Format

```markdown
# Plan: [Goal]

**Status:** in_progress

## Goal
Create a REST API for user authentication with JWT tokens

## Acceptance Criteria
- [x] Express server configured with TypeScript
- [x] User model with password hashing (bcrypt)
- [ ] POST /register endpoint with validation
- [ ] POST /login endpoint returning JWT
- [ ] Middleware for JWT verification

## Decisions Made

### Use bcrypt for password hashing
**Rationale:** Industry standard, proven security, good performance
**Alternatives considered:** argon2 (more secure but slower), scrypt
**Decided:** 2024-01-07 14:23

### JWT tokens with 24h expiry
**Rationale:** Balance between security (short-lived) and UX (not too annoying)
**Alternatives considered:** 1h (too short), 7d (too long)
**Decided:** 2024-01-07 14:30

## Decisions Rejected

### Store sessions in database
**Rationale:** JWT is stateless - defeats purpose to add database lookups
**Alternative:** Use JWTs properly with refresh tokens
**Rejected:** 2024-01-07 14:25

## Execution Log

### 2024-01-07 14:20 - Setup Express server
**Actions:** Created src/index.ts, configured TypeScript, installed dependencies
**Tools:** write_file, shell_exec (npm install)
**Result:** ✓ Server running on port 3000

### 2024-01-07 14:25 - Created User model
**Actions:** Defined User schema with email/password, added bcrypt hashing
**Tools:** write_file (src/models/User.ts)
**Result:** ✓ Model validates emails and hashes passwords

### 2024-01-07 14:35 - Started /register endpoint
**Actions:** Created auth routes, added validation middleware
**Tools:** write_file (src/routes/auth.ts), read_file (User.ts)
**Result:** 🚧 In progress - validation working, need to connect to database
```

### 4.3 Serialization/Deserialization Implementation

#### 4.3.1 File Locations and Directory Structure

All agent data lives under `~/.local/share/ollama-agent/`:

```
~/.local/share/ollama-agent/
├── config/
│   └── models.json              # Model configuration
└── sessions/
    ├── 2026-01-07T10:23:21.000MST/
    │   ├── plan_doc.md          # Plan markdown
    │   ├── chat_history.log     # Exact chat transcript
    │   └── session.json         # Session metadata
    └── 2026-01-08T14:15:00.000MST/
        ├── plan_doc.md
        ├── chat_history.log
        └── session.json
```

**Directory Naming:**
- Format: `YYYY-MM-DDTHH:mm:ss.SSSTZ` (ISO 8601 with timezone)
- Example: `2026-01-07T10:23:21.000MST`
- Sortable chronologically
- Unique per session

**File Purposes:**
- `plan_doc.md` - Plan serialized as markdown (with YAML frontmatter)
- `chat_history.log` - Append-only log of EVERYTHING shown to user
- `session.json` - Session metadata (start time, model, status)

#### 4.3.2 Session Initialization

When a new session starts:

```typescript
// src/domain/session/SessionManager.ts

async initializeSession(): Promise<Session> {
  const timestamp = new Date();
  const sessionDir = this.formatSessionDir(timestamp);
  const sessionPath = path.join(
    expandTilde('~/.local/share/ollama-agent/sessions'),
    sessionDir
  );

  // Create session directory
  await fs.mkdir(sessionPath, { recursive: true });

  // Create empty plan_doc.md
  await fs.writeFile(
    path.join(sessionPath, 'plan_doc.md'),
    this.emptyPlanTemplate(),
    'utf-8'
  );

  // Create chat_history.log with initial prompt
  const initialPrompt = this.getInitialPrompt();
  await fs.appendFile(
    path.join(sessionPath, 'chat_history.log'),
    `[${timestamp.toISOString()}] SYSTEM: ${initialPrompt}\n`,
    'utf-8'
  );

  // Create session.json
  const session: Session = {
    id: sessionDir,
    startedAt: timestamp.getTime(),
    model: this.config.model,
    status: 'active'
  };

  await fs.writeFile(
    path.join(sessionPath, 'session.json'),
    JSON.stringify(session, null, 2),
    'utf-8'
  );

  return session;
}

private emptyPlanTemplate(): string {
  return `---
status: planning
createdAt: ${Date.now()}
updatedAt: ${Date.now()}
version: 1
---

# Plan: [Goal to be defined]

**Status:** planning

## Goal
[User will provide goal]

## Acceptance Criteria
- [ ] [Criteria will be added once goal is defined]

## Decisions Made
[No decisions yet]

## Decisions Rejected
[No rejected decisions yet]

## Execution Log
[No actions taken yet]
`;
}

private getInitialPrompt(): string {
  return 'What would you like to build?';
}
```

#### 4.3.3 Plan Serialization (Object → Markdown)

```typescript
// src/domain/plan/PlanSerializer.ts

class PlanSerializer {
  /**
   * Serialize Plan object to markdown with YAML frontmatter
   * Round-trip compatible with deserialization
   */
  serialize(plan: Plan): string {
    // YAML frontmatter with metadata
    const frontmatter = [
      '---',
      `status: ${plan.status}`,
      `createdAt: ${plan.metadata.createdAt}`,
      `updatedAt: ${plan.metadata.updatedAt}`,
      `version: ${plan.metadata.version}`,
      '---',
      ''
    ].join('\n');

    // Main content
    const body = [
      `# Plan: ${plan.goal || '[Goal to be defined]'}`,
      '',
      `**Status:** ${plan.status}`,
      '',
      '## Goal',
      plan.goal || '[User will provide goal]',
      '',
      this.serializeAcceptanceCriteria(plan.acceptanceCriteria),
      this.serializeDecisionsMade(plan.decisionsMade),
      this.serializeDecisionsRejected(plan.decisionsRejected),
      this.serializeExecutionLog(plan.executionLog)
    ].join('\n');

    return frontmatter + body;
  }

  private serializeAcceptanceCriteria(criteria: AcceptanceCriterion[]): string {
    if (criteria.length === 0) {
      return '## Acceptance Criteria\n- [ ] [Criteria will be added once goal is defined]';
    }

    const items = criteria.map(c => {
      const checkbox = c.completed ? '[x]' : '[ ]';
      const notes = c.notes ? ` *(${c.notes})*` : '';
      return `- ${checkbox} ${c.description}${notes}`;
    });

    return `## Acceptance Criteria\n${items.join('\n')}`;
  }

  private serializeDecisionsMade(decisions: Decision[]): string {
    if (decisions.length === 0) {
      return '\n## Decisions Made\n[No decisions yet]';
    }

    const sections = decisions.map(d => {
      const date = new Date(d.timestamp).toISOString().split('T')[0];
      const time = new Date(d.timestamp).toTimeString().slice(0, 5);

      let section = `\n### ${d.title}`;
      section += `\n**Rationale:** ${d.rationale}`;

      if (d.alternatives && d.alternatives.length > 0) {
        section += `\n**Alternatives considered:** ${d.alternatives.join(', ')}`;
      }

      section += `\n**Decided:** ${date} ${time}`;

      return section;
    });

    return `\n## Decisions Made${sections.join('\n')}`;
  }

  private serializeDecisionsRejected(decisions: Decision[]): string {
    if (decisions.length === 0) {
      return '\n## Decisions Rejected\n[No rejected decisions yet]';
    }

    const sections = decisions.map(d => {
      const date = new Date(d.timestamp).toISOString().split('T')[0];
      const time = new Date(d.timestamp).toTimeString().slice(0, 5);

      let section = `\n### ${d.title}`;
      section += `\n**Rationale:** ${d.rationale}`;

      if (d.alternatives && d.alternatives.length > 0) {
        section += `\n**Alternative:** ${d.alternatives.join(', ')}`;
      }

      section += `\n**Rejected:** ${date} ${time}`;

      return section;
    });

    return `\n## Decisions Rejected${sections.join('\n')}`;
  }

  private serializeExecutionLog(log: LogEntry[]): string {
    if (log.length === 0) {
      return '\n## Execution Log\n[No actions taken yet]';
    }

    const entries = log.map(entry => {
      const date = new Date(entry.timestamp).toISOString().split('T')[0];
      const time = new Date(entry.timestamp).toTimeString().slice(0, 5);

      let section = `\n### ${date} ${time} - ${entry.action}`;
      section += `\n**Tools:** ${entry.toolsUsed.join(', ')}`;
      section += `\n**Result:** ${entry.result}`;

      return section;
    });

    return `\n## Execution Log${entries.join('\n')}`;
  }
}
```

#### 4.3.4 Plan Deserialization (Markdown → Object)

**Design Philosophy:**
- **Flexible parsing** - Accept `[x]`, `[X]`, `[✓]`, etc.
- **Retry with better prompt** - If malformed, don't throw - retry LLM with improved instructions
- **Use defaults** - Missing sections get safe defaults, not errors
- **Provider-specific** - Parsing logic can evolve per data provider

```typescript
// src/domain/plan/PlanDeserializer.ts

class PlanDeserializer {
  /**
   * Deserialize markdown to Plan object
   * Flexible parsing with defaults for missing data
   */
  deserialize(markdown: string, sessionId: SessionId): Result<Plan, ParseError> {
    try {
      // Parse YAML frontmatter
      const { frontmatter, body } = this.extractFrontmatter(markdown);

      // Parse metadata from frontmatter
      const metadata = this.parseMetadata(frontmatter);

      // Parse body sections
      const status = this.parseStatus(body);
      const goal = this.parseGoal(body);
      const acceptanceCriteria = this.parseAcceptanceCriteria(body);
      const decisionsMade = this.parseDecisions(body, 'Decisions Made');
      const decisionsRejected = this.parseDecisions(body, 'Decisions Rejected');
      const executionLog = this.parseExecutionLog(body);

      const plan: Plan = {
        status,
        goal,
        acceptanceCriteria,
        decisionsMade,
        decisionsRejected,
        executionLog,
        metadata
      };

      return { success: true, value: plan };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'parse_error',
          message: error.message,
          markdown,
          suggestedPrompt: this.generateRetryPrompt(error)
        }
      };
    }
  }

  private extractFrontmatter(markdown: string): { frontmatter: string; body: string } {
    const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!match) {
      // No frontmatter - return defaults
      return {
        frontmatter: 'status: planning\ncreatedAt: 0\nupdatedAt: 0\nversion: 1',
        body: markdown
      };
    }

    return {
      frontmatter: match[1] ?? '',
      body: match[2] ?? ''
    };
  }

  private parseMetadata(frontmatter: string): PlanMetadata {
    const lines = frontmatter.split('\n');
    const metadata: Partial<PlanMetadata> = {};

    for (const line of lines) {
      const [key, value] = line.split(':').map(s => s.trim());

      if (key === 'createdAt' || key === 'updatedAt') {
        metadata[key] = Number.parseInt(value || '0', 10);
      } else if (key === 'version') {
        metadata.version = Number.parseInt(value || '1', 10);
      }
    }

    return {
      createdAt: metadata.createdAt || Date.now(),
      updatedAt: metadata.updatedAt || Date.now(),
      version: metadata.version || 1
    };
  }

  private parseStatus(body: string): PlanStatus {
    const match = body.match(/\*\*Status:\*\*\s*(\w+)/);
    const status = match?.[1]?.toLowerCase();

    const validStatuses: PlanStatus[] = ['planning', 'in_progress', 'blocked', 'completed', 'failed'];

    if (status && validStatuses.includes(status as PlanStatus)) {
      return status as PlanStatus;
    }

    return 'planning'; // Default
  }

  private parseGoal(body: string): string {
    const match = body.match(/## Goal\n([^\n]+)/);
    const goal = match?.[1]?.trim();

    if (!goal || goal === '[User will provide goal]') {
      return '';
    }

    return goal;
  }

  private parseAcceptanceCriteria(body: string): AcceptanceCriterion[] {
    const section = this.extractSection(body, 'Acceptance Criteria');
    if (!section) return [];

    const lines = section.split('\n').filter(line => line.trim().startsWith('-'));

    return lines.map(line => {
      // Flexible checkbox parsing: [x], [X], [✓], etc. = completed
      const completed = /\[(x|X|✓|✔)\]/.test(line);

      // Extract description (everything after checkbox)
      const descMatch = line.match(/\[.\]\s*([^*]+)/);
      const description = descMatch?.[1]?.trim() || '';

      // Extract notes (text in parentheses with asterisks)
      const notesMatch = line.match(/\*\(([^)]+)\)\*/);
      const notes = notesMatch?.[1] || undefined;

      return { description, completed, notes };
    }).filter(c => c.description.length > 0);
  }

  private parseDecisions(body: string, sectionName: string): Decision[] {
    const section = this.extractSection(body, sectionName);
    if (!section) return [];

    const decisions: Decision[] = [];
    const subsections = section.split(/\n### /).slice(1); // Split on h3 headers

    for (const subsection of subsections) {
      const lines = subsection.split('\n');
      const title = lines[0]?.trim() || '';

      const rationaleMatch = subsection.match(/\*\*Rationale:\*\*\s*([^\n]+)/);
      const rationale = rationaleMatch?.[1]?.trim() || '';

      const altMatch = subsection.match(/\*\*Alternatives[^:]*:\*\*\s*([^\n]+)/);
      const alternatives = altMatch?.[1]?.split(',').map(s => s.trim()).filter(Boolean);

      const timestampMatch = subsection.match(/(Decided|Rejected):\*\*\s*(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})/);
      const timestamp = timestampMatch
        ? new Date(`${timestampMatch[2]}T${timestampMatch[3]}:00`).getTime()
        : Date.now();

      if (title && rationale) {
        decisions.push({ title, rationale, alternatives, timestamp });
      }
    }

    return decisions;
  }

  private parseExecutionLog(body: string): LogEntry[] {
    const section = this.extractSection(body, 'Execution Log');
    if (!section) return [];

    const entries: LogEntry[] = [];
    const subsections = section.split(/\n### /).slice(1);

    for (const subsection of subsections) {
      const lines = subsection.split('\n');

      // Parse header: "YYYY-MM-DD HH:mm - Action description"
      const headerMatch = lines[0]?.match(/(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})\s*-\s*(.+)/);
      if (!headerMatch) continue;

      const [, date, time, action] = headerMatch;
      const timestamp = new Date(`${date}T${time}:00`).getTime();

      const toolsMatch = subsection.match(/\*\*Tools:\*\*\s*([^\n]+)/);
      const toolsUsed = toolsMatch?.[1]?.split(',').map(s => s.trim()).filter(Boolean) || [];

      const resultMatch = subsection.match(/\*\*Result:\*\*\s*([^\n]+)/);
      const result = resultMatch?.[1]?.trim() || '';

      entries.push({ timestamp, action, result, toolsUsed });
    }

    return entries;
  }

  private extractSection(body: string, sectionName: string): string | null {
    const regex = new RegExp(`## ${sectionName}\\n([\\s\\S]*?)(?=\\n## |$)`);
    const match = body.match(regex);
    return match?.[1]?.trim() || null;
  }

  /**
   * Generate improved prompt for LLM to retry malformed plan
   */
  private generateRetryPrompt(error: Error): string {
    return `The previous plan format was invalid: ${error.message}

Please regenerate the plan following this EXACT format:

---
status: planning
createdAt: ${Date.now()}
updatedAt: ${Date.now()}
version: 1
---

# Plan: [Your Goal]

**Status:** planning

## Goal
[Clear goal description]

## Acceptance Criteria
- [ ] First criterion
- [ ] Second criterion

## Decisions Made
[If no decisions yet, write: "No decisions yet"]

## Decisions Rejected
[If no rejected decisions, write: "No rejected decisions yet"]

## Execution Log
[If no actions yet, write: "No actions taken yet"]

CRITICAL RULES:
- Use lowercase status values: planning, in_progress, blocked, completed, failed
- Use [ ] for incomplete, [x] for complete checkboxes
- Include all 5 sections even if empty
- YAML frontmatter must be valid`;
  }
}
```

#### 4.3.5 chat_history.log Format

**Purpose:** Append-only log of EVERYTHING shown to user with timestamps

**Format:**
```
[2026-01-07T10:23:21.000Z] SYSTEM: What would you like to build?
[2026-01-07T10:23:45.123Z] USER: Create a REST API for user authentication
[2026-01-07T10:23:46.456Z] AGENT: I'll help you create a user authentication API. Let me start by creating a plan.
[2026-01-07T10:23:47.789Z] TOOL_CALL: initialize_plan(goal="Create REST API for user authentication")
[2026-01-07T10:23:48.012Z] TOOL_RESULT: Plan initialized with 5 acceptance criteria
[2026-01-07T10:23:50.234Z] AGENT: Plan created! Here's what we'll build:

---
[Full plan_doc.md content pasted here when shown to user]
---

[2026-01-07T10:24:15.456Z] USER: Add JWT token support
[2026-01-07T10:24:16.789Z] AGENT: I'll add JWT token support to the plan...
```

**Implementation:**
```typescript
// src/domain/session/ChatLogger.ts

class ChatLogger {
  constructor(private sessionPath: string) {}

  async logSystem(message: string): Promise<void> {
    await this.append('SYSTEM', message);
  }

  async logUser(message: string): Promise<void> {
    await this.append('USER', message);
  }

  async logAgent(message: string): Promise<void> {
    await this.append('AGENT', message);
  }

  async logToolCall(toolName: string, params: Record<string, unknown>): Promise<void> {
    const paramsStr = JSON.stringify(params);
    await this.append('TOOL_CALL', `${toolName}(${paramsStr})`);
  }

  async logToolResult(result: string): Promise<void> {
    await this.append('TOOL_RESULT', result);
  }

  async logPlanShown(planMarkdown: string): Promise<void> {
    await this.append('AGENT', `Here's the current plan:\n\n---\n${planMarkdown}\n---`);
  }

  private async append(type: string, message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const logPath = path.join(this.sessionPath, 'chat_history.log');
    const entry = `[${timestamp}] ${type}: ${message}\n`;

    await fs.appendFile(logPath, entry, 'utf-8');
  }
}
```

**Key Rules:**
1. **Append-only** - Never modify existing entries
2. **Include EVERYTHING** - Even plan_doc.md when shown to user
3. **Timestamps in ISO 8601** - Sortable, timezone-aware
4. **Human-readable** - Can be viewed with `cat` or `tail -f`

#### 4.3.6 Fault Tolerance

**Strategy:** Don't throw errors - retry with better prompts

```typescript
// src/domain/plan/PlanManager.ts

class PlanManager {
  constructor(
    private serializer: PlanSerializer,
    private deserializer: PlanDeserializer,
    private ollama: OllamaClient,
    private sessionPath: string
  ) {}

  async savePlan(plan: Plan): Promise<void> {
    const markdown = this.serializer.serialize(plan);
    const planPath = path.join(this.sessionPath, 'plan_doc.md');

    await fs.writeFile(planPath, markdown, 'utf-8');
  }

  async loadPlan(sessionId: SessionId): Promise<Plan> {
    const planPath = path.join(this.sessionPath, 'plan_doc.md');
    const markdown = await fs.readFile(planPath, 'utf-8');

    const result = this.deserializer.deserialize(markdown, sessionId);

    if (result.success) {
      return result.value;
    }

    // Deserialization failed - retry with LLM
    console.warn(`Plan parsing failed: ${result.error.message}. Asking LLM to fix format...`);

    return this.retryWithLLM(markdown, result.error);
  }

  /**
   * Ask LLM to regenerate plan with correct format
   * This handles malformed plans gracefully
   */
  private async retryWithLLM(
    malformedMarkdown: string,
    error: ParseError
  ): Promise<Plan> {
    const response = await this.ollama.call({
      modelPrompt: 'You are a plan formatter. Fix the malformed plan to match the required format.',
      agentMd: await fs.readFile(expandTilde('~/AGENTS.md'), 'utf-8'),
      planDoc: malformedMarkdown,
      responseFormat: error.suggestedPrompt,
      messageHistory: [],
      responseExamples: [],
    });

    const fixedMarkdown = response.message.content;
    const retryResult = this.deserializer.deserialize(fixedMarkdown, this.sessionId);

    if (retryResult.success) {
      // Save corrected version
      await this.savePlan(retryResult.value);
      return retryResult.value;
    }

    // Still failed - use defaults
    console.error('LLM retry failed. Using default empty plan.');
    return this.getDefaultPlan();
  }

  private getDefaultPlan(): Plan {
    return {
      status: 'planning',
      goal: '',
      acceptanceCriteria: [],
      decisionsMade: [],
      decisionsRejected: [],
      executionLog: [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1
      }
    };
  }
}
```

#### 4.3.7 Testing

```typescript
// tests/unit/plan/PlanSerializer.test.ts

describe('PlanSerializer round-trip', () => {
  it('should serialize and deserialize without data loss', () => {
    const originalPlan: Plan = {
      status: 'in_progress',
      goal: 'Create authentication API',
      acceptanceCriteria: [
        { description: 'User registration', completed: true },
        { description: 'User login', completed: false, notes: 'Needs JWT' }
      ],
      decisionsMade: [
        {
          title: 'Use bcrypt',
          rationale: 'Industry standard',
          alternatives: ['argon2', 'scrypt'],
          timestamp: 1704630000000
        }
      ],
      decisionsRejected: [],
      executionLog: [
        {
          timestamp: 1704630060000,
          action: 'Created User model',
          result: '✓ Success',
          toolsUsed: ['write_file']
        }
      ],
      metadata: {
        createdAt: 1704630000000,
        updatedAt: 1704630120000,
        version: 2
      }
    };

    // Serialize
    const markdown = serializer.serialize(originalPlan);

    // Deserialize
    const result = deserializer.deserialize(markdown, 'test-session');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual(originalPlan);
    }
  });

  it('should parse flexible checkbox formats', () => {
    const markdown = `
## Acceptance Criteria
- [x] Task 1
- [X] Task 2
- [✓] Task 3
- [✔] Task 4
- [ ] Task 5
`;

    const result = deserializer.deserialize(markdown, 'test');

    if (result.success) {
      expect(result.value.acceptanceCriteria).toHaveLength(5);
      expect(result.value.acceptanceCriteria.filter(c => c.completed)).toHaveLength(4);
    }
  });

  it('should handle missing sections gracefully', () => {
    const markdown = `
---
status: planning
---

# Plan: Test

## Goal
Build something
`;

    const result = deserializer.deserialize(markdown, 'test');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.acceptanceCriteria).toEqual([]);
      expect(result.value.decisionsMade).toEqual([]);
      expect(result.value.executionLog).toEqual([]);
    }
  });
});
```

### 4.4 Design Rationale

**Why this structure?**

1. **Acceptance Criteria:**
   - Clear definition of "done"
   - Checkboxes provide visual progress
   - Notes field for context/blockers

2. **Decisions Made:**
   - Documents **why** we chose this approach
   - Prevents redundant discussions
   - Captures alternatives for future reference

3. **Decisions Rejected:**
   - Prevents backtracking to failed approaches
   - Documents **what didn't work** and why
   - Saves time on future iterations

4. **Execution Log:**
   - Summarized history (not full chat)
   - Key actions and results only
   - Tools used for context
   - Status symbols (✓ ❌ 🚧) for quick scanning

**This gives the LLM rich context without needing full conversation history.**

---

## 5. models.json Format

### 5.1 Structure

```json
{
  "models": {
    "qwen2.5-coder:7b": {
      "displayName": "Qwen 2.5 Coder 7B",
      "provider": "ollama",
      "capabilities": ["code", "reasoning", "tools"],
      "contextWindow": 32768,
      "recommendedFor": ["quick_tasks", "code_editing", "file_operations"],
      "prompt": "You are Qwen 2.5 Coder, a specialized coding assistant. You excel at:\n- Writing clean, idiomatic code\n- Understanding context from minimal information\n- Making pragmatic engineering decisions\n\nImportant instructions:\n- Always respond with valid JSON\n- Call multiple tools in parallel when possible\n- Be concise in your responses\n- Focus on the current task in the plan"
    },
    "qwen2.5-coder:32b": {
      "displayName": "Qwen 2.5 Coder 32B",
      "provider": "ollama",
      "capabilities": ["code", "reasoning", "architecture", "tools"],
      "contextWindow": 32768,
      "recommendedFor": ["complex_tasks", "architecture", "refactoring"],
      "prompt": "You are Qwen 2.5 Coder 32B, an advanced coding assistant. You excel at:\n- Complex architectural decisions\n- Large-scale refactoring\n- Understanding intricate codebases\n- Multi-step problem solving\n\nImportant instructions:\n- Always respond with valid JSON\n- Break complex tasks into clear steps\n- Consider edge cases and error handling\n- Document your reasoning in decision logs"
    },
    "llama3.1:8b": {
      "displayName": "Llama 3.1 8B",
      "provider": "ollama",
      "capabilities": ["general", "reasoning", "tools"],
      "contextWindow": 128000,
      "recommendedFor": ["planning", "documentation", "analysis"],
      "prompt": "You are Llama 3.1, a helpful assistant. When working on tasks:\n- Think step-by-step\n- Ask clarifying questions when needed\n- Provide detailed explanations\n- Always respond with valid JSON\n\nNote: You have a large context window - use it to maintain full awareness of the plan."
    }
  },
  "selectionRules": {
    "default": "qwen2.5-coder:7b",
    "byTaskType": {
      "architecture": "qwen2.5-coder:32b",
      "planning": "llama3.1:8b",
      "coding": "qwen2.5-coder:7b",
      "refactoring": "qwen2.5-coder:32b"
    }
  }
}
```

### 5.2 Field Descriptions

**Model Entry:**
- `displayName` - Human-readable name for UI
- `provider` - Currently "ollama" only (future: llama.cpp, localai)
- `capabilities` - What the model is good at
- `contextWindow` - Token limit (for truncation logic)
- `recommendedFor` - Task types best suited for this model
- `prompt` - Model-specific instructions (injected as system message)

**Selection Rules:**
- `default` - Fallback model if no specific match
- `byTaskType` - Map task types to optimal models

### 5.3 Usage

```typescript
// src/data/models/ModelSelector.ts

class ModelSelector {
  constructor(private config: ModelsConfig) {}

  selectModel(taskType?: TaskType): string {
    if (!taskType) {
      return this.config.selectionRules.default;
    }

    return this.config.selectionRules.byTaskType[taskType]
      || this.config.selectionRules.default;
  }

  getModelPrompt(modelName: string): string {
    const model = this.config.models[modelName];
    if (!model) {
      throw new Error(`Model ${modelName} not found in models.json`);
    }
    return model.prompt;
  }
}
```

---

## 6. AGENTS.md Convention

### 6.1 Standard Location

`~/AGENTS.md` (user's home directory)

This file contains **permanent agent behavior** that applies across all sessions.

### 6.2 Template

```markdown
# Agent System Prompt

You are an autonomous coding agent that helps users accomplish programming tasks by creating and executing plans.

## Your Capabilities

You can:
- Read and write files
- Execute shell commands (with user approval for dangerous operations)
- Search codebases
- Make architectural decisions
- Track progress via structured plans

## Core Behavior

1. **Plan-Driven Execution**
   - Always work according to the current plan
   - Update the plan when goals or requirements change
   - Mark acceptance criteria complete when achieved

2. **Tool Usage**
   - Call tools using the specified JSON format
   - Batch independent operations (multiple read_file calls in parallel)
   - Always check tool results before proceeding

3. **Decision Making**
   - Document significant decisions in the plan
   - Include rationale and alternatives considered
   - Add rejected approaches to prevent revisiting

4. **Safety**
   - Never modify protected files (.env, package.json, etc.)
   - Request approval for destructive operations
   - Validate inputs before file writes

5. **Communication**
   - Be concise and actionable
   - Focus on the current task
   - Ask clarifying questions when requirements are unclear

## Execution Log

Keep the execution log concise but informative:
- What action was taken
- What tools were used
- What the result was
- Current status (✓ complete, 🚧 in progress, ❌ failed)

## Response Guidelines

- ALWAYS respond with valid JSON
- NEVER mix tool_calls and response in the same JSON object
- Use tool_calls when you need to perform actions
- Use response when you're done or need user input
- Keep responses focused on the immediate next step
```

### 6.3 Customization

Users can customize `~/AGENTS.md` to:
- Add project-specific conventions
- Enforce coding standards
- Define custom workflows
- Add domain-specific knowledge

**Example additions:**
```markdown
## Project-Specific Rules

- Always use TypeScript strict mode
- Follow Airbnb ESLint config
- Write tests alongside implementation
- Use branded types for IDs (type UserId = string & { __brand: 'UserId' })
```

---

## 7. Message History Format

### 7.1 Structure

Keep the **last 5 user messages** with associated agent actions:

```typescript
const messageHistory: Message[] = [
  {
    role: 'user',
    content: 'Create a user authentication API'
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      tool_calls: [
        {name: 'initialize_plan', parameters: {goal: 'Create user authentication API'}}
      ]
    })
  },
  {
    role: 'user',
    content: 'Tool result: Plan initialized with 5 acceptance criteria'
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      tool_calls: [
        {name: 'write_file', parameters: {path: 'src/index.ts', content: '...'}}
      ]
    })
  },
  {
    role: 'user',
    content: 'Tool result: File written successfully'
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      response: 'Express server setup complete. Moving to user model creation.'
    })
  },
  {
    role: 'user',
    content: 'Add password validation that requires 8+ characters'
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      tool_calls: [
        {name: 'read_file', parameters: {file_path: 'src/models/User.ts'}}
      ]
    })
  }
];
```

### 7.2 Key Rules

1. **Last 5 USER messages** (not iterations)
   - Count user messages only
   - Include all agent responses for those messages

2. **Agent tool calls as assistant messages**
   - Format as JSON strings
   - LLM learns format by example

3. **Tool results as user messages**
   - Agent sees its own results
   - Format: `"Tool result: ..."`

4. **Bounded history**
   - Prevents context explosion
   - Plan document provides longer-term memory

### 7.3 Implementation

```typescript
class MessageHistoryManager {
  private history: Message[] = [];
  private readonly maxUserMessages = 5;

  addUserMessage(content: string): void {
    this.history.push({
      role: 'user',
      content,
      timestamp: Date.now()
    });

    this.truncate();
  }

  addAssistantMessage(content: string): void {
    this.history.push({
      role: 'assistant',
      content,
      timestamp: Date.now()
    });
  }

  private truncate(): void {
    // Count user messages
    const userMessages = this.history.filter(m => m.role === 'user');

    if (userMessages.length > this.maxUserMessages) {
      // Find index of oldest user message to keep
      const keepFromIndex = this.history.findIndex(
        m => m === userMessages[userMessages.length - this.maxUserMessages]
      );

      this.history = this.history.slice(keepFromIndex);
    }
  }

  getHistory(): Message[] {
    return [...this.history];
  }
}
```

---

## 8. Response Examples

### 8.1 Few-Shot Learning Templates

```typescript
const responseExamples = [
  `# Example 1: Reading multiple files in parallel
User: "Check package.json and README.md"
Assistant: {
  "tool_calls": [
    {"name": "read_file", "parameters": {"file_path": "package.json"}},
    {"name": "read_file", "parameters": {"file_path": "README.md"}}
  ]
}`,

  `# Example 2: Writing a file
User: "Create a User model"
Assistant: {
  "tool_calls": [
    {
      "name": "write_file",
      "parameters": {
        "file_path": "src/models/User.ts",
        "content": "export interface User {\\n  id: string;\\n  email: string;\\n  password: string;\\n}"
      }
    }
  ]
}`,

  `# Example 3: Sequential operations (read then write)
User: "Add a logger to the server file"
Assistant: {
  "tool_calls": [
    {"name": "read_file", "parameters": {"file_path": "src/server.ts"}}
  ]
}
[After receiving file content, next iteration:]
Assistant: {
  "tool_calls": [
    {
      "name": "write_file",
      "parameters": {
        "file_path": "src/server.ts",
        "content": "[modified content with logger]"
      }
    }
  ]
}`,

  `# Example 4: Final response
User: "Thanks!"
Assistant: {
  "response": "You're welcome! The user authentication API is now complete with all acceptance criteria met. Let me know if you need anything else."
}`,

  `# Example 5: Asking for clarification
User: "Fix the bug"
Assistant: {
  "response": "I need more information to help. Which file contains the bug, and what behavior are you seeing?"
}`,

  `# Example 6: Updating plan decisions
User: "Let's use argon2 instead of bcrypt"
Assistant: {
  "tool_calls": [
    {
      "name": "update_plan",
      "parameters": {
        "decisions_made": [
          {
            "title": "Use argon2 for password hashing",
            "rationale": "More secure than bcrypt, worth the performance tradeoff",
            "alternatives": ["bcrypt", "scrypt"]
          }
        ],
        "decisions_rejected": [
          {
            "title": "Use bcrypt for password hashing",
            "rationale": "User prefers stronger security of argon2"
          }
        ]
      }
    }
  ]
}`
];
```

### 8.2 Usage

Include these examples in the system prompt to provide few-shot learning:

```typescript
const systemPrompt = `
${agentMd}

# Response Format
${responseFormat}

# Examples
${responseExamples.join('\n\n')}
`;
```

---

## 9. Tool Schema Generation

### 9.1 Tool Definition

```typescript
// src/domain/tools/definitions/files/ReadFileTool.ts

export const ReadFileTool: Tool = {
  name: 'read_file',
  description: 'Read the complete contents of a file from the filesystem',
  parameters: [
    {
      name: 'file_path',
      type: 'string',
      description: 'Absolute path to the file to read',
      required: true
    },
    {
      name: 'encoding',
      type: 'string',
      description: 'File encoding (default: utf-8)',
      required: false,
      default: 'utf-8'
    }
  ],
  execute: async (args: Record<string, unknown>) => {
    // Implementation...
  }
};
```

### 9.2 Schema Generation

```typescript
// src/domain/tools/ToolRegistry.ts

class ToolRegistry {
  /**
   * Generate tool schemas for LLM prompt
   * Format matches Claude Code convention
   */
  generateSchemas(): string {
    const schemas = Array.from(this.tools.values()).map(tool => {
      const params = tool.parameters.map(param => {
        const required = param.required ? ' (required)' : ' (optional)';
        const defaultVal = param.default ? ` [default: ${param.default}]` : '';
        return `  - ${param.name}: ${param.type}${required}${defaultVal} - ${param.description}`;
      });

      return `### ${tool.name}
${tool.description}

**Parameters:**
${params.join('\n')}

**Example:**
\`\`\`json
{
  "tool_calls": [
    {
      "name": "${tool.name}",
      "parameters": ${JSON.stringify(this.getExampleParams(tool), null, 2)}
    }
  ]
}
\`\`\``;
    });

    return schemas.join('\n\n---\n\n');
  }

  private getExampleParams(tool: Tool): Record<string, any> {
    const example: Record<string, any> = {};

    tool.parameters.forEach(param => {
      if (!param.required && !param.default) {
        return; // Skip optional params in examples
      }

      switch (param.type) {
        case 'string':
          if (param.name.includes('path') || param.name.includes('file')) {
            example[param.name] = '/path/to/file.ext';
          } else {
            example[param.name] = `example_${param.name}`;
          }
          break;
        case 'number':
          example[param.name] = 42;
          break;
        case 'boolean':
          example[param.name] = true;
          break;
        case 'object':
          example[param.name] = {};
          break;
        case 'array':
          example[param.name] = [];
          break;
      }
    });

    return example;
  }
}
```

### 9.3 Generated Schema Example

```markdown
### read_file
Read the complete contents of a file from the filesystem

**Parameters:**
  - file_path: string (required) - Absolute path to the file to read
  - encoding: string (optional) [default: utf-8] - File encoding

**Example:**
```json
{
  "tool_calls": [
    {
      "name": "read_file",
      "parameters": {
        "file_path": "/path/to/file.ext"
      }
    }
  ]
}
```

---

### write_file
Write content to a file on the filesystem

**Parameters:**
  - file_path: string (required) - Absolute path to the file to write
  - content: string (required) - Content to write to the file
  - create_directories: boolean (optional) [default: true] - Create parent directories if they don't exist

**Example:**
```json
{
  "tool_calls": [
    {
      "name": "write_file",
      "parameters": {
        "file_path": "/path/to/file.ext",
        "content": "example_content"
      }
    }
  ]
}
```
```

---

## 10. Implementation Examples

### 10.1 Complete AgentOrchestrator Integration

```typescript
// src/domain/agent/AgentOrchestrator.ts

class AgentOrchestrator {
  constructor(
    private ollama: OllamaClient,
    private planManager: PlanManager,
    private toolRegistry: ToolRegistry,
    private messageHistory: MessageHistoryManager,
    private config: AgentConfig
  ) {}

  async processMessage(
    userMessage: string,
    callbacks: ProgressCallbacks
  ): Promise<string> {
    // Add user message to history
    this.messageHistory.addUserMessage(userMessage);

    let iterations = 0;
    const maxIterations = this.config.maxIterations;

    while (iterations < maxIterations) {
      iterations++;

      // Load agent markdown
      const agentMd = await fs.readFile(
        expandTilde('~/AGENTS.md'),
        'utf-8'
      );

      // Get model-specific prompt
      const modelSelector = new ModelSelector(this.config.models);
      const modelPrompt = modelSelector.getModelPrompt(this.config.model);

      // Build context for LLM
      const response = await this.ollama.call({
        modelPrompt,
        agentMd,
        planDoc: this.planManager.serializeToMarkdown(),
        responseFormat: RESPONSE_FORMAT_SPEC,
        messageHistory: this.messageHistory.getHistory(),
        responseExamples: RESPONSE_EXAMPLES,
        model: this.config.model,
        options: {
          temperature: 0.2, // Low temp for reliable JSON
        }
      });

      // Add assistant response to history
      this.messageHistory.addAssistantMessage(response.message.content);

      // Parse response
      const parsed = this.parseResponse(response.message.content);

      if (parsed.type === 'tool_calls') {
        // Execute tools (batch if multiple)
        callbacks.onStateChange?.({ type: 'executing_tools' });

        const results = await this.toolRegistry.executeBatch(
          parsed.calls.map(call => ({
            tool: call.name,
            args: call.parameters
          }))
        );

        // Format and add tool results to history
        const resultsText = this.formatToolResults(results);
        this.messageHistory.addUserMessage(`Tool results:\n${resultsText}`);

        // Update execution log
        this.planManager.addLogEntry({
          timestamp: Date.now(),
          action: `Executed ${parsed.calls.length} tool(s)`,
          result: results.every(r => r.success) ? '✓ Success' : '❌ Failure',
          toolsUsed: parsed.calls.map(c => c.name)
        });

        // Continue loop
        continue;
      }

      if (parsed.type === 'response') {
        // Final response - return to user
        callbacks.onStateChange?.({ type: 'completed' });
        return parsed.response;
      }

      // Invalid response
      throw new Error('LLM returned invalid format');
    }

    throw new Error(`Hit max iterations (${maxIterations})`);
  }

  private parseResponse(content: string): ParsedResponse {
    try {
      const json = JSON.parse(content);

      // Check for tool calls
      if ('tool_calls' in json && Array.isArray(json.tool_calls)) {
        return {
          type: 'tool_calls',
          calls: json.tool_calls.map((call: any) => ({
            name: call.name,
            parameters: call.parameters
          }))
        };
      }

      // Check for final response
      if ('response' in json && typeof json.response === 'string') {
        return {
          type: 'response',
          response: json.response
        };
      }

      throw new Error('JSON missing required fields (tool_calls or response)');
    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${error.message}\n\nContent: ${content}`);
    }
  }

  private formatToolResults(results: ToolResult[]): string {
    return results.map((result, i) => {
      if (result.success) {
        return `[${i}] ✓ ${result.output}`;
      } else {
        return `[${i}] ❌ Error: ${result.error}`;
      }
    }).join('\n');
  }
}
```

### 10.2 Constants Definition

```typescript
// src/domain/agent/constants.ts

export const RESPONSE_FORMAT_SPEC = `You MUST respond with valid JSON in one of these formats:

## Tool Calls
When you need to perform actions, use the tool_calls format:

{
  "tool_calls": [
    {
      "name": "tool_name",
      "parameters": {
        "param1": "value1",
        "param2": "value2"
      }
    }
  ]
}

**Rules:**
- tool_calls is an ARRAY (can contain multiple tools)
- Each tool call has "name" (string) and "parameters" (object)
- Parameter names MUST match tool definitions exactly
- You can call multiple independent tools in parallel

## Final Response
When you're done and want to respond to the user:

{
  "response": "Your message to the user here"
}

**Rules:**
- Use "response" field for final answers
- NEVER mix tool_calls and response in same JSON
- Be concise and specific`;

export const RESPONSE_EXAMPLES = [
  `# Example 1: Reading multiple files in parallel
User: "Check package.json and README.md"
Assistant: {
  "tool_calls": [
    {"name": "read_file", "parameters": {"file_path": "package.json"}},
    {"name": "read_file", "parameters": {"file_path": "README.md"}}
  ]
}`,

  `# Example 2: Writing a file
User: "Create a User model"
Assistant: {
  "tool_calls": [
    {
      "name": "write_file",
      "parameters": {
        "file_path": "src/models/User.ts",
        "content": "export interface User {\\n  id: string;\\n  email: string;\\n  password: string;\\n}"
      }
    }
  ]
}`,

  `# Example 3: Final response
User: "Thanks!"
Assistant: {
  "response": "You're welcome! The user authentication API is now complete with all acceptance criteria met."
}`,

  `# Example 4: Asking for clarification
User: "Fix the bug"
Assistant: {
  "response": "I need more information to help. Which file contains the bug, and what behavior are you seeing?"
}`
];
```

---

## 11. Testing Guidelines

### 11.1 Unit Tests for Parsing

```typescript
// src/domain/agent/AgentOrchestrator.test.ts

describe('AgentOrchestrator.parseResponse', () => {
  it('should parse tool calls correctly', () => {
    const content = JSON.stringify({
      tool_calls: [
        {name: 'read_file', parameters: {file_path: 'test.ts'}}
      ]
    });

    const result = orchestrator['parseResponse'](content);

    expect(result.type).toBe('tool_calls');
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0].name).toBe('read_file');
  });

  it('should parse final response correctly', () => {
    const content = JSON.stringify({
      response: 'Task complete'
    });

    const result = orchestrator['parseResponse'](content);

    expect(result.type).toBe('response');
    expect(result.response).toBe('Task complete');
  });

  it('should reject mixed format', () => {
    const content = JSON.stringify({
      tool_calls: [{name: 'read_file', parameters: {}}],
      response: 'Also responding'
    });

    expect(() => orchestrator['parseResponse'](content)).toThrow();
  });

  it('should reject invalid JSON', () => {
    const content = 'not json';
    expect(() => orchestrator['parseResponse'](content)).toThrow();
  });
});
```

### 11.2 Integration Tests with Mock LLM

```typescript
describe('AgentOrchestrator integration', () => {
  it('should handle tool call -> response flow', async () => {
    const mockOllama = {
      call: vi.fn()
        .mockResolvedValueOnce({
          message: {
            content: JSON.stringify({
              tool_calls: [{name: 'read_file', parameters: {file_path: 'test.ts'}}]
            })
          }
        })
        .mockResolvedValueOnce({
          message: {
            content: JSON.stringify({
              response: 'File content is: ...'
            })
          }
        })
    };

    const orchestrator = new AgentOrchestrator(
      mockOllama,
      mockPlanManager,
      mockToolRegistry,
      mockMessageHistory,
      config
    );

    const result = await orchestrator.processMessage('Read test.ts', {});

    expect(result).toBe('File content is: ...');
    expect(mockOllama.call).toHaveBeenCalledTimes(2);
  });
});
```

### 11.3 Model Reliability Tests

Test with actual Ollama models to measure reliability:

```typescript
// tests/integration/model-reliability.test.ts

describe('Model reliability with Qwen 2.5 Coder', () => {
  const ollama = new OllamaClient();

  it('should return valid JSON 100% of the time', async () => {
    const iterations = 100;
    let successCount = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const response = await ollama.call({
          modelPrompt: models['qwen2.5-coder:7b'].prompt,
          agentMd: await fs.readFile('~/AGENTS.md', 'utf-8'),
          planDoc: 'Test plan',
          responseFormat: RESPONSE_FORMAT_SPEC,
          messageHistory: [],
          responseExamples: RESPONSE_EXAMPLES,
          model: 'qwen2.5-coder:7b'
        });

        JSON.parse(response.message.content); // Throws if invalid
        successCount++;
      } catch {
        // Count failures
      }
    }

    const reliability = (successCount / iterations) * 100;
    console.log(`Reliability: ${reliability}%`);

    expect(reliability).toBeGreaterThanOrEqual(95); // 95% minimum
  });
});
```

---

## 12. Troubleshooting

### 12.1 LLM Returns Invalid JSON

**Problem:** LLM response isn't valid JSON

**Solutions:**
1. Check temperature (should be ≤ 0.2 for JSON)
2. Verify `format: 'json'` is set in Ollama call
3. Add more examples to `responseExamples`
4. Simplify the prompt (too long = less reliable)

**Example fix:**
```typescript
const response = await this.ollama.call({
  ...params,
  options: {
    temperature: 0.1, // Even lower for unreliable models
  }
});
```

### 12.2 LLM Returns Wrong Structure

**Problem:** Valid JSON but wrong fields (e.g., `action` instead of `tool_calls`)

**Solutions:**
1. Add explicit counter-examples to response format:
   ```
   ❌ WRONG: {"action": "read_file", "args": {...}}
   ✅ CORRECT: {"tool_calls": [{"name": "read_file", "parameters": {...}}]}
   ```
2. Include more examples in `responseExamples`
3. Test with different model (Qwen 2.5 Coder 32B more reliable)

### 12.3 LLM Doesn't Call Tools

**Problem:** LLM always returns `{response: "..."}` instead of calling tools

**Solutions:**
1. Make tool descriptions more actionable:
   ```typescript
   // ❌ BAD
   description: 'Reads a file'

   // ✅ GOOD
   description: 'Read the complete contents of a file from the filesystem. Use this when you need to view file contents.'
   ```
2. Add explicit instruction to AGENTS.md:
   ```
   When the user asks you to perform an action (read, write, create, etc.), you MUST use tools. Do not describe what you would do - actually do it using tool_calls.
   ```

### 12.4 Context Too Long

**Problem:** Context exceeds model's window

**Solutions:**
1. Reduce message history (5 → 3 messages)
2. Truncate execution log (keep only last N entries)
3. Summarize older log entries
4. Switch to model with larger context (Llama 3.1: 128K tokens)

**Implementation:**
```typescript
// Truncate execution log to last 10 entries
const recentLog = plan.executionLog.slice(-10);
const planDoc = serializePlan({
  ...plan,
  executionLog: recentLog
});
```

### 12.5 Tool Batching Not Working

**Problem:** LLM calls tools sequentially instead of in parallel

**Solution:** Add explicit examples of batching:
```typescript
const batchExample = `# Example: Parallel tool execution
User: "Check all TypeScript files in src/"
Assistant: {
  "tool_calls": [
    {"name": "read_file", "parameters": {"file_path": "src/index.ts"}},
    {"name": "read_file", "parameters": {"file_path": "src/server.ts"}},
    {"name": "read_file", "parameters": {"file_path": "src/routes.ts"}}
  ]
}

Note: All three files are read in PARALLEL (one iteration), not sequentially (three iterations).`;

responseExamples.push(batchExample);
```

---

**End of PROMPTS.md**

*This is a living document. Update as prompt strategies evolve.*
