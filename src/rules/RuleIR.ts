// RuleIR - Canonical Intermediate Representation for Prolog Rule Compiler

export interface RuleIR {
  rule_id: string;
  namespace: 'routing' | 'clause' | 'fact' | 'predicate_mapping' | 'tracking';
  priority: number;
  name: string;
  head: Predicate | null;
  body: Predicate[];
  is_fact: boolean;
  is_directive: boolean;
  metadata: {
    is_active: boolean;
    is_non_negotiable: boolean;
    rule_group: string | null;
    version: number;
    effective_from: string | null;
    effective_to: string | null;
    context: any;
    rule_status: string | null;
  };
  dependency_refs: string[];
  provides: string[];
  source_content: string;
  excluded_from_compilation: boolean;
}

export interface Predicate {
  name: string;
  arity: number;
  args: PredArg[];
  is_dynamic: boolean;
}

export interface PredArg {
  type: 'variable' | 'constant' | 'string' | 'integer' | 'compound' | 'wildcard';
  value: any;
  prolog_repr: string;
}

export interface ResolvedPredicateMapping {
  field: string;
  predicate: string;
  priority: number;
}

export interface DBRule {
  rule_id: string;
  name: string;
  namespace: string;
  content: string;
  priority: number;
  is_active: boolean;
  is_non_negotiable: boolean;
  rule_group: string | null;
  version: number;
  context: any;
  rule_status: string | null;
  effective_from: string | null;
  effective_to: string | null;
  created_at?: string;
  updated_at?: string;
  tags?: any;
}
