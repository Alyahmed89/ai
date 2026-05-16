# 1. OBJECTIVE

Fix two UI-only issues in the flow-run page:

1. **User bubble never shows optimistically** — When the user clicks send, their typed message should appear in the chat immediately, not wait for the next polling cycle.
2. **[[[var]]](/docs/en/guides/tools/var) variables not resolving in later steps** — `[[var:readable_version]]` and `[[var:prolog_content]]` appear as literal text in downstream steps because those variables are not in context when the step runs.

# 2. CONTEXT SUMMARY

## Component: `/workspace/project/ai/app/flow-run/[id]/page.tsx`

**Frontend (Next.js client component)** that displays a flow-run. Key pieces:

- `chatMessages` (lines 656-733): A **derived const** (not React state) computed from the `steps` array at render time. It builds user/assistant bubbles by iterating over sorted step runs and extracting `resolved_variables` (for user messages) and `ai_response` (for assistant messages).
- `handleSend()` (lines 828-871): Sends user input via POST to `/api/proxy/resume`, then calls `setInputs({})` and `setTimeout(fetchData, 500)`. The user bubble only appears after the next poll fetches a step run with `resolved_variables`.
- `chatMessages` is rendered in the Chat Mode section (lines 1012-1014) as `<ChatBubble>` components.
- The `steps` array is polled every 3 seconds via `fetchData()` (line 522).

### Engine: `/workspace/project/deepseek-agent/src/execution/engine.ts`

**This file does NOT exist in the current workspace.** The proxy route (`/workspace/project/ai/app/api/proxy/[...path]/route.ts`) forwards requests to `https://ai.anyapp.cfd` — the engine lives on a remote backend. The user's `engine.ts` path refers to a separate repository (`/workspace/project/deepseek-agent/`) that is not available in this workspace.

# 3. APPROACH OVERVIEW

## Issue 1 — Optimistic User Bubble (UI Agent)

Since `chatMessages` is a derived const (not state), we cannot push to it directly. The cleanest approach is:

1. Add a new `useState` called `optimisticMsgs` (an array of user bubbles).
2. In `handleSend()`, before the fetch call, push the user's typed input as an optimistic message.
3. In the render, prepend (or append) optimistic messages to the `chatMessages` array before rendering `<ChatBubble>`.
4. When `chatMessages` updates from the next poll, the optimistic messages will still be there — but they may become duplicates of what `chatMessages` shows. To avoid this, we clear `optimisticMsgs` when `steps` changes (i.e., when the poll returns new data), since the real message will then appear in `chatMessages`.

**Rationale:** Minimal change — no restructuring of chat logic, just add optimistic messages that are transient and get cleared on the next successful poll.

## Issue 2 — Variables Not Resolving (Engine Agent)

The engine code is **not available** in this workspace. The user needs to provide the engine.ts file or grant access to the repository containing it.

# 4. IMPLEMENTATION STEPS

## Issue 1 — UI Agent (page.tsx)

### Step 1: Add `optimisticMsgs` state

**Goal:** Add a state array to hold optimistic user bubbles that appear immediately on send.

**Method:** Add a new `useState` call alongside the existing state declarations (around line 418-426).

**Lines BEFORE (line 418-426):**
```tsx
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [chatMode, setChatMode] = useState(searchParams?.get('chatmode') !== '0')
  const [sending, setSending] = useState(false)
  const [events, setEvents] = useState<FlowEvent[]>([])
  const [context, setContext] = useState<FlowContext | null>(null)
  const [transientStatus, setTransientStatus] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
```

**Lines AFTER:**
```tsx
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [chatMode, setChatMode] = useState(searchParams?.get('chatmode') !== '0')
  const [sending, setSending] = useState(false)
  const [events, setEvents] = useState<FlowEvent[]>([])
  const [context, setContext] = useState<FlowContext | null>(null)
  const [transientStatus, setTransientStatus] = useState<string | null>(null)
  const [optimisticMsgs, setOptimisticMsgs] = useState<
    { role: 'user'; text: string; id: string }[]
  >([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
```

### Step 2: Push optimistic message in `handleSend()`

**Goal:** Immediately after reading the user's typed input and before any fetch call, push an optimistic user bubble.

**Method:** At the top of `handleSend()`, after `setSending(true)`, capture the typed text and add an optimistic message.

**Lines BEFORE (lines 828-831):**
```tsx
  const handleSend = async () => {
    setSending(true)
    try {
      if (steps.length === 0 && flowId) {
```

**Lines AFTER:**
```tsx
  const handleSend = async () => {
    setSending(true)
    const typedText = inputs[allRequiredVars[0]]?.trim()
    if (typedText) {
      setOptimisticMsgs((prev) => [
        ...prev,
        { role: 'user' as const, text: typedText, id: `optimistic-${Date.now()}` },
      ])
    }
    try {
      if (steps.length === 0 && flowId) {
```

### Step 3: Clear optimistic messages on poll refresh

**Goal:** When new step data arrives (i.e., `steps` changes from polling), clear the optimistic messages so they don't duplicate with the real messages now in `chatMessages`.

**Method:** Add a `useEffect` that resets `optimisticMsgs` when `steps` changes (after the poll succeeds).

Add after the existing useEffects (after line 806, the auto-scroll effect):

**Lines to add AFTER line 806:**
```tsx

  /** Clear optimistic messages when new step data arrives from polling */
  useEffect(() => {
    if (steps.length > 0) {
      setOptimisticMsgs([])
    }
  }, [steps])
```

### Step 4: Render optimistic messages in chat

**Goal:** Show the optimistic user bubbles alongside the derived `chatMessages` array.

**Method:** In the Chat Mode section, after rendering `chatMessages`, also render `optimisticMsgs`.

**Lines BEFORE (lines 1008-1029):**
```tsx
          <div ref={scrollContainerRef} className="space-y-4">
            {chatMessages.length === 0 && !transientStatus && (
              <p className="text-neutral-600 text-sm text-center py-12">no messages yet</p>
            )}
            {chatMessages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
            {/* Transient live status ... */}
```

**Lines AFTER:**
```tsx
          <div ref={scrollContainerRef} className="space-y-4">
            {chatMessages.length === 0 && optimisticMsgs.length === 0 && !transientStatus && (
              <p className="text-neutral-600 text-sm text-center py-12">no messages yet</p>
            )}
            {chatMessages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
            {optimisticMsgs.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
            {/* Transient live status ... */}
```

## Issue 2 — Engine Agent

**The file `/workspace/project/deepseek-agent/src/execution/engine.ts` does not exist in this workspace.** The backend is hosted externally (at `https://ai.anyapp.cfd`). To proceed with Issue 2 analysis, one of the following is needed:

1. **Provide the engine.ts file** — share its contents so I can analyze `buildContext()`, variable scoping, `resolveVariables()`, and `autoStore` mechanisms.
2. **Grant access to the deepseek-agent repository** — mount it or provide the path.
3. **Describe the engine's variable resolution mechanism** — explain how `ai_response` fields are stored as variables and passed between steps.

Without this, I cannot show the exact lines before/after for the engine fix.

# 5. TESTING AND VALIDATION

## Issue 1 — Optimistic User Bubble

1. **Manual test:** Open a flow-run page, type a message in the chat input, click "send". Observe that the user's message appears immediately as a chat bubble (right-aligned, neutral-100 background) without any delay.
2. **Polling verification:** After the 500ms `setTimeout(fetchData)` triggers and returns new step data, the optimistic message should be replaced by the real message from `resolved_variables` (no duplicates).
3. **Edge case — empty input:** If the user clicks send with an empty input, no optimistic bubble should appear.
4. **Edge case — rapid sends:** Two rapid sends should produce two distinct optimistic bubbles (different `id` values from `Date.now()`).
5. **Regression:** Chat scroll-to-bottom behavior, transient status, and debug mode should remain unchanged.

## Issue 2 — Variable Resolution

Verification depends on the engine. Once the fix is available:
1. Confirm that `[[var:readable_version]]` resolves to the actual value from "Translate prompt" step's `ai_response`.
2. Confirm that `[[var:prolog_content]]` resolves to its stored value.
3. Run the same flow that previously showed literal `[[var:readable_version]]` and verify it now shows the resolved text.
