-- Migration 0014: Update etaflow repository to correct values
-- Fixes the repository from 'flow/execution' to 'eta/fix-eta-template-syntax'
-- and branch from 'main' to 'fix-eta-template-syntax'

UPDATE flows 
SET repo = 'eta/fix-eta-template-syntax', 
    branch = 'fix-eta-template-syntax',
    name = 'Eta Template Syntax Fix Flow',
    first_prompt = 'Execute etaflow to fix template syntax issues in the eta repository',
    deepseek_system = 'You are an Eta template syntax expert. Your task is to fix template syntax issues in the eta repository. Follow the flow steps precisely to review payload, validate templates, generate app, test deployment, and fix any issues found.',
    max_iterations = 50
WHERE id = 'etaflow';