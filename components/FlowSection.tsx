'use client';

import { useState, useEffect } from 'react';
import SearchableDropdown from './ui/SearchableDropdown';
import IntelligentTextarea from './ui/IntelligentTextarea';
import CreateEndpointModal from './CreateEndpointModal';

interface FlowSectionProps {
  title: string;
  type: 'input' | 'output';
  flowValue: string;
  stepValue: string;
  flowrunValue: string;
  onFlowChange: (value: string) => void;
  onStepChange: (value: string) => void;
  onFlowrunChange: (value: string) => void;
  selectedCommand: string;
  onCommandChange: (value: string) => void;
  availableCommands: Array<{ name: string; method: string }>;
  loadingCommands: boolean;
  onAddCommand: () => void;
  onShowSample: () => void;
  queryParams: Array<{ key: string; value: string }>;
  onAddQueryParam: () => void;
  onUpdateQueryParam: (index: number, key: string, value: string) => void;
  onRemoveQueryParam: (index: number) => void;
  onVariableDragStart: (e: React.DragEvent, variable: string) => void;
  defaultCollapsed?: boolean;
  sampleResponse?: string;
}

// Endpoint metadata will be provided by backend
// Includes parameters (from request sample) and variables (from response sample)

export default function FlowSection({
  title,
  type,
  flowValue,
  stepValue,
  flowrunValue,
  onFlowChange,
  onStepChange,
  onFlowrunChange,
  selectedCommand,
  onCommandChange,
  availableCommands,
  loadingCommands,
  onAddCommand,
  onShowSample,
  queryParams,
  onAddQueryParam,
  onUpdateQueryParam,
  onRemoveQueryParam,
  onVariableDragStart,
  defaultCollapsed = true,
  sampleResponse = `{
  "status": "success",
  "data": {
    "id": "resp_001",
    "message": "Operation completed successfully",
    "timestamp": "2024-01-15T10:30:00Z",
    "metrics": {
      "duration_ms": 245,
      "records_processed": 1250
    }
  }
}`
}: FlowSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [smartParams, setSmartParams] = useState(queryParams);
  
  // State for endpoint creation modal
  const [showCreateEndpointModal, setShowCreateEndpointModal] = useState(false);
  const [endpointToCreate, setEndpointToCreate] = useState('');
  
  // State for API data
  const [commands, setCommands] = useState<Array<{id: string, label: string, description?: string, type: 'command', value: string}>>([]);
  const [flows, setFlows] = useState<Array<{id: string, label: string, description?: string, type: 'flow', value: string}>>([]);
  const [steps, setSteps] = useState<Array<{id: string, label: string, description?: string, type: 'step', value: string}>>([]);
  const [flowruns, setFlowruns] = useState<Array<{id: string, label: string, description?: string, type: 'flowrun', value: string}>>([]);
  const [loadingData, setLoadingData] = useState({
    commands: false,
    flows: false,
    steps: false,
    flowruns: false
  });

  // State for endpoint keys (inputs and outputs)
  const [inputKeys, setInputKeys] = useState<string[]>([]);
  const [outputKeys, setOutputKeys] = useState<string[]>([]);
  const [loadingEndpoint, setLoadingEndpoint] = useState(false);

  const flowOptions = ['main_pipeline', 'data_processing', 'etl_job', 'analytics_flow'];
  const stepOptions = ['process_data', 'validate_input', 'transform_results', 'load_final'];
  const flowrunOptions = ['daily_run_001', 'nightly_batch', 'manual_trigger', 'scheduled_flow'];
  
  // Variables will be provided by backend based on endpoint
  // For now, show placeholder or empty list
  const variables: string[] = [];

  // Sections will be shown when endpoint is selected
  // Backend will provide actual parameters and variables

  // Backend will provide endpoint metadata when command is selected
  // This includes parameters (from request sample) and variables (from response sample)

  // Smart parameter management
  useEffect(() => {
    // Sync with parent component
    if (JSON.stringify(smartParams) !== JSON.stringify(queryParams)) {
      setSmartParams(queryParams);
    }
  }, [queryParams]);

  // Auto-add new parameter row when current row is filled
  useEffect(() => {
    const lastParam = smartParams[smartParams.length - 1];
    if (lastParam && lastParam.key && lastParam.value) {
      // Check if we need to add a new empty row
      const hasEmptyRow = smartParams.some(p => !p.key && !p.value);
      if (!hasEmptyRow) {
        onAddQueryParam();
      }
    }
  }, [smartParams, onAddQueryParam]);

  const handleParameterChange = (index: number, field: 'key' | 'value', value: string) => {
    const newParams = [...smartParams];
    newParams[index] = { ...newParams[index], [field]: value };
    setSmartParams(newParams);
    onUpdateQueryParam(index, field === 'key' ? value : newParams[index].key, field === 'value' ? value : newParams[index].value);
  };

  const handleParameterBlur = (index: number) => {
    const param = smartParams[index];
    // Remove empty parameter if it's not the last one
    if (!param.key && !param.value && index !== smartParams.length - 1) {
      const newParams = smartParams.filter((_, i) => i !== index);
      setSmartParams(newParams);
      onRemoveQueryParam(index);
    }
  };

  const handleAddParameter = () => {
    onAddQueryParam();
    setSmartParams([...smartParams, { key: '', value: '' }]);
  };

  // Search endpoint function for SearchableDropdown
  const searchEndpoints = async (query: string) => {
    // Use commands state which contains all commands fetched from API
    return new Promise<Array<{ id: string; label: string; description?: string }>>((resolve) => {
      setTimeout(() => {
        const filtered = commands
          .filter(cmd => 
            cmd.label.toLowerCase().includes(query.toLowerCase()) ||
            cmd.description?.toLowerCase().includes(query.toLowerCase())
          )
          .map(cmd => ({
            id: cmd.id,
            label: cmd.label,
            description: cmd.description
          }));
        resolve(filtered);
      }, 300);
    });
  };

  // Handle create endpoint option
  const handleCreateEndpoint = (query: string) => {
    setEndpointToCreate(query);
    setShowCreateEndpointModal(true);
  };

  // Handle endpoint created successfully
  const handleEndpointCreated = (endpointName: string) => {
    // Refresh available commands or update state as needed
    // For now, we'll just select the newly created endpoint
    onCommandChange(endpointName);
  };

  // Fetch data from real APIs
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch commands
        setLoadingData(prev => ({ ...prev, commands: true }));
        const commandsResponse = await fetch('/api/proxy/api/commands');
        const commandsData = await commandsResponse.json();
        const formattedCommands = commandsData.map((cmd: any) => ({
          id: cmd.name || cmd.id,
          label: cmd.name || cmd.id,
          description: cmd.description || `Method: ${cmd.method}`,
          type: 'command' as const,
          value: cmd.name || cmd.id
        }));
        setCommands(formattedCommands);
        setLoadingData(prev => ({ ...prev, commands: false }));
        
        // Fetch flow definitions
        setLoadingData(prev => ({ ...prev, flows: true }));
        const flowsResponse = await fetch('/api/proxy/api/flow-definitions');
        const flowsData = await flowsResponse.json();
        const formattedFlows = flowsData.map((flow: any) => ({
          id: flow.id,
          label: flow.name || flow.id,
          description: flow.description || `Flow ID: ${flow.id}`,
          type: 'flow' as const,
          value: flow.id
        }));
        setFlows(formattedFlows);
        setLoadingData(prev => ({ ...prev, flows: false }));
        
        // Fetch flow steps for current flow
        if (flowValue) {
          setLoadingData(prev => ({ ...prev, steps: true }));
          const stepsResponse = await fetch(`/api/proxy/api/flow-steps?flow_id=${flowValue}`);
          const stepsData = await stepsResponse.json();
          const formattedSteps = stepsData.map((step: any) => ({
            id: step.id,
            label: step.name || step.id,
            description: step.description || `Step in flow: ${flowValue}`,
            type: 'step' as const,
            value: step.id
          }));
          setSteps(formattedSteps);
          setLoadingData(prev => ({ ...prev, steps: false }));
        }
        
        // Fetch flow runs for current flow
        if (flowValue) {
          setLoadingData(prev => ({ ...prev, flowruns: true }));
          const flowrunsResponse = await fetch(`/api/proxy/api/flow-runs?flow_id=${flowValue}&limit=10`);
          const flowrunsData = await flowrunsResponse.json();
          const formattedFlowruns = flowrunsData.map((run: any) => ({
            id: run.id,
            label: run.name || run.id,
            description: `Status: ${run.status}, Created: ${run.created_at}`,
            type: 'flowrun' as const,
            value: run.id
          }));
          setFlowruns(formattedFlowruns);
          setLoadingData(prev => ({ ...prev, flowruns: false }));
        }
      } catch (error) {
        console.error('Error fetching API data:', error);
        setLoadingData({
          commands: false,
          flows: false,
          steps: false,
          flowruns: false
        });
      }
    };
    
    fetchData();
  }, [flowValue]);

  // Utility function to extract {variable} patterns from strings
  const extractParams = (str: string): string[] => {
    if (!str) return [];
    const matches = str.match(/\{([^}]+)\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
  };

  // Fetch endpoint details when command is selected
  useEffect(() => {
    const fetchEndpointDetails = async () => {
      if (!selectedCommand) {
        setInputKeys([]);
        setOutputKeys([]);
        return;
      }

      setLoadingEndpoint(true);
      try {
        // STEP 1: Fetch both sources in parallel
        const [introspectResponse, endpointResponse] = await Promise.all([
          fetch(`/api/proxy/api/endpoints/introspect?endpoint_id=${encodeURIComponent(selectedCommand)}`),
          fetch(`/api/proxy/api/endpoints/${encodeURIComponent(selectedCommand)}`)
        ]);

        // STEP 2: Extract input keys (parameters) from endpoint config
        let inputKeys: string[] = [];
        if (endpointResponse.ok) {
          const endpointData = await endpointResponse.json();
          const endpoint = endpointData.data;
          
          // First, try to get request_keys from introspect response
          if (introspectResponse.ok) {
            const introspectData = await introspectResponse.json();
            console.log('Introspect request_keys check:', introspectData.data?.request_keys);
            if (introspectData.data?.request_keys && introspectData.data.request_keys.length > 0) {
              // Use request_keys from introspect endpoint
              inputKeys = introspectData.data.request_keys;
              console.log('Using request_keys from introspect:', inputKeys);
            } else {
              // Fall back to extracting from URL patterns and sample_request
              const urlParams = extractParams(endpoint.url || '');
              const queryParams = extractParams(endpoint.query_params || '');
              const bodyParams = extractParams(endpoint.body_template || '');
              
              // Also try to extract from sample_request if available
              let sampleRequestParams: string[] = [];
              if (endpoint.sample_request) {
                try {
                  // sample_request might be a JSON string that contains another JSON string
                  let sampleRequestStr = endpoint.sample_request;
                  // Remove outer quotes if present
                  if (sampleRequestStr.startsWith('"') && sampleRequestStr.endsWith('"')) {
                    sampleRequestStr = sampleRequestStr.slice(1, -1);
                  }
                  // Parse the JSON
                  const parsedRequest = JSON.parse(sampleRequestStr);
                  // If it's still a string, parse again
                  if (typeof parsedRequest === 'string') {
                    const innerParsed = JSON.parse(parsedRequest);
                    sampleRequestParams = Object.keys(innerParsed);
                  } else {
                    sampleRequestParams = Object.keys(parsedRequest);
                  }
                } catch (e) {
                  console.warn('Failed to parse sample_request:', e);
                }
              }
              
              // Combine and deduplicate
              inputKeys = [...new Set([...urlParams, ...queryParams, ...bodyParams, ...sampleRequestParams])];
            }
          } else {
            // If introspect fails, fall back to URL patterns only
            const urlParams = extractParams(endpoint.url || '');
            const queryParams = extractParams(endpoint.query_params || '');
            const bodyParams = extractParams(endpoint.body_template || '');
            inputKeys = [...new Set([...urlParams, ...queryParams, ...bodyParams])];
          }
          
          setInputKeys(inputKeys);
          
          // Initialize smartParams with input keys
          const initialParams = inputKeys.map(key => ({
            key,
            value: `{{${key}}}`
          }));
          setSmartParams(initialParams);
          
          // Update parent component with initial params
          initialParams.forEach((param, index) => {
            if (param.key) {
              onUpdateQueryParam(index, param.key, param.value);
            }
          });
        } else {
          console.error('Failed to fetch endpoint data:', endpointResponse.status);
          setInputKeys([]);
        }

        // STEP 3: Map output keys from introspect
        let outputKeys: string[] = [];
        if (introspectResponse.ok) {
          const introspectData = await introspectResponse.json();
          console.log('Introspect data:', introspectData);
          console.log('Introspect data.data:', introspectData.data);
          console.log('Introspect data.data?.response_keys:', introspectData.data?.response_keys);
          // Use response_keys from introspect endpoint
          outputKeys = introspectData.data?.response_keys || [];
          console.log('Output keys:', outputKeys);
          setOutputKeys(outputKeys);
        } else {
          console.error('Failed to fetch endpoint introspect:', introspectResponse.status);
          setOutputKeys([]);
        }

        // STEP 4: Normalize structure (for debugging/logging)
        const allKeys = [
          ...inputKeys.map(name => ({ name, direction: "input" as const })),
          ...outputKeys.map(name => ({ name, direction: "output" as const }))
        ];
        console.log('Endpoint keys loaded:', allKeys);

      } catch (error) {
        console.error('Error fetching endpoint details:', error);
        setInputKeys([]);
        setOutputKeys([]);
      } finally {
        setLoadingEndpoint(false);
      }
    };

    fetchEndpointDetails();
  }, [selectedCommand]);

  // Backend will provide endpoint metadata including parameters and variables

  return (
    <div className="node-popup-collapsible-section">
      <div 
        className="node-popup-section-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span>{title}</span>
        <span className="node-popup-collapse-icon">
          {isCollapsed ? '▶' : '▼'}
        </span>
      </div>
      
      <div className={`node-popup-collapsible-content ${isCollapsed ? 'collapsed' : ''}`}>
        {/* DROPLIST with endpoint - full width */}
        <div className="node-popup-dropdown-row">
          <SearchableDropdown
            value={selectedCommand}
            onChange={onCommandChange}
            placeholder={`select endpoint to call for ${type}`}
            searchPlaceholder="Search endpoints..."
            onSearch={searchEndpoints}
            options={commands}
            loading={loadingData.commands}
            onCreateOption={handleCreateEndpoint}
            showCreateOption={true}
          />
        </div>

        {/* ========== ENDPOINT PARAMETERS ========== */}
        {selectedCommand && inputKeys.length > 0 && (
          <div className="node-popup-query-params">
            <div className="node-popup-query-header">
              <div className="text-xs text-gray-400 mb-1 font-thin">
                {loadingEndpoint ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⟳</span>
                    Loading endpoint parameters...
                  </span>
                ) : (
                  `Endpoint Parameters (${inputKeys.length} from endpoint)`
                )}
              </div>
              <button 
                onClick={handleAddParameter}
                className="node-popup-icon-btn"
                title="Add parameter"
              >
                +
              </button>
            </div>
            
            {loadingEndpoint ? (
              <div className="text-xs text-gray-500 italic py-2">
                Loading parameters from endpoint...
              </div>
            ) : (
              <>
                {smartParams.map((param, index) => (
                  <div key={index} className="node-popup-query-row">
                    <input
                      type="text"
                      value={param.key}
                      onChange={(e) => handleParameterChange(index, 'key', e.target.value)}
                      onBlur={() => handleParameterBlur(index)}
                      placeholder="parameter name"
                      className="node-popup-query-key"
                    />
                    <input
                      type="text"
                      value={param.value}
                      onChange={(e) => handleParameterChange(index, 'value', e.target.value)}
                      onBlur={() => handleParameterBlur(index)}
                      placeholder="value"
                      className="node-popup-query-value"
                    />
                    <button
                      onClick={() => {
                        const newParams = smartParams.filter((_, i) => i !== index);
                        setSmartParams(newParams);
                        onRemoveQueryParam(index);
                      }}
                      className="node-popup-icon-btn"
                      title="Remove parameter"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ========== VARIABLES SECTION ========== */}
        {selectedCommand && (
          <div className="node-popup-tags-section">
            <div className="text-xs text-gray-400 mb-1 font-thin">
              {loadingEndpoint ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⟳</span>
                  Loading endpoint variables...
                </span>
              ) : (
                `Available variables (${outputKeys.length} from endpoint):`
              )}
            </div>
            <div className="node-popup-tags-wrapper">
              {loadingEndpoint ? (
                <div className="text-xs text-gray-500 italic">
                  Loading variables from endpoint...
                </div>
              ) : outputKeys.length > 0 ? (
                outputKeys.map(variable => (
                  <div 
                    key={variable}
                    className="node-popup-var-tag"
                    draggable
                    onDragStart={(e) => onVariableDragStart(e, variable)}
                    title={`{{${variable}}} - Drag into text`}
                  >
                    {variable}
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-500 italic">
                  No variables available from this endpoint
                </div>
              )}
            </div>
          </div>
        )}




      </div>

      {/* Create Endpoint Modal */}
      <CreateEndpointModal
        isOpen={showCreateEndpointModal}
        onClose={() => setShowCreateEndpointModal(false)}
        endpointName={endpointToCreate}
        onEndpointCreated={handleEndpointCreated}
      />
    </div>
  );
}