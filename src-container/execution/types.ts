/**
 * Phase 4: Terms as Canonical Language — TypeScript interfaces.
 *
 * These are safe defaults for future expansion. All fields optional.
 * Engine code must tolerate missing fields gracefully.
 * No required migrations in runtime logic — backward compatible by design.
 *
 * Architecture:
 *   User Prompt → normalization → canonical symbolic terms → step contracts → execution
 *   AI never decides structure. Terms + contracts + rules decide structure.
 *   AI only fills constrained symbolic gaps.
 */

export interface TermSchema {
  id?: number;
  term_id?: string;
  name?: string;
  namespace?: string;
  content?: any;
  description?: string;
  created_at?: string;
  context?: string;
  entity_type?: string;
  entity_id?: string | null;
  version?: number;
  is_active?: boolean;

  // Future expansion fields (all optional, all tolerated when missing)
  aliases?: string[];
  refs?: string[];
  shell_commands?: string[];
  tools?: string[];
  examples?: any[];
  variables?: Record<string, string>;
  validations?: any[];
  rendering_hints?: Record<string, any>;
  flow_compatibility?: string[];
  task_compatibility?: string[];
  prolog_mappings?: Record<string, string>;
}

export interface StepContract {
  /** Variables that must be present in context before this step runs */
  required_inputs?: string[];
  /** Variable name aliases for canonical normalization */
  variable_aliases?: Record<string, string[]>;
}
