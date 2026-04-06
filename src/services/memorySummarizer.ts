// Memory summarization service for structured conversation memory
import { callDeepSeek } from './deepseek';

export interface StructuredMemory {
  goal: string;
  decisions: string[];
  context: string;
  constraints: string[];
}

/**
 * Summarize conversation into structured memory
 */
export async function summarizeConversationToMemory(
  apiKey: string,
  conversationHistory: Array<{role: string; content: string}>,
  currentStepInstructions: string
): Promise<{success: boolean; memory?: StructuredMemory; error?: string}> {
  try {
    // Build summarization prompt
    const summarizationPrompt = `Summarize the conversation into structured memory.

Keep:
- goals
- key decisions  
- important data
- constraints

Remove:
- fluff
- repetition

Conversation History:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')}

Current Step Instructions:
${currentStepInstructions}

Return ONLY valid JSON:
{
  "goal": "",
  "decisions": [],
  "context": "",
  "constraints": []
}`;

    const messages = [
      { role: 'system', content: 'You are a memory summarizer. Extract structured information from conversations.' },
      { role: 'user', content: summarizationPrompt }
    ];

    const result = await callDeepSeek(apiKey, messages);
    
    if (!result.success) {
      return { success: false, error: `Summarization failed: ${result.error}` };
    }

    // Extract JSON from response
    const response = result.response;
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      return { success: false, error: 'No JSON found in summarization response' };
    }

    try {
      const memory = JSON.parse(jsonMatch[0]) as StructuredMemory;
      
      // Validate structure
      if (!memory.goal || !Array.isArray(memory.decisions) || !memory.context || !Array.isArray(memory.constraints)) {
        return { success: false, error: 'Invalid memory structure returned' };
      }

      return { success: true, memory };
    } catch (parseError) {
      return { success: false, error: `JSON parse error: ${parseError}` };
    }
  } catch (error: any) {
    return { success: false, error: `Summarization exception: ${error.message}` };
  }
}

/**
 * Format memory for inclusion in step instructions
 */
export function formatMemoryForInstructions(memory: StructuredMemory): string {
  return `Previous Context (Structured Memory):
Goal: ${memory.goal}
Key Decisions: ${memory.decisions.length > 0 ? memory.decisions.join(', ') : 'None yet'}
Context: ${memory.context}
Constraints: ${memory.constraints.length > 0 ? memory.constraints.join(', ') : 'None'}`;
}