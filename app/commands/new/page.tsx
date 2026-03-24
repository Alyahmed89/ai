'use client';

import { useState } from 'react';

interface Command {
  name: string;
  description: string;
  parameters: Record<string, any> | null;
  method?: string;
  endpoint?: string;
}

interface ParameterField {
  name: string;
  type: string;
  description?: string;
  default?: any;
  required?: boolean;
}

export default function NewCommandPage() {
  const [command, setCommand] = useState<Command>({
    name: '',
    description: '',
    parameters: null,
    method: 'GET',
    endpoint: ''
  });
  
  const [parameters, setParameters] = useState<ParameterField[]>([
    { name: '', type: 'string', description: '', required: false }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCommandChange = (field: keyof Command, value: any) => {
    setCommand(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleParameterChange = (index: number, field: keyof ParameterField, value: any) => {
    const newParameters = [...parameters];
    newParameters[index] = {
      ...newParameters[index],
      [field]: value
    };
    setParameters(newParameters);
  };

  const addParameter = () => {
    setParameters([...parameters, { name: '', type: 'string', description: '', required: false }]);
  };

  const removeParameter = (index: number) => {
    if (parameters.length > 1) {
      const newParameters = [...parameters];
      newParameters.splice(index, 1);
      setParameters(newParameters);
    }
  };

  const buildParametersSchema = () => {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    parameters.forEach(param => {
      if (param.name.trim()) {
        properties[param.name] = {
          type: param.type,
          description: param.description || '',
          ...(param.default !== undefined && param.default !== '' ? { default: param.default } : {})
        };
        
        if (param.required) {
          required.push(param.name);
        }
      }
    });
    
    if (Object.keys(properties).length === 0) {
      return null;
    }
    
    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {})
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!command.name.trim()) {
      setError('Command name is required');
      return;
    }
    
    if (!command.description.trim()) {
      setError('Command description is required');
      return;
    }
    
    if (!command.endpoint?.trim()) {
      setError('Endpoint is required');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const parametersSchema = buildParametersSchema();
      
      const commandData = {
        ...command,
        parameters: parametersSchema,
        tags: ['custom', 'user_created']
      };
      
      console.log('Creating new command:', commandData);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess(true);
      
      setTimeout(() => {
        window.location.href = '/chat';
      }, 2000);
      
    } catch (err) {
      console.error('Error creating command:', err);
      setError(err instanceof Error ? err.message : 'Failed to create command');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a href="/chat" className="inline-flex items-center text-gray-400 hover:text-gray-300 mb-6">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Chat
          </a>
          <div className="flex items-center mb-2">
            <svg className="w-6 h-6 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <h1 className="text-3xl font-bold text-gray-100">Create New Command</h1>
          </div>
          <p className="mt-2 text-gray-400 text-lg">Define a new API endpoint command</p>
        </div>

        {success ? (
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-6 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <h3 className="text-lg font-medium text-green-300">Command created successfully!</h3>
                <p className="text-green-400 mt-1">Redirecting back to chat...</p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
              <div className="flex items-center mb-6">
                <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-xl font-semibold text-gray-200">Command Details</h2>
              </div>
              
              {error && (
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-red-300">{error}</span>
                  </div>
                </div>
              )}
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Command Name *
                  </label>
                  <input
                    type="text"
                    value={command.name}
                    onChange={(e) => handleCommandChange('name', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    placeholder="e.g., get_user_data"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">Unique identifier for the command</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={command.description}
                    onChange={(e) => handleCommandChange('description', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    placeholder="What does this command do?"
                    rows={3}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      HTTP Method *
                    </label>
                    <select
                      value={command.method}
                      onChange={(e) => handleCommandChange('method', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Endpoint URL *
                    </label>
                    <input
                      type="text"
                      value={command.endpoint}
                      onChange={(e) => handleCommandChange('endpoint', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                      placeholder="e.g., /api/users/{id}"
                      required
                    />
                    <p className="mt-1 text-sm text-gray-500">Use {"{param}"} for path parameters</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  <h2 className="text-xl font-semibold text-gray-200">Parameters</h2>
                </div>
                <button
                  type="button"
                  onClick={addParameter}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-600 text-sm font-medium rounded-lg text-gray-300 bg-gray-800 hover:bg-gray-700"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Parameter
                </button>
              </div>
              
              <div className="space-y-6">
                {parameters.map((param, index) => (
                  <div key={index} className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-medium text-gray-200">Parameter {index + 1}</h3>
                      {parameters.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeParameter(index)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Name
                        </label>
                        <input
                          type="text"
                          value={param.name}
                          onChange={(e) => handleParameterChange(index, 'name', e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                          placeholder="e.g., userId"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Type
                        </label>
                        <select
                          value={param.type}
                          onChange={(e) => handleParameterChange(index, 'type', e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                        >
                          <option value="string">String</option>
                          <option value="integer">Integer</option>
                          <option value="number">Number</option>
                          <option value="boolean">Boolean</option>
                          <option value="array">Array</option>
                          <option value="object">Object</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Description
                      </label>
                      <input
                        type="text"
                        value={param.description || ''}
                        onChange={(e) => handleParameterChange(index, 'description', e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                        placeholder="Description of this parameter"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Default Value
                        </label>
                        <input
                          type="text"
                          value={param.default || ''}
                          onChange={(e) => handleParameterChange(index, 'default', e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                          placeholder="Optional default value"
                        />
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={param.required || false}
                          onChange={(e) => handleParameterChange(index, 'required', e.target.checked)}
                          className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-600 rounded bg-gray-700"
                          id={`required-${index}`}
                        />
                        <label htmlFor={`required-${index}`} className="ml-2 text-gray-300">
                          Required parameter
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
                
                {parameters.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No parameters defined. Click "Add Parameter" to add one.</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => window.location.href = '/chat'}
                className="px-6 py-3 border border-gray-600 text-sm font-medium rounded-lg text-gray-300 bg-gray-800 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Create Command'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
