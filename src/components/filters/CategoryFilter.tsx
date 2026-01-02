'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { useFilterStore } from '@/store/filterStore';

const RETAILER_STATUSES = [
  { value: 'Active', label: 'Active', color: '#2ECC71' },
  { value: 'Idle', label: 'Idle', color: '#F39C12' },
  { value: 'Churn', label: 'Churn', color: '#E74C3C' },
];

export function CategoryFilter() {
  const { selectedCategories, toggleCategory } = useFilterStore();

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">Retailer Status</label>
      <div className="space-y-2">
        {RETAILER_STATUSES.map((status) => (
          <div key={status.value} className="flex items-center space-x-2">
            <Checkbox
              id={`status-${status.value}`}
              checked={selectedCategories.includes(status.value)}
              onCheckedChange={() => toggleCategory(status.value)}
            />
            <label
              htmlFor={`status-${status.value}`}
              className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-gray-700"
            >
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: status.color }}
              />
              {status.label}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
