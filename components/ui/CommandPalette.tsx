'use client';

import React, { useState, useEffect, useRef } from 'react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  type: 'command' | 'variable' | 'flow' | 'step' | 'flowrun';
  value: string;
}

interface CommandPaletteProps {
  items: CommandItem[];
  onSelect: (item: CommandItem) => void;
  onClose: () => void;
  position: { x: number; y: number };
  searchQuery: string;
  triggerType: '/' | '#' | null;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  items,
  onSelect,
  onClose,
  position,
  searchQuery,
  triggerType,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const paletteRef = useRef<HTMLDivElement>(null);

  // Filter items based on search query
  const filteredItems = items.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredItems.length - 1 ? prev + 1 : 0
          );
          break;
        
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredItems.length - 1
          );
          break;
        
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            onSelect(filteredItems[selectedIndex]);
          }
          break;
        
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        
        case 'Tab':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            onSelect(filteredItems[selectedIndex]);
          }
          break;
      }
    };

    // Add event listener only if the element exists
    const paletteElement = paletteRef.current;
    if (!paletteElement) return;

    paletteElement.addEventListener('keydown', handleKeyDown as EventListener);
    
    return () => {
      paletteElement.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [filteredItems, selectedIndex, onSelect, onClose]);

  // Focus the palette when it opens
  useEffect(() => {
    const paletteElement = paletteRef.current;
    if (paletteElement) {
      paletteElement.focus();
    }
  }, []);

  // Close palette when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const paletteElement = paletteRef.current;
      if (paletteElement && !paletteElement.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  console.log('CommandPalette render:', {
    showPalette: true,
    triggerType,
    searchQuery,
    filteredItemsCount: filteredItems.length,
    position
  });

  if (filteredItems.length === 0) {
    return (
      <div
        ref={paletteRef}
        className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          minWidth: '300px',
        }}
        tabIndex={0}
      >
        <div className="p-3 text-gray-400 text-sm">
          No {triggerType === '/' ? 'commands' : 'variables'} found for "{searchQuery}"
        </div>
      </div>
    );
  }

  return (
    <div
      ref={paletteRef}
      className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        minWidth: '300px',
      }}
      tabIndex={0}
    >
      <div className="p-2 border-b border-gray-700 text-xs text-gray-400">
        {triggerType === '/' ? 'Commands' : 'Variables'} - Press ↑↓ to navigate, Enter/Tab to select, Esc to close
      </div>
      
      <div className="py-1">
        {filteredItems.map((item, index) => (
          <div
            key={item.id}
            className={`px-3 py-2 cursor-pointer flex items-center gap-3 ${
              index === selectedIndex 
                ? 'bg-blue-600 text-white' 
                : 'hover:bg-gray-700 text-gray-200'
            }`}
            onClick={() => onSelect(item)}
          >
            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded bg-gray-700">
              {item.type === 'command' && '⚡'}
              {item.type === 'variable' && '#'}
              {item.type === 'flow' && '📊'}
              {item.type === 'step' && '🔧'}
              {item.type === 'flowrun' && '🚀'}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{item.label}</div>
              {item.description && (
                <div className="text-xs text-gray-400 truncate">
                  {item.description}
                </div>
              )}
            </div>
            
            <div className="text-xs text-gray-400 capitalize">
              {item.type}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommandPalette;