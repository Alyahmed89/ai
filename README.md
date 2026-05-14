# DeepSeek Agent — Engine

## Contract-Based Symbolic Execution Architecture

This engine enforces **deterministic symbolic execution** where AI output does NOT automatically become system state. Only declared outputs may persist.

### Core Principles
- **No implicit persistence** — Only `guaranteed_outputs`, `output_storage`, and engine-reserved keys are stored
- **No hallucination** — Missing `[[var:...]]` variables are left as-is, never invented
- **Contract-gated autoStore** — Recursive persistence allowed only when parent key is authorized
- **Pause/Resume** — Pause stops immediately, resume re-runs the SAME paused step (no order_index advance)

### Key Files
| File | Purpose |
|------|---------|
| `src/execution/engine.ts` | Core engine: resolveVariables, buildContext, autoStore, pro_check |
| `src/execution/types.ts` | Type definitions for steps, flows, contracts |

### Verified Behaviors
1. `resolveVariables()` — regex `[[var:key]]` replacement, leaves missing vars untouched
2. `autoStore()` — contract-gated persistence with recursive nesting for authorized keys
3. `pro_check` payload — includes `validation_errors`, `contract_failures`, `guaranteed_outputs`, `required_inputs`, `normalized_vars`
4. `buildContext()` — creates `memory.*` aliases for direct variable access

### Test Data Created (Prolog API)
- **Rules**: `step_creation_template` (10 `[[var:...]]`), `tasking_rule_sample` (13 `[[var:...]]`), `task_dependency_resolver`
- **Terms**: `step_creation`, `task_context`
- **Tasks**: 2 rows in `tasks` table (one with placeholders, one resolved)

### API Endpoints
- Prolog: `https://prolog.anyapp.cfd/api/v1`
- Supabase: `https://supabase.anyapp.cfd/rest/v1`
- App: `https://ai.anyapp.cfd/api`
