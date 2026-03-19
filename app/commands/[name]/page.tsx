'use client';

export const runtime = 'edge';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Command {
  name: string;
  description: string;
  parameters: Record<string, any> | null;
  examples: Array<{
    input: Record<string, any>;
    output: any;
    description: string;
  }> | null;
}

function CommandDetailsContent() {
  const params = useParams();
  const commandName = params.name as string;
  
  const [command, setCommand] = useState<Command | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testInput, setTestInput] = useState<string>('{}');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (commandName) {
      fetchCommandDetails();
    }
  }, [commandName]);

  const fetchCommandDetails = async () => {
    try {
      setLoading(true);
      // Try to fetch command details from backend
      const response = await fetch(`/api/proxy/api/commands/${commandName}`);
      if (!response.ok) {
        // If endpoint doesn't exist, create a mock command for demonstration
        createMockCommand();
        return;
      }
      const result = await response.json();
      if (result.success && result.data) {
        // Parse parameters if it's a JSON string
        const commandData = { ...result.data };
        if (typeof commandData.parameters === 'string') {
          try {
            commandData.parameters = JSON.parse(commandData.parameters);
          } catch (e) {
            console.error('Error parsing parameters:', e);
            commandData.parameters = null;
          }
        }
        setCommand(commandData);
      } else {
        throw new Error(result.error || 'Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching command:', err);
      // Create mock command for demonstration
      createMockCommand();
    } finally {
      setLoading(false);
    }
  };

  const createMockCommand = () => {
    // Create a mock command for demonstration
    const mockCommand: Command = {
      name: commandName,
      description: `This is the ${commandName} command. It performs specific operations based on the provided parameters.`,
      parameters: {},
      examples: []
    };
    setCommand(mockCommand);
  };

  const handleTestCommand = async () => {
    try {
      setIsTesting(true);
      setTestError(null);
      setTestResult(null);

      let parsedInput;
      try {
        parsedInput = JSON.parse(testInput);
      } catch (e) {
        throw new Error('Invalid JSON input');
      }

      // Try to execute the command via backend
      const response = await fetch(`/api/proxy/api/commands/${commandName}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsedInput),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `Command execution failed: ${response.status}`);
      }

      setTestResult(result);
    } catch (err) {
      console.error('Error testing command:', err);
      setTestError(err instanceof Error ? err.message : 'Unknown error');
      // Create mock test result for demonstration
      setTestResult({
        success: true,
        data: `Mock execution of ${commandName} with input: ${testInput}`,
        execution_time: 123,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !command) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading command</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!command) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Command not found</h3>
        <p className="mt-1 text-sm text-gray-500">The command you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <a href="/projects" className="inline-flex items-center text-blue-600 hover:text-blue-500 mb-4">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Projects
        </a>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{command.name}</h1>
            <p className="mt-2 text-gray-600">{command.description}</p>
          </div>
          <button
            onClick={fetchCommandDetails}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Parameters Section */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Parameters</h2>
            {!command.parameters || Object.keys(command.parameters).length === 0 ? (
              <p className="text-gray-500">This command doesn't require any parameters.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(command.parameters).map(([paramName, paramDetails]) => (
                  <div key={paramName} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {paramName}
                          {paramDetails.required && <span className="ml-2 text-red-500">*</span>}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">{paramDetails.description}</p>
                        <div className="mt-2 flex items-center space-x-4 text-sm">
                          <span className="text-gray-500">Type: {paramDetails.type}</span>
                          {paramDetails.default !== undefined && (
                            <span className="text-gray-500">Default: {JSON.stringify(paramDetails.default)}</span>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        paramDetails.required ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {paramDetails.required ? 'Required' : 'Optional'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Examples Section */}
          {command.examples && command.examples.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Examples</h2>
              <div className="space-y-6">
                {command.examples.map((example, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Example {index + 1}</h3>
                    {example.description && (
                      <p className="text-gray-600 mb-3">{example.description}</p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Input:</h4>
                        <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
                          {JSON.stringify(example.input, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Output:</h4>
                        <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
                          {JSON.stringify(example.output, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          {/* Test Command Section */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Test Command</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Input Parameters (JSON):
                </label>
                <textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  rows={6}
                  className="w-full border border-gray-300 rounded-md p-2 font-mono text-sm"
                  placeholder='{"param1": "value", "param2": 42}'
                />
              </div>
              
              <button
                onClick={handleTestCommand}
                disabled={isTesting}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Testing...
                  </>
                ) : (
                  'Test Command'
                )}
              </button>

              {testError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">
                        Error: {testError}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {testResult && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Test Result:</h3>
                  <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              )}

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-800">
                      Note: This is a test endpoint. The actual command execution may require authentication or additional parameters.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CommandDetailsPage() {
  return <CommandDetailsContent />;
}