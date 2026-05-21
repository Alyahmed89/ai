import { RuleIR, Predicate, PredArg, DBRule, ResolvedPredicateMapping } from './RuleIR';

// ===================================================================
// buildRuleIR — transform raw DB rules into canonical RuleIR[]
// ===================================================================
export function buildRuleIR(rules: DBRule[]): RuleIR[] {
  return rules.map(buildSingleRuleIR);
}

function buildSingleRuleIR(rule: DBRule): RuleIR {
  const ns = rule.namespace as RuleIR['namespace'];
  const content = (rule.content || '').trim();

  // Per-namespace handlers — each returns partial IR or null to skip
  type HandlerResult = {
    head: Predicate | null;
    body: Predicate[];
    is_fact: boolean;
    is_directive: boolean;
    dependency_refs: string[];
    provides: string[];
  } | null;

  const handler = ((): HandlerResult => {
    switch (ns) {
      case 'predicate_mapping':
        return parsePredicateMappingContent(content);
      case 'fact':
        return parseFactContent(content);
      case 'clause':
        return parseClauseContent(content);
      case 'routing':
        return parseRoutingContent(content);
      case 'tracking':
        return null; // excluded from compilation
      default:
        return parseGenericContent(content);
    }
  })();

  let head: Predicate | null = null;
  let body: Predicate[] = [];
  let is_fact = false;
  let is_directive = false;
  const dependency_refs: string[] = [];
  const provides: string[] = [];
  let excluded_from_compilation = false;

  if (handler) {
    head = handler.head;
    body = handler.body;
    is_fact = handler.is_fact;
    is_directive = handler.is_directive;
    dependency_refs.push(...handler.dependency_refs);
    provides.push(...handler.provides);
  }

  if (ns === 'tracking') excluded_from_compilation = true;

  return {
    rule_id: rule.rule_id, namespace: ns, priority: rule.priority || 0,
    name: rule.name || '', head, body, is_fact, is_directive,
    metadata: {
      is_active: rule.is_active !== false,
      is_non_negotiable: rule.is_non_negotiable || false,
      rule_group: rule.rule_group || null, version: rule.version || 1,
      effective_from: rule.effective_from || null,
      effective_to: rule.effective_to || null,
      context: rule.context || null, rule_status: rule.rule_status || null,
    },
    dependency_refs, provides, source_content: content,
    excluded_from_compilation,
  };
}

/** Parse a predicate_mapping rule (JSON → runtime_predicate bridge). */
function parsePredicateMappingContent(content: string): { head: Predicate | null; body: Predicate[]; is_fact: boolean; is_directive: boolean; dependency_refs: string[]; provides: string[] } {
  try {
    const pm = JSON.parse(content);
    const predName = pm.predicate || 'unknown';
    const fieldName = pm.field || 'unknown';
    const head: Predicate = {
      name: 'runtime_predicate', arity: 3,
      args: [
        { type: 'string', value: predName, prolog_repr: `'${predName}'` },
        { type: 'variable', value: 'SR', prolog_repr: 'SR' },
        { type: 'variable', value: 'Value', prolog_repr: 'Value' },
      ],
      is_dynamic: true,
    };
    const body: Predicate[] = [{
      name: 'step_output', arity: 3,
      args: [
        { type: 'variable', value: 'SR', prolog_repr: 'SR' },
        { type: 'string', value: fieldName, prolog_repr: `'${fieldName}'` },
        { type: 'variable', value: 'Value', prolog_repr: 'Value' },
      ],
      is_dynamic: false,
    }];
    return { head, body, is_fact: false, is_directive: false, dependency_refs: ['step_output'], provides: ['runtime_predicate'] };
  } catch {
    return { head: null, body: [], is_fact: false, is_directive: false, dependency_refs: [], provides: [] };
  }
}

/** Parse a fact rule (simple prolog fact ending with .). */
function parseFactContent(content: string): { head: Predicate | null; body: Predicate[]; is_fact: boolean; is_directive: boolean; dependency_refs: string[]; provides: string[] } {
  const cleaned = content.replace(/\.$/, '');
  const head = parsePrologHead(cleaned);
  const provides = head ? [head.name] : [];
  return { head, body: [], is_fact: true, is_directive: false, dependency_refs: [], provides };
}

/** Parse a clause rule (head :- body1, body2, ...). */
function parseClauseContent(content: string): { head: Predicate | null; body: Predicate[]; is_fact: boolean; is_directive: boolean; dependency_refs: string[]; provides: string[] } {
  const cleaned = content.replace(/\.$/, '');
  const parts = splitHeadBody(cleaned);
  const head = parsePrologHead(parts.head);
  const body = parts.body ? parsePrologBody(parts.body) : [];
  const provides: string[] = [];
  const dependency_refs: string[] = [];
  if (head) provides.push(head.name);
  for (const p of body) {
    if (!dependency_refs.includes(p.name)) dependency_refs.push(p.name);
  }
  return { head, body, is_fact: false, is_directive: false, dependency_refs, provides };
}

