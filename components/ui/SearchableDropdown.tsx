'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';

interface SearchableDropdownProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  onSearch?: (query: string) => Promise<Array<{ id: string; label: string; description?: string }>>;
  options?: Array<{ id: string; label: string; description?: string }>;
  loading?: boolean;
  disabled?: boolean;
  onCreateOption?: (query: string) => void;
  showCreateOption?: boolean;
  onEditOption?: (optionId: string) => void;
  showEditOption?: boolean;
}

export default function SearchableDropdown({
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  onSearch,
  options: initialOptions = [],
  loading = false,
  disabled = false,
  onCreateOption,
  showCreateOption = false,
  onEditOption,
  showEditOption = false
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(initialOptions);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredOptions(initialOptions);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = initialOptions.filter(option =>
        option.label.toLowerCase().includes(query) ||
        option.description?.toLowerCase().includes(query) ||
        option.id.toLowerCase().includes(query)
      );
      setFilteredOptions(filtered);
    }
    setSelectedIndex(-1);
  }, [searchQuery, initialOptions]);

  // Handle external search
  useEffect(() => {
    if (onSearch && searchQuery.trim() && isOpen) {
      setIsSearching(true);
      onSearch(searchQuery)
        .then(results => {
          setFilteredOptions(results);
          setIsSearching(false);
        })
        .catch(() => {
          setIsSearching(false);
        });
    }
  }, [searchQuery, isOpen, onSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setSelectedIndex(0);
      }
      return;
    }

    const showCreate = showCreateOption && onCreateOption && searchQuery.trim() && filteredOptions.length === 0;
    const totalOptions = showCreate ? 1 : filteredOptions.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < totalOptions - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : totalOptions - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (showCreate && selectedIndex === 0) {
            // Create option selected
            onCreateOption(searchQuery);
            setSearchQuery('');
            setIsOpen(false);
          } else if (selectedIndex < filteredOptions.length) {
            // Regular option selected
            const selectedOption = filteredOptions[selectedIndex];
            onChange(selectedOption.id);
            setSearchQuery('');
            setIsOpen(false);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleOptionClick = (optionId: string) => {
    onChange(optionId);
    setSearchQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleEditClick = (e: React.MouseEvent, optionId: string) => {
    e.stopPropagation(); // Prevent option click
    if (onEditOption) {
      onEditOption(optionId);
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  const handleCreateClick = () => {
    if (onCreateOption && searchQuery.trim()) {
      onCreateOption(searchQuery);
      setSearchQuery('');
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  const selectedOption = initialOptions.find(opt => opt.id === value);

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchQuery : (selectedOption?.label || value || '')}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
              setSearchQuery('');
            }
          }}
          onBlur={(e) => {
            // Check if the blur is caused by clicking on the dropdown itself
            const relatedTarget = e.relatedTarget as HTMLElement;
            const isClickingDropdown = relatedTarget && containerRef.current?.contains(relatedTarget);
            
            // Get the current input value
            const inputValue = e.target.value;
            
            // If user cleared the field (input is empty) and not clicking dropdown, clear the selection
            if (inputValue === '' && value !== '' && !isClickingDropdown) {
              onChange('');
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={isOpen ? searchPlaceholder : placeholder}
          disabled={disabled}
          className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white text-sm font-thin focus:border-gray-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {/* Clear button (X) when there's a value and dropdown is not open */}
        {value && !isOpen && !disabled && (
          <button
            type="button"
            className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white focus:outline-none"
            onClick={() => onChange('')}
            aria-label="Clear selection"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
          {loading || isSearching ? (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div>
              {showCreateOption && onCreateOption && searchQuery.trim() ? (
                <ul>
                  <li
                    className={`px-3 py-2 cursor-pointer text-sm ${
                      selectedIndex === 0
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                    onClick={handleCreateClick}
                    onMouseEnter={() => setSelectedIndex(0)}
                  >
                    <div className="font-medium flex items-center">
                      <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create endpoint: "{searchQuery}"
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">Create a new endpoint with this name</div>
                  </li>
                </ul>
              ) : (
                <div className="px-3 py-2 text-gray-400 text-sm">
                  {isSearching ? 'Searching...' : 'No options found'}
                </div>
              )}
            </div>
          ) : (
            <ul>
              {filteredOptions.map((option, index) => (
                <li
                  key={option.id}
                  className={`px-3 py-2 cursor-pointer text-sm group ${
                    index === selectedIndex
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                  onClick={() => handleOptionClick(option.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-gray-400 mt-0.5">{option.description}</div>
                      )}
                    </div>
                    {showEditOption && onEditOption && (
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 text-gray-400 hover:text-white focus:outline-none"
                        onClick={(e) => handleEditClick(e, option.id)}
                        aria-label={`Edit ${option.label}`}
                        title={`Edit ${option.label}`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}