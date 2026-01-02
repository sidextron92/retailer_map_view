'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useFilterStore } from '@/store/filterStore';

export function SearchFilter() {
  const { searchQuery, setSearchQuery } = useFilterStore();
  const [localValue, setLocalValue] = useState(searchQuery);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, setSearchQuery]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Search</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by name, address..."
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          className="pl-10"
        />
      </div>
      {localValue && (
        <p className="text-xs text-gray-500">
          Searching for "{localValue}"
        </p>
      )}
    </div>
  );
}
