import { ExecutionContext } from './execution-context'

export type ConditionOperator =
  | 'equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'exists'
  | 'matches'
  | 'in'

export type Condition = {
  source: string
  operator: ConditionOperator
  value?: any
}

export class ConditionEvaluator {

  evaluate(condition: Condition, context: ExecutionContext): boolean {
    try {
      // Log before evaluation
      console.log(JSON.stringify({
        feature: "conditions",
        step: "before_condition_evaluation",
        data: {
          condition_source: condition.source,
          condition_operator: condition.operator,
          condition_value: condition.value,
          context_summary: this._summarizeContext(context)
        }
      }));

      const actual = this.resolveSource(condition.source, context)
      
      let result: boolean;
      
      switch (condition.operator) {
        case 'equals':
          result = actual === condition.value
          break

        case 'contains':
          if (Array.isArray(actual)) result = actual.includes(condition.value)
          else if (typeof actual === 'string') result = actual.includes(condition.value)
          else result = false
          break

        case 'greater_than':
          result = Number(actual) > Number(condition.value)
          break

        case 'less_than':
          result = Number(actual) < Number(condition.value)
          break

        case 'exists':
          result = actual !== undefined && actual !== null
          break

        case 'matches':
          try {
            result = new RegExp(condition.value).test(String(actual))
          } catch (regexError: any) {
            console.log(JSON.stringify({
              feature: "conditions",
              step: "condition_error",
              data: {
                condition_source: condition.source,
                condition_operator: condition.operator,
                condition_value: condition.value,
                actual_value: actual,
                error: regexError.message,
                context_summary: this._summarizeContext(context)
              }
            }));
            result = false
          }
          break

        case 'in':
          result = Array.isArray(condition.value) && condition.value.includes(actual)
          break

        default:
          result = false
      }

      // Log after evaluation
      console.log(JSON.stringify({
        feature: "conditions",
        step: "after_condition_evaluation",
        data: {
          condition_source: condition.source,
          condition_operator: condition.operator,
          condition_value: condition.value,
          actual_value: actual,
          result: result,
          context_summary: this._summarizeContext(context)
        }
      }));

      return result
    } catch (error: any) {
      // Log error
      console.log(JSON.stringify({
        feature: "conditions",
        step: "condition_error",
        data: {
          condition_source: condition.source,
          condition_operator: condition.operator,
          condition_value: condition.value,
          error: error.message,
          context_summary: this._summarizeContext(context)
        }
      }));
      return false
    }
  }

  private _summarizeContext(context: ExecutionContext): any {
    if (!context) return {};
    
    return {
      flow_id: context.flow_id,
      step_id: context.step_id,
      has_ai_output: !!context.ai_output,
      has_command_results: context.command_results?.length || 0,
      variables_count: Object.keys(context.variables || {}).length,
      data_entries_count: context.data?.size || 0
    };
  }

  private resolveSource(path: string, context: ExecutionContext): any {

    const parts = path.split('.')

    // ai_output.*
    if (parts[0] === 'ai_output') {
      return this.getNested(context.ai_output, parts.slice(1))
    }

    // command_results.last.*
    if (parts[0] === 'command_results' && parts[1] === 'last') {
      const last = context.command_results[context.command_results.length - 1]
      return this.getNested(last, parts.slice(2))
    }

    // command_results.{index}.*
    if (parts[0] === 'command_results' && !isNaN(parseInt(parts[1]))) {
      const index = parseInt(parts[1])
      const cmd = context.command_results[index]
      return this.getNested(cmd, parts.slice(2))
    }

    // command_results.{name}.*
    if (parts[0] === 'command_results') {
      const name = parts[1]
      const cmd = context.command_results.find(c => c.name === name)
      return this.getNested(cmd, parts.slice(2))
    }

    // data.*
    if (parts[0] === 'data') {
      const entry = context.data.get(parts[1])
      return entry?.value
    }

    // variables.*
    if (parts[0] === 'variables') {
      const variable = context.variables[parts[1]];
      // Handle both raw values and ContextValue objects
      if (variable && typeof variable === 'object' && 'value' in variable) {
        return variable.value;
      }
      return variable;
    }

    // state.*
    if (parts[0] === 'state') {
      return (context as any)[parts[1]]
    }

    return undefined
  }

  private getNested(obj: any, path: string[]): any {
    return path.reduce((acc, key) => acc?.[key], obj)
  }
}