import { ExecutionContext, StructuredAIOutput } from './execution-context'
import { CommandExecutor } from '../services/commandExecutor'

export class StepExecutor {
  private commandExecutor: any
  private effectiveDeepSeekApiKey?: string

  constructor(private env: any, effectiveDeepSeekApiKey?: string) {
    this.effectiveDeepSeekApiKey = effectiveDeepSeekApiKey
    this.commandExecutor = new CommandExecutor({
      env: this.env,
      db: this.env.FLOW_RUNS_DB,
      maxRetries: 3,
      timeoutMs: 10000,
      baseUrl: 'https://deepseek-agent.alghamdimo89.workers.dev'
    })
  }

  async executeStep(
    context: ExecutionContext,
    step: any,
    agent: string
  ): Promise<ExecutionContext> {

    const prompt = `${context.ai_input}`

    const raw = await this.runAgent(agent, prompt)

    const parsed = this.parseAIOutput(raw)

    context.ai_output = parsed
    context.ai_timestamp = Date.now()

    // Execute commands from AI actions
    if (parsed.actions && Array.isArray(parsed.actions)) {
      for (const action of parsed.actions) {

        if (action.type === 'command') {
          try {
            const result = await this.commandExecutor.executeCommand(
              action.name,
              action.params || {}
            )

            context.command_results.push({
              name: action.name,
              params: action.params || {},
              result,
              success: true,
              timestamp: Date.now()
            })

            context.command_count++

          } catch (error: any) {
            context.command_results.push({
              name: action.name,
              params: action.params || {},
              result: null,
              error: error.message || 'Command failed',
              success: false,
              timestamp: Date.now()
            })

            context.command_count++
          }
        } else if (action.type === 'await_input') {
          // Set awaiting_input in context to signal pause
          context.awaiting_input = {
            name: action.name,
            params: action.params || {}
          };
          console.log(`[StepExecutor] Set awaiting_input: ${action.name}`);
        }
        // Other action types can be handled here
      }
    }

    context.step_id = step.id
    context.step_count++

    return context
  }

  private async callDeepSeek(messages: any[]): Promise<string> {
    const { callDeepSeek } = await import('../services/deepseek');
    
    // Use effectiveDeepSeekApiKey if provided, otherwise use env.DEEPSEEK_API_KEY
    const apiKey = this.effectiveDeepSeekApiKey || this.env.DEEPSEEK_API_KEY;
    
    console.log("DS CALL", {
      key: apiKey?.slice(0,5),
      path: "StepExecutor.runAgent"
    });
    
    const result = await callDeepSeek(apiKey, messages);
    
    if (!result.success) {
      throw new Error(`DeepSeek failed: ${result.error}`);
    }
    
    return result.response;
  }

  private async callOpenHands(input: string): Promise<string> {
    const { createOpenHandsConversation } = await import('../services/openhands');
    
    if (!this.env.OPENHANDS_API_URL) {
      throw new Error('OpenHands agent requested but OPENHANDS_API_URL not configured');
    }
    
    const result = await createOpenHandsConversation(
      this.env.OPENHANDS_API_URL,
      input,
      'default', // repository
      undefined // branch
    );
    
    if (!result.success) {
      throw new Error(`OpenHands failed: ${result.error}`);
    }
    
    return result.conversationId;
  }

  private async runAgent(agent: string, prompt: string): Promise<string> {
    if (agent === 'deepseek') {
      const messages = [
        {
          role: 'system',
          content: `You are an AI assistant with access to backend commands.
Available commands: GET /api/commands
To execute a command:
1. Check /api/commands/:name for parameter schema
2. Use the format: [COMMAND:command_name] params: {JSON_parameters}
3. The system will execute the command and return results
4. Use the response in your work

Command Format Examples:
- [COMMAND:get_tasks] params: {"status": "pending"}
- [COMMAND:create_task] params: {"title": "Fix bug", "description": "Fix the critical bug"}
- [COMMAND:get_flow_definitions] params: {}

Common commands:
- create_task: Create a new task
- get_tasks: Get all tasks
- create_flow_step: Create a flow step
- get_flow_definitions: Get flow definitions
- start_conversation: Start a new conversation

You can discover all available commands at /api/commands`
        },
        { role: 'user', content: prompt }
      ];
      return await this.callDeepSeek(messages)
    }

    if (agent === 'openhands') {
      return await this.callOpenHands(prompt)
    }

    if (agent === 'both') {
      const messages = [
        {
          role: 'system',
          content: `You are an AI assistant with access to backend commands.
Available commands: GET /api/commands
To execute a command:
1. Check /api/commands/:name for parameter schema
2. Use the format: [COMMAND:command_name] params: {JSON_parameters}
3. The system will execute the command and return results
4. Use the response in your work

Command Format Examples:
- [COMMAND:get_tasks] params: {"status": "pending"}
- [COMMAND:create_task] params: {"title": "Fix bug", "description": "Fix the critical bug"}
- [COMMAND:get_flow_definitions] params: {}

Common commands:
- create_task: Create a new task
- get_tasks: Get all tasks
- create_flow_step: Create a flow step
- get_flow_definitions: Get flow definitions
- start_conversation: Start a new conversation

You can discover all available commands at /api/commands`
        },
        { role: 'user', content: prompt }
      ];
      const deepseek = await this.callDeepSeek(messages)
      return this.callOpenHands(deepseek)
    }

    throw new Error(`Unknown agent: ${agent}`)
  }

  private parseAIOutput(raw: string): StructuredAIOutput {
    try {
      const parsed = JSON.parse(raw)
      return parsed
    } catch {
      return {
        response: raw,
        intent: 'unknown',
        actions: [],
        metadata: { parsing_failed: true }
      }
    }
  }
}