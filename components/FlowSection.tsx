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
  availableCommands: Array<{ id: string; name: string; method: string }>;
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
  onEditCommand?: (commandId: string) => void;
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
}`,
  onEditCommand
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

  // Debug outputKeys changes
  useEffect(() => {
    console.log('outputKeys changed:', outputKeys, 'length:', outputKeys.length);
  }, [outputKeys]);

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
  // Note: We removed the useEffect that was causing state synchronization issues
  // Parameters now flow unidirectionally: child updates parent via callbacks
  // Parent is responsible for managing queryParams as source of truth

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
    // Use availableCommands prop from parent component (flow design page)
    return new Promise<Array<{ id: string; label: string; description?: string }>>((resolve) => {
      setTimeout(() => {
        const filtered = availableCommands
          .filter(cmd => 
            cmd.name.toLowerCase().includes(query.toLowerCase()) ||
            cmd.method?.toLowerCase().includes(query.toLowerCase())
          )
          .map(cmd => ({
            id: cmd.id || cmd.name,  // Use id if available, fallback to name
            label: cmd.name,
            description: `Method: ${cmd.method}`
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
        // Note: Commands are now provided via availableCommands prop from parent component
        // The flow design page fetches commands and passes them as availableCommands
        
        // Fetch flow definitions
        setLoadingData(prev => ({ ...prev, flows: true }));
        const flowsResponse = await fetch('/api/proxy/api/flow-definitions');
        const flowsData = await flowsResponse.json();
        const formattedFlows = (flowsData.data || []).map((flow: any) => ({
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
          const formattedSteps = (stepsData.data || []).map((step: any) => ({
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
          const formattedFlowruns = (flowrunsData.data || []).map((run: any) => ({
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
    const abortController = new AbortController();
    let isCurrent = true;

    const fetchEndpointDetails = async () => {
      if (!selectedCommand) {
        setInputKeys([]);
        // Don't clear outputKeys - keep previous if available
        return;
      }

      setLoadingEndpoint(true);
      try {
        // STEP 1: Fetch both sources in parallel with abort signal
        const [introspectResponse, endpointResponse] = await Promise.all([
          fetch(`/api/proxy/api/endpoints/introspect?endpoint_id=${encodeURIComponent(selectedCommand)}`, {
            signal: abortController.signal
          }),
          fetch(`/api/proxy/api/endpoints/${encodeURIComponent(selectedCommand)}`, {
            signal: abortController.signal
          })
        ]);

        // Check if this request is still relevant
        if (!isCurrent) return;

        // STEP 2: Combined extraction of request and response keys
        let inputKeys: string[] = [];
        let outputKeys: string[] = [];

        if (introspectResponse.ok) {
          const introspectData = await introspectResponse.json();
          
          // Extract request_keys for input parameters
          inputKeys = introspectData.data?.request_keys || [];
          
          // Extract response_keys for available variables
          outputKeys = introspectData.data?.response_keys || [];
          
          // Check if keys look like endpoint metadata
          // Endpoint metadata typically includes: id, name, description, method, url
          // If we see all or most of these together, they're likely metadata
          const commonMetadataFields = ['id', 'name', 'description', 'method', 'url'];
          
          // Check response_keys for metadata
          const outputMetadataCount = outputKeys.filter(key => commonMetadataFields.includes(key)).length;
          
          // If we have at least 3 of the common metadata fields in response_keys, assume it's metadata
          // and filter them all out
          if (outputMetadataCount >= 3) {
            console.log('Detected metadata fields in response_keys, filtering them out');
            outputKeys = outputKeys.filter(key => !commonMetadataFields.includes(key));
          } else {
            // Otherwise, only filter out fields that are definitely metadata
            // 'method' and 'url' are almost always endpoint metadata, not response data
            const definiteMetadataFields = ['method', 'url'];
            outputKeys = outputKeys.filter(key => !definiteMetadataFields.includes(key));
          }
          
          // Check request_keys for metadata
          const inputMetadataCount = inputKeys.filter(key => commonMetadataFields.includes(key)).length;
          
          // If we have at least 3 of the common metadata fields in request_keys, assume it's metadata
          // and filter them all out
          if (inputMetadataCount >= 3) {
            console.log('Detected metadata fields in request_keys, filtering them out');
            inputKeys = inputKeys.filter(key => !commonMetadataFields.includes(key));
          } else {
            // Otherwise, only filter out fields that are definitely metadata
            // 'method' and 'url' are almost always endpoint metadata, not request parameters
            const definiteMetadataFields = ['method', 'url'];
            inputKeys = inputKeys.filter(key => !definiteMetadataFields.includes(key));
          }
          
          console.log('Introspect data received:', {
            request_keys: inputKeys,
            response_keys: outputKeys,
            success: introspectData.success
          });
        } else {
          console.error('Failed to fetch endpoint introspect:', introspectResponse.status);
          // Don't clear existing keys on partial failure
        }

        // STEP 3: Fallback for input keys if introspect didn't provide them or provided incomplete list
        if (endpointResponse.ok) {
          const endpointData = await endpointResponse.json();
          const endpoint = endpointData.data;
          
          // Always extract parameters from endpoint data to ensure we get all possible parameters
          const urlParams = extractParams(endpoint.url || '');
          const queryParams = extractParams(endpoint.query_params || '');
          const bodyParams = extractParams(endpoint.body_template || '');
          
          // Also try to extract from sample_request if available
          let sampleRequestParams: string[] = [];
          if (endpoint.sample_request) {
            try {
              // sample_request might be a JSON string that contains another JSON string
              let sampleRequestStr = endpoint.sample_request;
              console.log('Original sample_request string:', sampleRequestStr);
              
              // Try different parsing strategies
              let parsedRequest: any = null;
              
              // Strategy 1: Try to parse directly
              try {
                parsedRequest = JSON.parse(sampleRequestStr);
                console.log('Strategy 1: Direct parse succeeded:', parsedRequest, 'type:', typeof parsedRequest);
              } catch (e1) {
                console.log('Strategy 1 failed, trying strategy 2...');
                
                // Strategy 2: Remove outer quotes and try again
                if (sampleRequestStr.startsWith('"') && sampleRequestStr.endsWith('"')) {
                  const withoutOuterQuotes = sampleRequestStr.slice(1, -1);
                  console.log('After removing outer quotes:', withoutOuterQuotes);
                  
                  try {
                    parsedRequest = JSON.parse(withoutOuterQuotes);
                    console.log('Strategy 2: Parse after removing outer quotes succeeded:', parsedRequest, 'type:', typeof parsedRequest);
                  } catch (e2) {
                    console.log('Strategy 2 failed, trying strategy 3...');
                    
                    // Strategy 3: Try to fix escaped JSON (replace \" with ")
                    // This handles cases like {\"userId\": 123}
                    const fixedStr = withoutOuterQuotes.replace(/\\"/g, '"');
                    console.log('After fixing escaped quotes:', fixedStr);
                    
                    try {
                      parsedRequest = JSON.parse(fixedStr);
                      console.log('Strategy 3: Parse after fixing escaped quotes succeeded:', parsedRequest, 'type:', typeof parsedRequest);
                    } catch (e3) {
                      console.log('Strategy 3 failed, giving up.');
                      throw new Error('All parsing strategies failed');
                    }
                  }
                } else {
                  // No outer quotes, try strategy 3 directly
                  const fixedStr = sampleRequestStr.replace(/\\"/g, '"');
                  console.log('After fixing escaped quotes:', fixedStr);
                  
                  try {
                    parsedRequest = JSON.parse(fixedStr);
                    console.log('Strategy 3 (no outer quotes): Parse after fixing escaped quotes succeeded:', parsedRequest, 'type:', typeof parsedRequest);
                  } catch (e3) {
                    console.log('Strategy 3 failed, giving up.');
                    throw new Error('All parsing strategies failed');
                  }
                }
              }
              
              // If we successfully parsed something, extract keys
              if (parsedRequest) {
                // If it's still a string, parse again (nested JSON string)
                if (typeof parsedRequest === 'string') {
                  console.log('Parsed request is still a string, parsing again...');
                  try {
                    const innerParsed = JSON.parse(parsedRequest);
                    sampleRequestParams = Object.keys(innerParsed);
                    console.log('Inner parsed keys:', sampleRequestParams);
                  } catch (innerError) {
                    console.warn('Failed to parse inner JSON string:', innerError);
                  }
                } else {
                  sampleRequestParams = Object.keys(parsedRequest);
                  console.log('Direct parsed keys:', sampleRequestParams);
                }
              }
            } catch (e) {
              console.warn('Failed to parse sample_request:', e, 'sample_request:', endpoint.sample_request);
            }
          }
          
          console.log('Extracted params from endpoint:', {
            urlParams,
            queryParams,
            bodyParams,
            sampleRequestParams,
            introspectKeys: inputKeys
          });
          
          // Combine all extracted parameters with introspect keys and deduplicate
          const allExtractedParams = [...new Set([...urlParams, ...queryParams, ...bodyParams, ...sampleRequestParams])];
          
          // If introspect didn't provide any keys, use extracted params
          if (inputKeys.length === 0) {
            inputKeys = allExtractedParams;
            console.log('Using fallback extracted params (no introspect keys):', inputKeys);
          } else {
            // Otherwise, combine introspect keys with extracted params
            // This ensures we have all parameters even if introspect missed some
            inputKeys = [...new Set([...inputKeys, ...allExtractedParams])];
            console.log('Combined introspect keys with extracted params:', inputKeys);
          }
        }

        // STEP 4: Set state only if this is still the current request
        if (isCurrent) {
          setInputKeys(inputKeys);
          setOutputKeys(outputKeys);
          
          // Initialize smartParams with input keys
          const initialParams = inputKeys.map(key => ({
            key,
            value: ''  // Empty value instead of ƐĐᜃ${key}
          }));
          setSmartParams(initialParams);
          
          // Update parent component with initial params
          initialParams.forEach((param, index) => {
            if (param.key) {
              onUpdateQueryParam(index, param.key, param.value);
            }
          });
          
          console.log('State updated:', {
            inputKeys,
            outputKeys,
            inputCount: inputKeys.length,
            outputCount: outputKeys.length
          });
        }

      } catch (error) {
        if (error instanceof Error || error instanceof DOMException) {
          if (error.name === 'AbortError') {
            console.log('Fetch aborted for new endpoint selection');
            return; // Ignore abort errors
          }
        }
        console.error('Error fetching endpoint details:', error);
        // Don't clear keys on error - preserve existing state
      } finally {
        if (isCurrent) {
          setLoadingEndpoint(false);
        }
      }
    };

    fetchEndpointDetails();

    // Cleanup function
    return () => {
      isCurrent = false;
      abortController.abort();
    };
  }, [selectedCommand]);

  // Backend will provide endpoint metadata including parameters and variables
  console.log('FlowSection render - outputKeys:', outputKeys, 'length:', outputKeys.length, 'selectedCommand:', selectedCommand);

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
            options={availableCommands.map(cmd => ({
              id: cmd.name,
              label: cmd.name,
              description: `Method: ${cmd.method}`
            }))}
            loading={loadingCommands}
            onCreateOption={handleCreateEndpoint}
            showCreateOption={true}
            onEditOption={onEditCommand}
            showEditOption={!!onEditCommand}
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
                    title={`ƐĐᜃ${variable}ƐĐᜃ - Drag into text`}
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