-- Migration 0013: Add etaflow definition to flows table
-- Flow: etaflow
-- Repository: eta/fix-eta-template-syntax

INSERT OR IGNORE INTO flows (
  id, name, first_prompt, deepseek_system, repo, branch, max_iterations, steps, created_at
) VALUES (
  'etaflow',
  'Eta Template Syntax Fix Flow',
  'Execute etaflow to fix template syntax issues in the eta repository',
  'You are an Eta template syntax expert. Your task is to fix template syntax issues in the eta repository. Follow the flow steps precisely to review payload, validate templates, generate app, test deployment, and fix any issues found.',
  'eta/fix-eta-template-syntax',
  'fix-eta-template-syntax',
  50,
  '[]', -- Steps are in flow_steps table
  strftime('%s', 'now')
);