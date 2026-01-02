'use client';

import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFilterStore } from '@/store/filterStore';
import { getActiveFilterCount } from '@/lib/utils/filters';
import { CategoryFilter } from './CategoryFilter';
import { StatusFilter } from './StatusFilter';
import { SearchFilter } from './SearchFilter';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FilterPanel({ isOpen, onClose }: FilterPanelProps) {
  const filters = useFilterStore();
  const activeCount = getActiveFilterCount(filters);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        onClick={onClose}
      />

      {/* Filter Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm transform bg-white shadow-xl transition-transform duration-300 ease-in-out md:w-96 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
              {activeCount > 0 && (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-medium text-white">
                  {activeCount}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-gray-100"
              aria-label="Close filters"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Filter Content - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              {/* Search Filter */}
              <SearchFilter />

              {/* Category Filter */}
              <CategoryFilter />

              {/* Status Filters */}
              <StatusFilter />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t px-6 py-4">
            <Button
              onClick={() => filters.resetFilters()}
              variant="outline"
              className="w-full"
              disabled={activeCount === 0}
            >
              Reset All Filters
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
