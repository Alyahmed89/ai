export async function startFlow(flow_id: string, input: any) {
  const response = await fetch('/start-flow', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ flow_id, input })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to start flow: ${response.statusText}`);
  }
  
  return response.json();
}

export async function runStep(flow_run_id: string) {
  const response = await fetch('/step', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ flow_run_id })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to run step: ${response.statusText}`);
  }
  
  return response.json();
}