'use client';

import { useState, useEffect } from 'react';
import SearchableDropdown from './ui/SearchableDropdown';
import IntelligentTextarea from './ui/IntelligentTextarea';

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
}

interface EndpointMetadata {
  parameters: Array<{ name: string; type: string; required: boolean }>;
  variables: Array<{ name: string; description: string }>;
}

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
  defaultCollapsed = true
}: FlowSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [endpointMetadata, setEndpointMetadata] = useState<EndpointMetadata | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [smartParams, setSmartParams] = useState(queryParams);
  
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

  const flowOptions = ['main_pipeline', 'data_processing', 'etl_job', 'analytics_flow'];
  const stepOptions = ['process_data', 'validate_input', 'transform_results', 'load_final'];
  const flowrunOptions = ['daily_run_001', 'nightly_batch', 'manual_trigger', 'scheduled_flow'];
  const variables = ['command_output', 'flow_id', 'step_id', 'user_input', 'timestamp'];

  // Conditional rendering flags
  const showParameters = selectedCommand && !loadingMetadata;
  const showVariables = selectedCommand && endpointMetadata?.variables;

  // Fetch endpoint metadata when command changes
  useEffect(() => {
    if (selectedCommand) {
      setLoadingMetadata(true);
      // Simulate API call - in production, fetch from /api/commands/{name}/metadata
      setTimeout(() => {
        const mockMetadata: EndpointMetadata = {
          parameters: [
            { name: 'limit', type: 'number', required: false },
            { name: 'offset', type: 'number', required: false },
            { name: 'status', type: 'string', required: false },
            { name: 'priority', type: 'string', required: false }
          ],
          variables: [
            { name: 'command_output', description: 'Output from the command' },
            { name: 'flow_id', description: 'Current flow ID' },
            { name: 'step_id', description: 'Current step ID' }
          ]
        };
        setEndpointMetadata(mockMetadata);
        setLoadingMetadata(false);
      }, 500);
    } else {
      setEndpointMetadata(null);
      setLoadingMetadata(false);
    }
  }, [selectedCommand]);

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
    // Simulate API search - in production, fetch from /api/commands?search=...
    return new Promise<Array<{ id: string; label: string; description?: string }>>((resolve) => {
      setTimeout(() => {
        const filtered = availableCommands
          .filter(cmd => 
            cmd.name.toLowerCase().includes(query.toLowerCase()) ||
            cmd.method.toLowerCase().includes(query.toLowerCase())
          )
          .map(cmd => ({
            id: cmd.name,
            label: `${cmd.name} (${cmd.method})`,
            description: `Endpoint method: ${cmd.method}`
          }));
        resolve(filtered);
      }, 300);
    });
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

  // Fetch endpoint metadata from real API
  useEffect(() => {
    const fetchEndpointMetadata = async () => {
      if (!selectedCommand) {
        setEndpointMetadata(null);
        return;
      }
      
      setLoadingMetadata(true);
      try {
        // Fetch command metadata
        const response = await fetch(`/api/proxy/api/commands/${selectedCommand}`);
        const data = await response.json();
        
        // Extract parameters and variables from metadata
        const parameters = data.parameters || data.query_params || [];
        const variables = data.variables || [];
        
        setEndpointMetadata({
          parameters: parameters.map((p: any) => ({
            name: p.name || p.key,
            type: p.type || 'string',
            required: p.required || false
          })),
          variables: variables.map((v: any) => ({
            name: v.name || v,
            description: v.description || `Variable: ${v.name || v}`
          }))
        });
      } catch (error) {
        console.error('Error fetching endpoint metadata:', error);
        // Fallback to mock data
        setEndpointMetadata({
          parameters: [
            { name: 'limit', type: 'number', required: false },
            { name: 'offset', type: 'number', required: false },
            { name: 'sort', type: 'string', required: false }
          ],
          variables: [
            { name: 'command_output', description: 'Output from the command' },
            { name: 'flow_id', description: 'Current flow ID' },
            { name: 'step_id', description: 'Current step ID' }
          ]
        });
      } finally {
        setLoadingMetadata(false);
      }
    };
    
    fetchEndpointMetadata();
  }, [selectedCommand]);

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
        {/* FLOW, STEP, FLOWRUN with text labels and searchable autocomplete */}
        <div className="node-popup-inline-params node-popup-row">
          <div className="node-popup-labeled-input">
            <span className="label-text">flow</span>
            <input 
              type="text" 
              value={flowValue}
              onChange={(e) => onFlowChange(e.target.value)}
              list={`${type}-flowOptions`}
              placeholder="search..."
              className="node-popup-input"
            />
            <datalist id={`${type}-flowOptions`}>
              {flowOptions.map(option => <option key={option} value={option} />)}
            </datalist>
          </div>
          <div className="node-popup-labeled-input">
            <span className="label-text">step</span>
            <input 
              type="text" 
              value={stepValue}
              onChange={(e) => onStepChange(e.target.value)}
              list={`${type}-stepOptions`}
              placeholder="search..."
              className="node-popup-input"
            />
            <datalist id={`${type}-stepOptions`}>
              {stepOptions.map(option => <option key={option} value={option} />)}
            </datalist>
          </div>
          <div className="node-popup-labeled-input">
            <span className="label-text">flowrun</span>
            <input 
              type="text" 
              value={flowrunValue}
              onChange={(e) => onFlowrunChange(e.target.value)}
              list={`${type}-flowrunOptions`}
              placeholder="search..."
              className="node-popup-input"
            />
            <datalist id={`${type}-flowrunOptions`}>
              {flowrunOptions.map(option => <option key={option} value={option} />)}
            </datalist>
          </div>
        </div>

        {/* DROPLIST with endpoint + dark icon */}
        <div className="node-popup-dropdown-row">
          <div className="flex-1">
            <SearchableDropdown
              value={selectedCommand}
              onChange={onCommandChange}
              placeholder={`select endpoint to call for ${type}`}
              searchPlaceholder="Search endpoints..."
              onSearch={searchEndpoints}
              options={availableCommands.map(cmd => ({
                id: cmd.name,
                label: `${cmd.name} (${cmd.method})`,
                description: `Endpoint method: ${cmd.method}`
              }))}
              loading={loadingCommands}
            />
          </div>
          <button
            onClick={onAddCommand}
            className="node-popup-icon-btn"
            title="Add new command"
          >
            +
          </button>
          <button 
            onClick={onShowSample}
            className="node-popup-icon-btn" 
            title="sample response"
          >
            📋
          </button>
        </div>

        {/* ========== QUERY PARAMETERS ========== */}
        {showParameters ? (
          <div className="node-popup-query-params">
            <div className="node-popup-query-header">
              <div className="text-xs text-gray-400 mb-1 font-thin">
                Query Parameters {loadingMetadata && '(loading...)'}
              </div>
              <button 
                onClick={handleAddParameter}
                className="node-popup-icon-btn"
                title="Add parameter"
              >
                +
              </button>
            </div>
            
            {loadingMetadata ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-2">
                    <div className="flex-1 h-8 bg-gray-800 rounded animate-pulse"></div>
                    <div className="flex-1 h-8 bg-gray-800 rounded animate-pulse"></div>
                    <div className="w-8 h-8 bg-gray-800 rounded animate-pulse"></div>
                  </div>
                ))}
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
                      placeholder="key"
                      className="node-popup-query-key"
                      list={`${type}-paramSuggestions`}
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
                <datalist id={`${type}-paramSuggestions`}>
                  {endpointMetadata?.parameters.map(param => (
                    <option key={param.name} value={param.name}>
                      {param.name} ({param.type}{param.required ? ', required' : ''})
                    </option>
                  ))}
                </datalist>
              </>
            )}
          </div>
        ) : (
          selectedCommand && (
            <div className="text-xs text-gray-400 py-2">
              Loading endpoint metadata...
            </div>
          )
        )}

        {/* ========== VARIABLES SECTION ========== */}
        {showVariables ? (
          <div className="node-popup-tags-section">
            <div className="text-xs text-gray-400 mb-1 font-thin">
              available variables:
            </div>
            <div className="node-popup-tags-wrapper">
              {endpointMetadata?.variables.map(variable => (
                <div 
                  key={variable.name}
                  className="node-popup-var-tag"
                  draggable
                  onDragStart={(e) => onVariableDragStart(e, variable.name)}
                  title={`${variable.description} - Drag into text`}
                >
                  {variable.name}
                </div>
              ))}
            </div>
          </div>
        ) : (
          selectedCommand && !loadingMetadata && (
            <div className="text-xs text-gray-400 py-2">
              No variables available for this endpoint
            </div>
          )
        )}




      </div>
    </div>
  );
}