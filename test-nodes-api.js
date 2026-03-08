// Simple test to verify the Nodes API endpoints work
const API_BASE = "https://deepseek-agent.alghamdimo89.workers.dev";

async function testNodesAPI() {
  console.log('Testing Nodes API...\n');
  
  // First, create a project to associate nodes with
  console.log('1. Creating a project for nodes...');
  try {
    const createProjectResponse = await fetch(`${API_BASE}/graph/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test Project for Nodes ' + Date.now(),
        status: 'active',
        metadata: '{"description": "Project for testing nodes API"}'
      })
    });
    
    if (!createProjectResponse.ok) {
      console.log('✗ Failed to create project:', createProjectResponse.status);
      const errorText = await createProjectResponse.text();
      console.log('  Error:', errorText);
      return;
    }
    
    const project = await createProjectResponse.json();
    console.log('✓ Project created successfully');
    console.log('  Project ID:', project.id);
    
    // Test 2: Create a task node
    console.log('\n2. Creating a task node...');
    const createNodeResponse = await fetch(`${API_BASE}/graph/nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: project.id,
        type: 'task',
        title: 'Implement User Authentication',
        content: '{"description": "Create login, registration, and password reset functionality", "priority": "high", "estimated_hours": 8}',
        status: 'active',
        metadata: '{"assignee": "john.doe", "due_date": "2024-03-15"}'
      })
    });
    
    if (createNodeResponse.ok) {
      const createdNode = await createNodeResponse.json();
      console.log('✓ Node created successfully');
      console.log('  Node ID:', createdNode.id);
      console.log('  Node Title:', createdNode.title);
      
      // Test 3: List nodes
      console.log('\n3. Listing nodes...');
      const listResponse = await fetch(`${API_BASE}/graph/nodes`);
      if (listResponse.ok) {
        const nodes = await listResponse.json();
        console.log(`✓ Found ${nodes.length} nodes`);
        
        // Test 4: Get specific node
        console.log('\n4. Getting node details...');
        const getResponse = await fetch(`${API_BASE}/graph/nodes/${createdNode.id}`);
        if (getResponse.ok) {
          const nodeDetails = await getResponse.json();
          console.log('✓ Node details retrieved');
          console.log('  Type:', nodeDetails.type);
          console.log('  Status:', nodeDetails.status);
          
          // Test 5: Update node
          console.log('\n5. Updating node...');
          const updateResponse = await fetch(`${API_BASE}/graph/nodes/${createdNode.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'completed',
              metadata: '{"assignee": "john.doe", "due_date": "2024-03-15", "completed_date": "2024-03-10"}'
            })
          });
          
          if (updateResponse.ok) {
            console.log('✓ Node updated successfully');
            
            // Test 6: Delete node
            console.log('\n6. Deleting node...');
            const deleteResponse = await fetch(`${API_BASE}/graph/nodes/${createdNode.id}`, {
              method: 'DELETE'
            });
            
            if (deleteResponse.ok) {
              console.log('✓ Node deleted successfully');
              
              // Clean up: Delete the test project
              console.log('\n7. Cleaning up test project...');
              const deleteProjectResponse = await fetch(`${API_BASE}/graph/projects/${project.id}`, {
                method: 'DELETE'
              });
              
              if (deleteProjectResponse.ok) {
                console.log('✓ Test project deleted successfully');
                console.log('\n✅ All tests passed!');
              } else {
                console.log('✗ Failed to delete test project:', deleteProjectResponse.status);
              }
            } else {
              console.log('✗ Failed to delete node:', deleteResponse.status);
            }
          } else {
            console.log('✗ Failed to update node:', updateResponse.status);
          }
        } else {
          console.log('✗ Failed to get node details:', getResponse.status);
        }
      } else {
        console.log('✗ Failed to list nodes:', listResponse.status);
      }
    } else {
      console.log('✗ Failed to create node:', createNodeResponse.status);
      const errorText = await createNodeResponse.text();
      console.log('  Error:', errorText);
    }
  } catch (error) {
    console.log('✗ Error during API test:', error.message);
  }
}

testNodesAPI();
