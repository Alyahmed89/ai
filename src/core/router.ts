import { ExecutionContext } from './execution-context'
import { Condition } from './condition-evaluator'

export type Route = {
  type: 'step' | 'flow' | 'end' | 'error'
  target_id?: string
  context_preservation?: 'full' | 'partial' | 'none'
}

export type RoutedCondition = {
  condition: Condition
  route: Route
}

export class Router {

  constructor(private evaluator: any) {}

  resolve(
    conditions: RoutedCondition[],
    context: ExecutionContext
  ): Route | null {

    for (const item of conditions) {
      const match = this.evaluator.evaluate(item.condition, context)

      if (match) {
        return item.route
      }
    }

    return null
  }

  resolveWithFallback(
    conditions: RoutedCondition[],
    context: ExecutionContext,
    fallback?: Route
  ): Route {

    const matched = this.resolve(conditions, context)

    if (matched) return matched

    if (fallback) return fallback

    return { type: 'end' }
  }
}