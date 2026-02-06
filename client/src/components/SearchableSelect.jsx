import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

const SearchableSelect = ({
    options,
    value,
    onChange,
    onNext,
    placeholder,
    label,
    autoFocus = false,
    inputRef
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const wrapperRef = useRef(null);
    const internalInputRef = useRef(null);
    const listRef = useRef(null);

    // Use provided ref or internal one
    const ref = inputRef || internalInputRef;

    useEffect(() => {
        // Sync search term with selected value label if available
        if (value) {
            const selectedOption = options.find(opt => opt.value === value || opt.label === value);
            if (selectedOption) {
                setSearchTerm(selectedOption.label);
            }
        } else {
            setSearchTerm('');
        }
    }, [value, options]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const filteredOptions = options.filter(option =>
        (option.label || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev =>
                prev < filteredOptions.length - 1 ? prev + 1 : prev
            );
            // Scroll into view logic could be added here
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (isOpen && filteredOptions.length > 0) {
                selectOption(filteredOptions[highlightedIndex]);
            } else {
                // If closed or no options, just move next
                if (onNext) onNext();
            }
        } else if (e.key === 'Tab') {
            if (isOpen && filteredOptions.length > 0) {
                e.preventDefault(); // Prevent default tab behavior initially
                selectOption(filteredOptions[highlightedIndex]);
                // Focus next field manually after selection
                if (onNext) setTimeout(onNext, 0);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const selectOption = (option) => {
        onChange(option);
        setSearchTerm(option.label);
        setIsOpen(false);
        if (onNext) onNext();
    };

    return (
        <div className="space-y-2 relative" ref={wrapperRef}>
            {label && <label className="block text-sm font-semibold text-gray-700">{label}</label>}
            <div className="relative">
                <input
                    ref={ref}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                        setHighlightedIndex(0);
                        // Clear selection if user types something new
                        if (value && e.target.value !== options.find(o => o.value === value)?.label) {
                            // Optional: clear parent value if strict selection needed
                            // onChange(null); 
                        }
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none pr-10"
                />
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />

                {isOpen && filteredOptions.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto" ref={listRef}>
                        {filteredOptions.map((option, index) => (
                            <div
                                key={option.value || index}
                                onClick={() => selectOption(option)}
                                className={`p-3 cursor-pointer border-b border-gray-50 last:border-0 ${index === highlightedIndex ? 'bg-emerald-100 text-emerald-900' : 'hover:bg-emerald-50 text-gray-800'
                                    }`}
                            >
                                <div className="font-medium">{option.label}</div>
                                {option.subLabel && <div className="text-xs text-gray-500">{option.subLabel}</div>}
                            </div>
                        ))}
                    </div>
                )}
                {isOpen && filteredOptions.length === 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-gray-500 text-sm text-center">
                        No matches found
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchableSelect;