/** Parse a routing rule (same structure as clause, but semantic meaning differs). */
function parseRoutingContent(content: string): { head: Predicate | null; body: Predicate[]; is_fact: boolean; is_directive: boolean; dependency_refs: string[]; provides: string[] } {
  const cleaned = content.replace(/\.$/, '');
  if (!cleaned.includes(':-')) {
    const head = parsePrologHead(cleaned);
    const provides = head ? [head.name] : [];
    return { head, body: [], is_fact: true, is_directive: false, dependency_refs: [], provides };
  }
  const parts = splitHeadBody(cleaned);
  const head = parsePrologHead(parts.head);
  const body = parts.body ? parsePrologBody(parts.body) : [];
  const provides: string[] = [];
  const dependency_refs: string[] = [];
  if (head) provides.push(head.name);
  for (const p of body) {
    if (!dependency_refs.includes(p.name)) dependency_refs.push(p.name);
  }
  return { head, body, is_fact: false, is_directive: false, dependency_refs, provides };
}

/** Parse any rule where we don't know the namespace (generic fallback). */
function parseGenericContent(content: string): { head: Predicate | null; body: Predicate[]; is_fact: boolean; is_directive: boolean; dependency_refs: string[]; provides: string[] } {
  if (content.startsWith(':-')) {
    return { head: null, body: [], is_fact: false, is_directive: true, dependency_refs: [], provides: [] };
  }
  const cleaned = content.replace(/\.$/, '');
  if (!content.includes(':-')) {
    const head = parsePrologHead(cleaned);
    const provides = head ? [head.name] : [];
    return { head, body: [], is_fact: true, is_directive: false, dependency_refs: [], provides };
  }
  const parts = splitHeadBody(cleaned);
  const head = parsePrologHead(parts.head);
  const body = parts.body ? parsePrologBody(parts.body) : [];
  const provides: string[] = [];
  const dependency_refs: string[] = [];
  if (head) provides.push(head.name);
  for (const p of body) {
    if (!dependency_refs.includes(p.name)) dependency_refs.push(p.name);
  }
  return { head, body, is_fact: false, is_directive: false, dependency_refs, provides };
}

// ===================================================================
// Predicate parsing helpers
// ===================================================================
function splitHeadBody(text: string): { head: string; body: string | null } {
  const idx = text.indexOf(':-');
  if (idx === -1) return { head: text.trim(), body: null };
  return {
    head: text.substring(0, idx).trim(),
    body: text.substring(idx + 2).trim(),
  };
}

function parsePrologHead(text: string): Predicate | null {
  text = text.trim();
  if (!text) return null;
  const parenIdx = text.indexOf('(');
  if (parenIdx === -1) {
    return { name: text, arity: 0, args: [], is_dynamic: false };
  }
  const name = text.substring(0, parenIdx).trim();
  const argsStr = text.substring(parenIdx + 1, text.lastIndexOf(')'));
  const args = parsePrologArgs(argsStr);
  return { name, arity: args.length, args, is_dynamic: false };
}

function parsePrologBody(text: string): Predicate[] {
  const predicates: Predicate[] = [];
  let depth = 0, current = '';
  for (const ch of text) {
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth--; current += ch; }
    else if (ch === ',' && depth === 0) {
      const p = parseOnePred(current.trim());
      if (p) predicates.push(p);
      current = '';
    } else { current += ch; }
  }
  if (current.trim()) {
    const p = parseOnePred(current.trim());
    if (p) predicates.push(p);
  }
  return predicates;
}

function parseOnePred(text: string): Predicate | null {
  const idx = text.indexOf('(');
  if (idx === -1) return null;
  return {
    name: text.substring(0, idx).trim(), arity: 0,
    args: parsePrologArgs(text.substring(idx + 1, text.lastIndexOf(')'))),
    is_dynamic: false,
  };
}

function parsePrologArgs(text: string): PredArg[] {
  text = text.trim();
  if (!text) return [];
  const args: PredArg[] = [];
  let depth = 0, current = '';
  for (const ch of text) {
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth--; current += ch; }
    else if (ch === ',' && depth === 0) {
      args.push(classifyArg(current.trim()));
      current = '';
    } else { current += ch; }
  }
  if (current.trim()) args.push(classifyArg(current.trim()));
  return args;
}

