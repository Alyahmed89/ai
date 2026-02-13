// Test the database query logic
const flow_id = "etaflow";

// Simulate what getFlowDefinition does
const query = `
  SELECT id, name, first_prompt as description, deepseek_system, max_iterations, repo as repository, branch
  FROM flows
  WHERE id = ?
`;

console.log("Query:", query);
console.log("Flow ID:", flow_id);
console.log("\nExpected columns:");
console.log("- id");
console.log("- name"); 
console.log("- first_prompt (aliased as description)");
console.log("- deepseek_system");
console.log("- max_iterations");
console.log("- repo (aliased as repository)");
console.log("- branch");
console.log("\nIf the 'flows' table doesn't exist, this query will fail.");
console.log("If 'repo' or 'branch' columns don't exist, this query will fail.");
console.log("\nThe getFlowDefinition function catches errors and returns null.");
console.log("Then handleStartFlow uses default values: '[FLOW]' for repository and branch.");
