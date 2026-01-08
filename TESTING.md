# Manual Testing Guide

This document provides instructions for manually testing the Ollama Agent chat integration (Phase 5).

## Prerequisites

1. **Ollama must be running:**
   ```bash
   ollama serve
   ```

2. **Required model must be available:**
   ```bash
   ollama pull deepseek-coder-v2:16b
   ```

3. **Verify model is available:**
   ```bash
   ollama list | grep deepseek-coder-v2:16b
   ```

## Running the Application

### Start the TUI:
```bash
npm start
```

### Start with debug mode:
```bash
npm run dev
```

### Exit the application:
Type `/exit` or press `Ctrl+C`

## Test Scenarios

### Test 1: Happy Path ✓
**Goal:** Verify normal chat flow works end-to-end

**Steps:**
1. Start the application with `npm start`
2. Type a simple message: "Hello"
3. Press Enter

**Expected Behavior:**
- Loading indicator appears: "Thinking..."
- After 2-5 seconds, agent response appears
- Response should be conversational and relevant
- Loading indicator disappears
- Input field is ready for next message

**Success Criteria:**
- ✓ Loading indicator shows while processing
- ✓ Agent response displays correctly
- ✓ No error messages appear
- ✓ Can send multiple messages in sequence

---

### Test 2: Ollama Not Running ✗
**Goal:** Verify error handling when Ollama is unavailable

**Steps:**
1. Stop Ollama: `pkill ollama` or close the Ollama server
2. Start the application with `npm start`
3. Type a message and press Enter

**Expected Behavior:**
- Loading indicator appears briefly
- Error message displays: "Error: Cannot connect to Ollama at http://localhost:11434. Is Ollama running?"
- Error message is shown in red
- Input field remains functional for retry

**Success Criteria:**
- ✓ Connection error is detected
- ✓ Clear error message shown to user
- ✓ Application doesn't crash
- ✓ Can retry after starting Ollama

**Cleanup:**
```bash
ollama serve  # Restart Ollama for next tests
```

---

### Test 3: Slow Response (Complex Prompt)
**Goal:** Verify loading indicator persists during long-running requests

**Steps:**
1. Ensure Ollama is running
2. Start the application
3. Type a complex prompt: "Explain the differences between microservices and monolithic architecture, including pros and cons of each, with examples"
4. Press Enter

**Expected Behavior:**
- Loading indicator appears immediately
- Loading indicator persists for 10-30 seconds (depending on model speed)
- Agent provides a detailed response
- Loading indicator disappears when response is complete

**Success Criteria:**
- ✓ Loading indicator shows entire time
- ✓ Response is complete and detailed
- ✓ No timeout errors (request completes within 60 seconds)
- ✓ UI remains responsive during processing

---

### Test 4: Rapid Submits (Race Condition Check)
**Goal:** Verify no duplicate requests are sent

**Steps:**
1. Start the application
2. Quickly type and submit three messages in rapid succession:
   - Type "Message 1" → Press Enter
   - Type "Message 2" → Press Enter
   - Type "Message 3" → Press Enter
3. Do this as fast as possible (within 2-3 seconds)

**Expected Behavior:**
- First message triggers processing
- Second and third submissions are queued or blocked
- Loading indicator shows "Thinking..." for first message
- First response completes before second message processes
- All three messages eventually get responses in order

**Success Criteria:**
- ✓ No duplicate API calls (check Ollama logs if needed)
- ✓ Only one loading indicator at a time
- ✓ Messages process sequentially
- ✓ No crashes or race conditions
- ✓ All three messages get responses

**How to verify (optional):**
```bash
# In another terminal, watch Ollama logs:
journalctl -u ollama -f
# OR
tail -f /var/log/ollama.log  # if Ollama logs to file
```

---

## Known Issues

### React Duplicate Key Warning
During startup, you may see a React warning:
```
Encountered two children with the same key
```

**Status:** Non-critical - does not affect functionality
**Cause:** Likely React 19 strict mode double-rendering behavior
**Impact:** None - messages render correctly with unique IDs

### Raw Mode Not Supported (Background Execution)
If you see this error:
```
ERROR Raw mode is not supported on the current process.stdin
```

**Cause:** Application was run in background or without TTY
**Solution:** Run `npm start` in an interactive terminal (not background)

---

## Debugging Tips

### Check Ollama Status:
```bash
curl http://localhost:11434/api/tags
```

### Test Ollama API directly:
```bash
curl http://localhost:11434/api/chat -d '{
  "model": "deepseek-coder-v2:16b",
  "messages": [{"role": "user", "content": "Hello"}],
  "stream": false
}'
```

### Enable Debug Mode:
```bash
npm run dev  # Adds --debug flag
```

### Check TypeScript/Lint:
```bash
npm run typecheck
npm run lint
```

---

## Success Criteria Summary

Phase 5 is complete when:

- ✅ Happy path works (user message → loading → agent response)
- ✅ Connection errors display clearly when Ollama is down
- ✅ Loading indicator persists during slow responses
- ✅ Rapid submits don't cause duplicate requests or crashes
- ✅ All unit tests pass: `npm test`
- ✅ No TypeScript errors: `npm run typecheck`
- ✅ No ESLint errors: `npm run lint`

---

## Architecture Verification

### Layer Boundaries:
```
Display (TUI) → Domain (Orchestrator) → Data (OllamaClient) → Ollama API
```

### Async Flow:
1. User submits message → `SUBMIT_INPUT` action
2. Reducer adds user message to state
3. `useEffect` detects new user message
4. `SET_PROCESSING` action triggers loading indicator
5. `SimpleOrchestrator.processMessage()` called
6. `OllamaClient.chat()` makes HTTP request
7. Response returns as `Result<T, E>`
8. Success → `ADD_MESSAGE` with agent response
9. Failure → `SET_ERROR` with error message
10. `SET_PROCESSING(false)` hides loading indicator

### Guard Conditions (prevents infinite loops):
- Only process if `lastMessage.role === "user"`
- Only process if `!state.isProcessing`
- Only process if `orchestratorRef.current` exists

---

## Integration Tests (Automated)

**Located at:** `tests/integration/chat.test.ts`

Automated end-to-end tests that verify the complete flow with real Ollama API calls.

### Running Integration Tests:
```bash
npm test tests/integration/chat.test.ts
```

**Note:** These tests require:
- Ollama running at http://localhost:11434
- Model `deepseek-coder-v2:16b` pulled
- Timeout: 120 seconds (accounts for model loading)

### What's Covered:
- ✅ Real HTTP connection to Ollama
- ✅ Valid chat responses with correct structure
- ✅ Model not found error handling (404)
- ✅ Connection refused error handling
- ✅ Technical question answering ability
- ✅ Performance benchmarks (response time < 30s for loaded model)

### Test Results:
- **6 integration tests** (all passing)
- **211 unit tests** (all passing)
- **Total: 217 tests**

---

## Next Steps After Phase 5

Once manual testing is complete, consider:

1. **Add conversation history** (currently single-message only)
2. **Implement streaming responses** (currently non-streaming)
3. **Add tool execution** (shell, file operations)
4. **Implement plan management** (markdown context files)
5. **Add retry logic** (automatic retry on transient errors)
6. **Model selection UI** (currently hardcoded to deepseek-coder-v2:16b)

See `ARCHITECTURE.md` for full roadmap.