function classifyArg(text: string): PredArg {
  text = text.trim();
  if (text === '_') {
    return { type: 'wildcard', value: '_', prolog_repr: '_' };
  }
  if (/^[A-Z_]/.test(text)) {
    return { type: 'variable', value: text, prolog_repr: text };
  }
  if (/^\d+$/.test(text)) {
    return { type: 'integer', value: parseInt(text, 10), prolog_repr: text };
  }
  if (/^'/.test(text)) {
    return { type: 'string', value: text.replace(/^['"]|['"]$/g, ''), prolog_repr: text };
  }
  return { type: 'constant', value: text, prolog_repr: text };
}

// ===================================================================
// Pipeline stages
// ===================================================================

// Stage 1: ActivationFilter
export function activationFilter(irs: RuleIR[]): RuleIR[] {
  const now = new Date().toISOString();
  return irs.filter((ir) => {
    if (ir.excluded_from_compilation) return false;
    if (!ir.metadata.is_active) return false;
    if (ir.metadata.rule_status && ir.metadata.rule_status !== 'active') return false;
    if (ir.metadata.effective_from && ir.metadata.effective_from > now) return false;
    if (ir.metadata.effective_to && ir.metadata.effective_to < now) return false;
    return true;
  });
}

// Stage 2: PredicateMapper
export function predicateMapper(irs: RuleIR[]): { bridgeRules: string[]; mappings: ResolvedPredicateMapping[] } {
  const bridgeRules: string[] = [];
  const mappings: ResolvedPredicateMapping[] = [];
  const seen = new Set<string>();
  const pmIrs = irs.filter((ir) => ir.namespace === 'predicate_mapping');
  pmIrs.sort((a, b) => b.priority - a.priority);

  for (const ir of pmIrs) {
    if (!ir.head || ir.body.length === 0) continue;
    const fieldArg = ir.body[0]?.args?.[1];
    const predArg = ir.head.args?.[0];
    if (!fieldArg || !predArg) continue;
    const field = fieldArg.value;
    const predName = predArg.value;
    const key = `${field}->${predName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const bodyArg = ir.body[0].args[2];
    const bodyRepr = bodyArg ? bodyArg.prolog_repr : 'Value';
    bridgeRules.push(
      `% Predicate mapping: ${field} -> ${predName} (priority=${ir.priority})\n` +
      `runtime_predicate('${predName}', SR, ${bodyRepr}) :-\n` +
      `    step_output(SR, '${field}', ${bodyRepr}).`
    );
    mappings.push({ field, predicate: predName, priority: ir.priority });
  }
  return { bridgeRules, mappings };
}

// Stage 3: FactBuilder
export function factBuilder(irs: RuleIR[]): { factRules: string[]; deduplicated: number } {
  const factIrs = irs.filter((ir) => ir.namespace === 'fact' && ir.is_fact);
  factIrs.sort((a, b) => b.priority - a.priority || a.rule_id.localeCompare(b.rule_id));
  const seen = new Set<string>();
  const factRules: string[] = [];
  let deduplicated = 0;
  for (const ir of factIrs) {
    const c = ir.source_content;
    if (seen.has(c)) { deduplicated++; continue; }
    seen.add(c);
    factRules.push(`% Priority=${ir.priority} | rule_id=${ir.rule_id}\n${c}`);
  }
  return { factRules, deduplicated };
}

// Stage 4: ClauseResolver
export function clauseResolver(
  irs: RuleIR[], mappings: ResolvedPredicateMapping[]
): { clauseRules: string[]; warnings: string[] } {
  const clauseIrs = irs.filter((ir) => ir.namespace === 'clause' && !ir.is_directive);
  clauseIrs.sort((a, b) => b.priority - a.priority || a.rule_id.localeCompare(b.rule_id));
  const clauseRules: string[] = [];
  const warnings: string[] = [];
  for (const ir of clauseIrs) {
    for (const p of ir.body) {
      if (p.name === 'runtime_predicate') {
        const predArg = p.args?.[0];
        if (predArg && predArg.type === 'string') {
          if (!mappings.some((m) => m.predicate === predArg.value)) {
            warnings.push(`Clause ${ir.rule_id} refs runtime_predicate('${predArg.value}') but no mapping exists`);
          }
        }
      }
    }
    clauseRules.push(`% Priority=${ir.priority} | rule_id=${ir.rule_id}\n${ir.source_content}`);
  }
  return { clauseRules, warnings };
}

// Stage 5: RoutingSorter
export function routingSorter(irs: RuleIR[]): { routingRules: string[] } {
  const routingIrs = irs.filter((ir) => ir.namespace === 'routing');
  routingIrs.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.body.length !== a.body.length) return b.body.length - a.body.length;
    return a.rule_id.localeCompare(b.rule_id);
  });
  const routingRules = routingIrs.map((ir) =>
    `% Priority=${ir.priority} | specificity=${ir.body.length} | rule_id=${ir.rule_id}\n${ir.source_content}`
  );
  return { routingRules };
}

// Stage 6: ConflictResolver
export function conflictResolver(
  irs: RuleIR[], routingRules: string[]
): { rules: string[]; conflicts: string[] } {
  const routingIrs = irs.filter((ir) => ir.namespace === 'routing');
  const conflicts: string[] = [];
  const groups = new Map<string, RuleIR[]>();
  for (const ir of routingIrs) {
    const sig = ir.body.map((p) => `${p.name}/${p.arity}`).sort().join(',');
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig)!.push(ir);
  }
  const excludedIds = new Set<string>();
  for (const [sig, group] of groups) {
    if (group.length < 2) continue;
    const targets = new Set(group.map((ir) => {
      if (ir.head && ir.head.args.length > 0) {
        const a = ir.head.args[ir.head.args.length - 1];
        return a.type === 'string' ? a.value : a.prolog_repr;
      }
      return 'unknown';
    }));
    if (targets.size < 2) continue;
    const maxPrio = Math.max(...group.map((ir) => ir.priority));
    const topPrio = group.filter((ir) => ir.priority === maxPrio);
    if (topPrio.length === 1) {
      for (const ir of group) { if (ir.priority < maxPrio) excludedIds.add(ir.rule_id); }
      conflicts.push(`Conflict resolved: conditions=[${sig}], kept ${topPrio[0].rule_id} (p=${maxPrio})`);
    } else {
      for (const ir of group) excludedIds.add(ir.rule_id);
      conflicts.push(`Unresolved conflict: conditions=[${sig}], targets=${Array.from(targets).join(',')}, all p=${maxPrio} - EXCLUDED`);
    }
  }
  const filtered = routingRules.filter((r) => {
    for (const id of excludedIds) { if (r.includes(`rule_id=${id}`)) return false; }
    return true;
  });
  return { rules: filtered, conflicts };
}

// ===================================================================
// compileRuleProgram — IR -> deterministic Prolog program
// ===================================================================
export function compileRuleProgram(irs: RuleIR[]): string {
  const active = activationFilter(irs);
  const { bridgeRules, mappings } = predicateMapper(active);
  const { factRules } = factBuilder(active);
  const { clauseRules } = clauseResolver(active, mappings);
  const { routingRules } = routingSorter(active);
  const { rules: cleanRouting } = conflictResolver(active, routingRules);

  const sections: string[] = [];

  // Section 1
  sections.push([
    '%% ============================================================',
    '%% SECTION 1: SYSTEM DECLARATIONS',
    '%% ============================================================',
    ':- multifile sandbox:safe_primitive/1.',
    "sandbox:safe_primitive(shell(_)) :- fail.",
    "sandbox:safe_primitive(open(_,_,_)) :- fail.",
    "sandbox:safe_primitive(consult(_)) :- fail.",
    "sandbox:safe_primitive(load_files(_)) :- fail.",
    "sandbox:safe_primitive(exec(_)) :- fail.",
    ':- set_prolog_flag(toplevel_timeout, 10000).',
    ':- set_prolog_flag(unknown, fail).',
    ':- dynamic step_output/3.',
    ':- dynamic json_path/3.',
    ':- dynamic json_array_item/4.',
    ':- dynamic runtime_predicate/3.',
    ':- dynamic rule_fired/2.',
  ].join('\n'));

  // Section 2
  if (bridgeRules.length > 0) {
    sections.push([
      '\n%% ============================================================',
      '%% SECTION 2: PREDICATE BRIDGE LAYER',
      '%% ============================================================',
      bridgeRules.join('\n\n'),
    ].join('\n'));
  }

  // Section 3
  if (factRules.length > 0) {
    sections.push([
      '\n%% ============================================================',
      '%% SECTION 3: FACTS',
      '%% ============================================================',
      factRules.join('\n\n'),
    ].join('\n'));
  }

  // Section 4
  if (clauseRules.length > 0) {
    sections.push([
      '\n%% ============================================================',
      '%% SECTION 4: CLAUSES',
      '%% ============================================================',
      clauseRules.join('\n\n'),
    ].join('\n'));
  }

  // Section 5
  if (cleanRouting.length > 0) {
    sections.push([
      '\n%% ============================================================',
      '%% SECTION 5: ROUTING RULES',
      '%% ============================================================',
      cleanRouting.join('\n\n'),
    ].join('\n'));
  }

  // Section 6
  sections.push([
    '\n%% ============================================================',
    '%% SECTION 6: FALLBACK RULE',
    '%% ============================================================',
    "next_step(StepRunId, '__fallback__') :-",
    '    no_route_found(StepRunId).',
  ].join('\n'));

  return sections.join('\n');
}
