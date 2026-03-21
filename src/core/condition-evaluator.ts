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
    const actual = this.resolveSource(condition.source, context)

    switch (condition.operator) {
      case 'equals':
        return actual === condition.value

      case 'contains':
        if (Array.isArray(actual)) return actual.includes(condition.value)
        if (typeof actual === 'string') return actual.includes(condition.value)
        return false

      case 'greater_than':
        return Number(actual) > Number(condition.value)

      case 'less_than':
        return Number(actual) < Number(condition.value)

      case 'exists':
        return actual !== undefined && actual !== null

      case 'matches':
        return new RegExp(condition.value).test(String(actual))

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(actual)

      default:
        return false
    }
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

    // inputs.*
    if (parts[0] === 'inputs') {
      const input = context.inputs[parts[1]];
      // Handle both raw values and ContextValue objects
      if (input && typeof input === 'object' && 'value' in input) {
        return input.value;
      }
      return input;
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