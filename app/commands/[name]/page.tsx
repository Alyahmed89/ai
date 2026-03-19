'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Command {
  name: string;
  description: string;
  parameters: Record<string, any> | null;
  method?: string;
  endpoint?: string;
}

interface TestResult {
  success: boolean;
  data: any;
  commandName?: string;
  executionTime?: number;
  note?: string;
  error?: string;
}

function CommandDetailsContent() {
  const params = useParams();
  const commandName = params.name as string;
  
  const [command, setCommand] = useState<Command | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (commandName) {
      fetchCommandDetails();
    }
  }, [commandName]);

  const fetchCommandDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/proxy/api/commands/${commandName}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch command: ${response.status}`);
      }
      const result = await response.json();
      if (result.success && result.data) {
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
        
        // Initialize form data based on parameters
        if (commandData.parameters && commandData.parameters.properties) {
          const initialFormData: Record<string, any> = {};
          Object.entries(commandData.parameters.properties).forEach(([key, prop]: [string, any]) => {
            if (prop.default !== undefined) {
              initialFormData[key] = prop.default;
            }
          });
          setFormData(initialFormData);
        }
      } else {
        throw new Error(result.error || 'Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching command:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleTestCommand = async () => {
    if (!command) return;
    
    try {
      setTesting(true);
      setTestError(null);
      setTestResult(null);
      
      // Prepare request body
      const requestBody: any = {};
      if (command.parameters && command.parameters.properties && Object.keys(formData).length > 0) {
        requestBody.params = formData;
      }
      
      // Always use POST for testing commands
      // Based on the API note: "Test with POST /api/test-command/:name"
      const response = await fetch(`/api/proxy/api/test-command/${commandName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        throw new Error(`Test failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      setTestResult(result);
    } catch (err) {
      console.error('Error testing command:', err);
      setTestError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTesting(false);
    }
  };

  const handleFormChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
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
    <div className="min-h-screen bg-gray-950 text-gray-200 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <a href="/chat" className="inline-flex items-center text-blue-400 hover:text-blue-300 mb-6">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Chat
          </a>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center mb-2">
                <svg className="w-6 h-6 text-blue-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <h1 className="text-3xl font-bold text-gray-100">{command.name}</h1>
              </div>
              <p className="mt-2 text-gray-400 text-lg">{command.description}</p>
            </div>
            <button
              onClick={fetchCommandDetails}
              className="inline-flex items-center px-4 py-2 border border-gray-700 text-sm font-medium rounded-lg text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-200">Parameters</h2>
            </div>
            <button
              onClick={handleTestCommand}
              disabled={testing}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Testing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Test Command
                </>
              )}
            </button>
          </div>
          
          {!command.parameters || !command.parameters.properties || Object.keys(command.parameters.properties).length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-gray-500">This command doesn't require any parameters.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                {Object.entries(command.parameters.properties).map(([paramName, paramDetails]: [string, any]) => {
                  const isRequired = command.parameters.required && command.parameters.required.includes(paramName);
                  const paramType = paramDetails.type || 'string';
                  const paramValue = formData[paramName] !== undefined ? formData[paramName] : '';
                  
                  return (
                    <div key={paramName} className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <h3 className="text-lg font-medium text-gray-200">
                              {paramName}
                              {isRequired && <span className="ml-2 text-red-400">*</span>}
                            </h3>
                            <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${
                              isRequired ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-gray-700 text-gray-400 border border-gray-600'
                            }`}>
                              {isRequired ? 'Required' : 'Optional'}
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm mb-3">{paramDetails.description || 'No description available'}</p>
                          
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                              Value
                            </label>
                            {paramType === 'boolean' ? (
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={!!paramValue}
                                  onChange={(e) => handleFormChange(paramName, e.target.checked)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-700"
                                />
                                <span className="ml-2 text-gray-300">{paramValue ? 'True' : 'False'}</span>
                              </div>
                            ) : paramType === 'integer' || paramType === 'number' ? (
                              <input
                                type="number"
                                value={paramValue}
                                onChange={(e) => handleFormChange(paramName, e.target.value === '' ? '' : Number(e.target.value))}
                                className="block w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder={paramDetails.default !== undefined ? `Default: ${paramDetails.default}` : ''}
                              />
                            ) : (
                              <input
                                type="text"
                                value={paramValue}
                                onChange={(e) => handleFormChange(paramName, e.target.value)}
                                className="block w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder={paramDetails.default !== undefined ? `Default: ${paramDetails.default}` : ''}
                              />
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm mt-3">
                            <div className="flex items-center">
                              <span className="text-gray-500 mr-2">Type:</span>
                              <span className="font-mono text-gray-300">{paramType}</span>
                            </div>
                            {paramDetails.default !== undefined && (
                              <div className="flex items-center">
                                <span className="text-gray-500 mr-2">Default:</span>
                                <span className="font-mono text-gray-300">{JSON.stringify(paramDetails.default)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Test Results Section */}
        {(testResult || testError) && (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
            <div className="flex items-center mb-6">
              <svg className="w-5 h-5 text-blue-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-200">Test Results</h2>
            </div>
            
            {testError ? (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-400">Test Failed</h3>
                    <div className="mt-2 text-sm text-red-300">
                      <p>{testError}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : testResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      testResult.success ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'
                    }`}>
                      {testResult.success ? 'Success' : 'Failed'}
                    </div>
                    {testResult.executionTime && (
                      <span className="ml-3 text-gray-400 text-sm">
                        Execution time: {testResult.executionTime}ms
                      </span>
                    )}
                  </div>
                  {testResult.commandName && (
                    <span className="text-gray-400 text-sm">
                      Command: {testResult.commandName}
                    </span>
                  )}
                </div>
                
                {testResult.note && (
                  <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3">
                    <p className="text-blue-300 text-sm">{testResult.note}</p>
                  </div>
                )}
                
                <div>
                  <h3 className="text-lg font-medium text-gray-200 mb-3">Response Data</h3>
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <pre className="text-gray-300 text-sm overflow-auto max-h-96">
                      {JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Command Information Section */}
        {command.method && command.endpoint && (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
            <div className="flex items-center mb-6">
              <svg className="w-5 h-5 text-blue-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-200">Command Information</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center">
                <span className="text-gray-400 w-32">Method:</span>
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  command.method === 'GET' ? 'bg-blue-900/30 text-blue-400 border border-blue-800' :
                  command.method === 'POST' ? 'bg-green-900/30 text-green-400 border border-green-800' :
                  command.method === 'PUT' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800' :
                  command.method === 'DELETE' ? 'bg-red-900/30 text-red-400 border border-red-800' :
                  'bg-gray-700 text-gray-400 border border-gray-600'
                }`}>
                  {command.method}
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-400 w-32">Endpoint:</span>
                <code className="font-mono text-gray-300 bg-gray-800 px-2 py-1 rounded">
                  {command.endpoint}
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommandDetailsPage() {
  return <CommandDetailsContent />;
}
