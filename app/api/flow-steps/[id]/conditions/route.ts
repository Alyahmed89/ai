import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Cloudflare D1 API configuration
const CLOUDFLARE_ACCOUNT_ID = 'e39371fc55a5c9ef7ed83e16660bd7bb';
const CLOUDFLARE_API_TOKEN = 'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL';
const DATABASE_ID = 'ce8f2a2c-6e4b-4398-b73e-ba8f204f609a';
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stepId } = await params;
    
    // Make API call to Cloudflare D1 to get conditions for this step
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: `SELECT * FROM flow_step_conditions WHERE flow_step_id = "${stepId}" ORDER BY condition_type, condition_value`
      })
    });

    const data = await response.json();
    
    if (data.success) {
      const conditions = data.result[0].results || [];
      
      // If there are conditions, also fetch the next step titles
      if (conditions.length > 0) {
        // Get unique next_step values (excluding -1 which means end)
        const nextStepIds = [...new Set(conditions.map((c: any) => c.next_step).filter((id: number) => id !== -1))];
        
        if (nextStepIds.length > 0) {
          // Fetch the step titles for these next_step IDs
          const placeholders = nextStepIds.map(() => '?').join(',');
          const stepResponse = await fetch(API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sql: `SELECT id, title, order_index FROM flow_steps WHERE order_index IN (${placeholders})`,
              params: nextStepIds
            })
          });
          
          const stepData = await stepResponse.json();
          
          if (stepData.success) {
            const stepTitles: Record<number, string> = {};
            stepData.result[0].results.forEach((step: any) => {
              stepTitles[step.order_index] = `${step.title} (Step ${step.order_index})`;
            });
            
            // Add step titles to conditions
            const conditionsWithTitles = conditions.map((condition: any) => ({
              ...condition,
              next_step_title: condition.next_step === -1 ? 'End Flow' : stepTitles[condition.next_step] || `Step ${condition.next_step}`
            }));
            
            return NextResponse.json(conditionsWithTitles);
          }
        }
        
        // If we couldn't fetch step titles, just return conditions with basic titles
        const conditionsWithBasicTitles = conditions.map((condition: any) => ({
          ...condition,
          next_step_title: condition.next_step === -1 ? 'End Flow' : `Step ${condition.next_step}`
        }));
        
        return NextResponse.json(conditionsWithBasicTitles);
      }
      
      return NextResponse.json([]);
    } else {
      return NextResponse.json(
        { error: 'Failed to fetch conditions from database' },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('Error fetching step conditions:', err);
    return NextResponse.json(
      { error: 'Failed to load step conditions from Cloudflare D1 database' },
      { status: 500 }
    );
  }
}