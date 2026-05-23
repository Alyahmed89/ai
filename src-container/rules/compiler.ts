/**
 * compileProgram — takes knowledge rows, returns Prolog program string.
 * No RuleIR. No namespace branching. Just concatenate clause prolog
 * with system declarations.
 */

export function compileProgram(clauses: any[]): string {
  const contents = (clauses || [])
    .map(c => c.prolog)
    .filter(Boolean);

  const sections: string[] = [];

  sections.push([
    '%% ============================================================',
    '%% SYSTEM DECLARATIONS',
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

  if (contents.length > 0) {
    sections.push([
      '',
      '%% ============================================================',
      '%% CLAUSES',
      '%% ============================================================',
      ...contents,
    ].join('\n'));
  }

  return sections.join('\n');
}
