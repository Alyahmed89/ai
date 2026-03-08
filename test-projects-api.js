// Simple test to verify the API endpoints work
const API_BASE = "https://deepseek-agent.alghamdimo89.workers.dev";

async function testProjectsAPI() {
  console.log('Testing Projects API...\n');
  
  // Test 1: Create a project
  console.log('1. Creating a project...');
  try {
    const createResponse = await fetch(`${API_BASE}/graph/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test Project ' + Date.now(),
        status: 'active',
        metadata: '{"description": "Test project created via API"}'
      })
    });
    
    if (createResponse.ok) {
      const createdProject = await createResponse.json();
      console.log('✓ Project created successfully');
      console.log('  Project ID:', createdProject.id);
      console.log('  Project Name:', createdProject.name);
      
      // Test 2: List projects
      console.log('\n2. Listing projects...');
      const listResponse = await fetch(`${API_BASE}/graph/projects`);
      if (listResponse.ok) {
        const projects = await listResponse.json();
        console.log(`✓ Found ${projects.length} projects`);
        
        // Test 3: Get specific project
        console.log('\n3. Getting project details...');
        const getResponse = await fetch(`${API_BASE}/graph/projects/${createdProject.id}`);
        if (getResponse.ok) {
          const projectDetails = await getResponse.json();
          console.log('✓ Project details retrieved');
          console.log('  Status:', projectDetails.status);
          console.log('  Created:', projectDetails.created_at);
          
          // Test 4: Update project
          console.log('\n4. Updating project...');
          const updateResponse = await fetch(`${API_BASE}/graph/projects/${createdProject.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'archived',
              metadata: '{"description": "Updated test project", "reason": "Testing"}'
            })
          });
          
          if (updateResponse.ok) {
            console.log('✓ Project updated successfully');
            
            // Test 5: Delete project
            console.log('\n5. Deleting project...');
            const deleteResponse = await fetch(`${API_BASE}/graph/projects/${createdProject.id}`, {
              method: 'DELETE'
            });
            
            if (deleteResponse.ok) {
              console.log('✓ Project deleted successfully');
              console.log('\n✅ All tests passed!');
            } else {
              console.log('✗ Failed to delete project:', deleteResponse.status);
            }
          } else {
            console.log('✗ Failed to update project:', updateResponse.status);
          }
        } else {
          console.log('✗ Failed to get project details:', getResponse.status);
        }
      } else {
        console.log('✗ Failed to list projects:', listResponse.status);
      }
    } else {
      console.log('✗ Failed to create project:', createResponse.status);
      const errorText = await createResponse.text();
      console.log('  Error:', errorText);
    }
  } catch (error) {
    console.log('✗ Error during API test:', error.message);
  }
}

testProjectsAPI();
