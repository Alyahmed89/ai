'use client';

import React, { useState, useEffect, useRef, KeyboardEvent, ChangeEvent } from 'react';
import CommandPalette from './CommandPalette';
import { IntelligentTextareaProps, CommandItem } from '@/types';

const IntelligentTextarea: React.FC<IntelligentTextareaProps> = ({
  value,
  onChange,
  placeholder = 'Type / for commands or # for variables...',
  className = '',
  commands = [],
  variables = [],
  flows = [],
  steps = [],
  flowruns = [],
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [palettePosition, setPalettePosition] = useState({ x: 0, y: 0 });
  const [triggerType, setTriggerType] = useState<'/' | '#' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Debug: log when component mounts
  useEffect(() => {
    console.log('IntelligentTextarea mounted with props:', {
      value,
      placeholder,
      variablesCount: variables.length,
      commandsCount: commands.length,
      flowsCount: flows.length,
      stepsCount: steps.length,
      flowrunsCount: flowruns.length
    });
  }, []);

  // Get items based on trigger type
  const getItemsByTrigger = (): CommandItem[] => {
    switch (triggerType) {
      case '/':
        return [
          ...commands,
          ...flows.map(f => ({ ...f, type: 'flow' as const })),
          ...steps.map(s => ({ ...s, type: 'step' as const })),
          ...flowruns.map(fr => ({ ...fr, type: 'flowrun' as const })),
        ];
      case '#':
        return variables;
      default:
        return [];
    }
  };

  // Handle textarea changes
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart;
    
    console.log('Textarea change:', { newValue, newCursorPos });
    
    onChange(newValue);
    setCursorPosition(newCursorPos);
    
    // Check for triggers
    checkForTriggers(newValue, newCursorPos);
  };

  // Check for / or # triggers
  const checkForTriggers = (text: string, cursorPos: number) => {
    // Get text before cursor
    const textBeforeCursor = text.substring(0, cursorPos);
    
    // Find the last trigger character
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');
    
    // Determine which trigger is more recent
    const maxIndex = Math.max(lastSlashIndex, lastHashIndex);
    
    if (maxIndex === -1) {
      // No trigger found
      setShowPalette(false);
      setTriggerType(null);
      setSearchQuery('');
      return;
    }
    
    // Get the trigger character
    const triggerChar = textBeforeCursor[maxIndex];
    
    // Check if there's a space before the trigger (shouldn't be in middle of word)
    const charBeforeTrigger = maxIndex > 0 ? textBeforeCursor[maxIndex - 1] : ' ';
    const isAtWordStart = /\s/.test(charBeforeTrigger) || maxIndex === 0;
    
    if (!isAtWordStart) {
      setShowPalette(false);
      setTriggerType(null);
      setSearchQuery('');
      return;
    }
    
    // Get search query (text after trigger)
    const query = textBeforeCursor.substring(maxIndex + 1);
    
    // Update state
    setTriggerType(triggerChar as '/' | '#');
    setSearchQuery(query);
    setSelectedIndex(0); // Reset selection when trigger changes
    
    // Calculate palette position
    calculatePalettePosition(maxIndex);
    
    // Get items based on trigger type (don't depend on state)
    let items: CommandItem[] = [];
    if (triggerChar === '/') {
      items = commands;
    } else if (triggerChar === '#') {
      items = [...variables, ...flows, ...steps, ...flowruns];
    }
    
    const filteredItems = items.filter(item => 
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.description?.toLowerCase().includes(query.toLowerCase())
    );
    
    console.log('Trigger detected:', {
      triggerChar,
      query,
      itemsCount: items.length,
      filteredCount: filteredItems.length,
      showPalette: filteredItems.length > 0,
      variables: variables.length
    });
    
    setShowPalette(filteredItems.length > 0);
  };

  // Calculate palette position based on cursor
  const calculatePalettePosition = (triggerIndex: number) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const textareaRect = textarea.getBoundingClientRect();
    
    // Simplified position - place palette below textarea
    const x = textareaRect.left;
    const y = textareaRect.bottom + 5;
    
    console.log('Palette position:', { x, y, textareaRect });
    
    setPalettePosition({ x, y });
  };

  // Handle palette item selection
  const handlePaletteSelect = (item: CommandItem) => {
    if (!textareaRef.current || !triggerType) return;
    
    const textarea = textareaRef.current;
    const currentValue = value;
    const cursorPos = cursorPosition;
    
    // Find the trigger position
    const textBeforeCursor = currentValue.substring(0, cursorPos);
    const triggerIndex = textBeforeCursor.lastIndexOf(triggerType);
    
    if (triggerIndex === -1) {
      setShowPalette(false);
      return;
    }
    
    // Replace from trigger to cursor with selected item value
    const beforeTrigger = currentValue.substring(0, triggerIndex);
    const afterCursor = currentValue.substring(cursorPos);
    const newValue = beforeTrigger + item.value + afterCursor;
    
    onChange(newValue);
    
    // Move cursor to after inserted text
    const newCursorPos = triggerIndex + item.value.length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = newCursorPos;
        textareaRef.current.selectionEnd = newCursorPos;
        textareaRef.current.focus();
      }
    }, 0);
    
    // Close palette
    setShowPalette(false);
    setTriggerType(null);
    setSearchQuery('');
  };

  // Handle keydown events for the textarea
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showPalette) {
      // Handle palette navigation
      const items = getItemsByTrigger();
      const filteredItems = items.filter(item => 
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => prev < filteredItems.length - 1 ? prev + 1 : 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : filteredItems.length - 1);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredItems.length > 0 && selectedIndex >= 0 && selectedIndex < filteredItems.length) {
          handlePaletteSelect(filteredItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowPalette(false);
        setTriggerType(null);
        setSearchQuery('');
        setSelectedIndex(0);
      } else {
        // Let other keys through
        return;
      }
    }
    
    // Handle backspace to remove trigger
    if (e.key === 'Backspace' && showPalette) {
      const textBeforeCursor = value.substring(0, cursorPosition);
      const lastTriggerIndex = Math.max(
        textBeforeCursor.lastIndexOf('/'),
        textBeforeCursor.lastIndexOf('#')
      );
      
      if (lastTriggerIndex !== -1 && cursorPosition === lastTriggerIndex + 1) {
        setShowPalette(false);
        setTriggerType(null);
        setSearchQuery('');
        setSelectedIndex(0);
      }
    }
  };

  // Handle textarea click
  const handleClick = () => {
    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart;
      setCursorPosition(cursorPos);
      checkForTriggers(value, cursorPos);
    }
  };

  // Handle textarea blur
  const handleBlur = () => {
    // Close palette after a short delay to allow palette clicks
    setTimeout(() => {
      setShowPalette(false);
    }, 200);
  };

  console.log('IntelligentTextarea render:', {
    showPalette,
    triggerType,
    searchQuery,
    palettePosition,
    value,
    variablesCount: variables.length
  });

  return (
    <>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`w-full min-h-[100px] p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y ${className}`}
        />
        
        {/* Trigger hint */}
        <div className="absolute bottom-2 right-2 text-xs text-gray-500">
          Type / or # for suggestions
        </div>
      </div>
      
      {/* Command palette */}
      {showPalette && (
        <div style={{
          position: 'fixed',
          left: `${palettePosition.x}px`,
          top: `${palettePosition.y}px`,
          zIndex: 9999,
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '0.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          maxHeight: '16rem',
          overflowY: 'auto',
          minWidth: '300px'
        }}>
          <div style={{ padding: '0.5rem', borderBottom: '1px solid #374151', fontSize: '0.75rem', color: '#9ca3af' }}>
            {triggerType === '/' ? 'Commands' : 'Variables'} - Press ↑↓ to navigate, Enter/Tab to select, Esc to close
          </div>
          <div style={{ padding: '0.25rem' }}>
            {getItemsByTrigger()
              .filter(item => 
                item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description?.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((item, index) => (
              <div
                key={item.id}
                style={{
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: index === selectedIndex ? '#2563eb' : 'transparent',
                  color: index === selectedIndex ? 'white' : '#e5e7eb'
                }}
                onClick={() => handlePaletteSelect(item)}
              >
                <div style={{ flexShrink: 0, width: '1.5rem', height: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.25rem', backgroundColor: '#374151' }}>
                  {item.type === 'command' && '⚡'}
                  {item.type === 'variable' && '#'}
                  {item.type === 'flow' && '📊'}
                  {item.type === 'step' && '🔧'}
                  {item.type === 'flowrun' && '🚀'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                  {item.description && (
                    <div style={{ fontSize: '0.75rem', color: index === 0 ? '#d1d5db' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.description}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'capitalize' }}>
                  {item.type}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default IntelligentTextarea;