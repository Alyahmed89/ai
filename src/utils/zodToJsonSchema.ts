// Simple Zod to JSON Schema converter for AI command parameters
// Handles common Zod types used in the DeepSeek Agent schemas

import { z } from 'zod';

export type JsonSchema = {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  [key: string]: any;
};

/**
 * Convert a Zod schema to a JSON Schema object for AI parameter validation
 * This is a simplified converter that handles the common types used in our schemas
 */
export function zodToJsonSchema(zodSchema: z.ZodTypeAny): JsonSchema {
  // Handle ZodObject (most common case for our schemas)
  if (zodSchema instanceof z.ZodObject) {
    const shape = zodSchema.shape;
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const fieldJsonSchema = convertZodType(fieldSchema as z.ZodTypeAny);
      properties[key] = fieldJsonSchema;
      
      // Check if field is required (not optional and doesn't have default)
      if (!(fieldSchema instanceof z.ZodOptional) && 
          !(fieldSchema instanceof z.ZodDefault)) {
        required.push(key);
      }
    }
    
    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined
    };
  }
  
  // Handle other Zod types
  return convertZodType(zodSchema);
}

/**
 * Convert basic Zod types to JSON Schema
 */
function convertZodType(zodType: z.ZodTypeAny): any {
  // String
  if (zodType instanceof z.ZodString) {
    const schema: any = { type: 'string' };
    return schema;
  }
  
  // Number
  if (zodType instanceof z.ZodNumber) {
    const schema: any = { type: 'number' };
    return schema;
  }
  
  // Boolean
  if (zodType instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }
  
  // Array
  if (zodType instanceof z.ZodArray) {
    return {
      type: 'array',
      items: convertZodType(zodType.element)
    };
  }
  
  // Optional (make property not required)
  if (zodType instanceof z.ZodOptional) {
    return convertZodType(zodType._def.innerType);
  }
  
  // Default (make property not required, include default)
  if (zodType instanceof z.ZodDefault) {
    const innerSchema = convertZodType(zodType._def.innerType);
    const defaultValue = zodType._def.defaultValue();
    
    if (defaultValue !== undefined) {
      innerSchema.default = defaultValue;
    }
    
    return innerSchema;
  }
  
  // Nullable
  if (zodType instanceof z.ZodNullable) {
    const innerSchema = convertZodType(zodType._def.innerType);
    innerSchema.nullable = true;
    return innerSchema;
  }
  
  // Literal (enum-like)
  if (zodType instanceof z.ZodLiteral) {
    return { const: zodType.value };
  }
  
  // Enum
  if (zodType instanceof z.ZodEnum) {
    return { 
      type: 'string',
      enum: zodType._def.values
    };
  }
  
  // Union (oneOf)
  if (zodType instanceof z.ZodUnion) {
    return {
      oneOf: zodType._def.options.map((option: z.ZodTypeAny) => 
        convertZodType(option)
      )
    };
  }
  
  // Intersection (allOf)
  if (zodType instanceof z.ZodIntersection) {
    return {
      allOf: [
        convertZodType(zodType._def.left),
        convertZodType(zodType._def.right)
      ]
    };
  }
  
  // Record (object with unknown keys)
  if (zodType instanceof z.ZodRecord) {
    return {
      type: 'object',
      additionalProperties: convertZodType(zodType._def.valueType)
    };
  }
  
  // Any/Unknown
  if (zodType instanceof z.ZodAny || zodType instanceof z.ZodUnknown) {
    return {};
  }
  
  // Fallback for unknown types
  console.warn(`Unknown Zod type: ${zodType.constructor.name}, falling back to any`);
  return {};
}

/**
 * Generate a JSON Schema string from a Zod schema
 */
export function zodToJsonSchemaString(zodSchema: z.ZodTypeAny): string {
  const jsonSchema = zodToJsonSchema(zodSchema);
  return JSON.stringify(jsonSchema, null, 2);
}

/**
 * Example usage and test
 */
export function testZodToJsonSchema() {
  // Test with a simple schema similar to our task schemas
  const testSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    status: z.string().default('pending'),
    order_index: z.number().int().nonnegative().default(0)
  });
  
  const jsonSchema = zodToJsonSchema(testSchema);
  console.log('Test JSON Schema:', JSON.stringify(jsonSchema, null, 2));
  
  return jsonSchema;
}