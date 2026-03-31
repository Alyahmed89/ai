// Simple test to verify the API endpoints work
const API_BASE = "https://deepseek-agent.alghamdimo89.workers.dev";

async function testProjectsAPI() {
  console.log('Testing Projects API...\n');
  
  // Test 1: Create a project
  console.log('1. Creating a project...');
  try {
    const createResponse = await fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test Project ' + Date.now(),
        description: 'Test project created via API'
      })
    });
    
    if (createResponse.ok) {
      const result = await createResponse.json();
      if (result.success && result.data) {
        const createdProject = result.data;
        console.log('✓ Project created successfully');
        console.log('  Project ID:', createdProject.id);
        console.log('  Project Name:', createdProject.name);
        console.log('  Description:', createdProject.description);
      
        // Test 2: List projects
        console.log('\n2. Listing projects...');
        const listResponse = await fetch(`${API_BASE}/api/projects`);
        if (listResponse.ok) {
          const listResult = await listResponse.json();
          if (listResult.success && listResult.data) {
            const projects = listResult.data;
            console.log(`✓ Found ${projects.length} projects`);
            
            // Test 3: Get specific project
            console.log('\n3. Getting project details...');
            const getResponse = await fetch(`${API_BASE}/api/projects/${createdProject.id}`);
            if (getResponse.ok) {
              const getResult = await getResponse.json();
              if (getResult.success && getResult.data) {
                const projectDetails = getResult.data;
                console.log('✓ Project details retrieved');
                console.log('  Name:', projectDetails.name);
                console.log('  Description:', projectDetails.description);
                console.log('  Created:', projectDetails.created_at);
                
                // Test 4: Update project
                console.log('\n4. Updating project...');
                const updateResponse = await fetch(`${API_BASE}/api/projects/${createdProject.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    description: 'Updated test project description'
                  })
                });
                
                if (updateResponse.ok) {
                  const updateResult = await updateResponse.json();
                  if (updateResult.success) {
                    console.log('✓ Project updated successfully');
                    
                    // Test 5: Delete project
                    console.log('\n5. Deleting project...');
                    const deleteResponse = await fetch(`${API_BASE}/api/projects/${createdProject.id}`, {
                      method: 'DELETE'
                    });
                    
                    if (deleteResponse.ok) {
                      const deleteResult = await deleteResponse.json();
                      if (deleteResult.success) {
                        console.log('✓ Project deleted successfully');
                        console.log('\n✅ All tests passed!');
                      } else {
                        console.log('✗ Failed to delete project:', deleteResult.error);
                      }
                    } else {
                      console.log('✗ Failed to delete project:', deleteResponse.status);
                    }
                  } else {
                    console.log('✗ Failed to update project:', updateResult.error);
                  }
                } else {
                  console.log('✗ Failed to update project:', updateResponse.status);
                }
              } else {
                console.log('✗ Failed to get project details:', getResult.error);
              }
            } else {
              console.log('✗ Failed to get project details:', getResponse.status);
            }
          } else {
            console.log('✗ Failed to list projects:', listResult.error);
          }
        } else {
          console.log('✗ Failed to list projects:', listResponse.status);
        }
      } else {
        console.log('✗ Failed to create project:', result.error);
      }
    } else {
      console.log('✗ Failed to create project:', createResponse.status);
    }
  } catch (error) {
    console.error('Error during API test:', error);
  }
}

// Run the test
testProjectsAPI();
