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
    // Log before router evaluation
    console.log(JSON.stringify({
      feature: "conditions",
      step: "before_router_evaluation",
      data: {
        conditions_count: conditions.length,
        context_summary: this._summarizeContext(context)
      }
    }));

    for (const item of conditions) {
      const match = this.evaluator.evaluate(item.condition, context)

      if (match) {
        // Log route match
        console.log(JSON.stringify({
          feature: "conditions",
          step: "route_matched",
          data: {
            condition_source: item.condition.source,
            condition_operator: item.condition.operator,
            route_type: item.route.type,
            target_id: item.route.target_id,
            context_summary: this._summarizeContext(context)
          }
        }));
        return item.route
      }
    }

    // Log no route matched
    console.log(JSON.stringify({
      feature: "conditions",
      step: "no_route_matched",
      data: {
        conditions_count: conditions.length,
        context_summary: this._summarizeContext(context)
      }
    }));

    return null
  }

  resolveWithFallback(
    conditions: RoutedCondition[],
    context: ExecutionContext,
    fallback?: Route
  ): Route {

    const matched = this.resolve(conditions, context)

    if (matched) return matched

    if (fallback) {
      // Log fallback route
      console.log(JSON.stringify({
        feature: "conditions",
        step: "fallback_route_used",
        data: {
          fallback_type: fallback.type,
          fallback_target_id: fallback.target_id,
          context_summary: this._summarizeContext(context)
        }
      }));
      return fallback
    }

    // Log end route
    console.log(JSON.stringify({
      feature: "conditions",
      step: "end_route_used",
      data: {
        context_summary: this._summarizeContext(context)
      }
    }));
    return { type: 'end' }
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
}