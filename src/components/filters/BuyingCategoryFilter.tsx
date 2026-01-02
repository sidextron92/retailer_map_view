'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { useFilterStore } from '@/store/filterStore';

const BUYING_CATEGORIES = [
  { value: 'Footwear', label: 'Footwear' },
  { value: 'Apparel', label: 'Apparel' },
];

export function BuyingCategoryFilter() {
  const { selectedBuyingCategories, toggleBuyingCategory } = useFilterStore();

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">Buying Category</label>
      <div className="space-y-2">
        {BUYING_CATEGORIES.map((category) => (
          <div key={category.value} className="flex items-center space-x-2">
            <Checkbox
              id={`buying-category-${category.value}`}
              checked={selectedBuyingCategories.includes(category.value)}
              onCheckedChange={() => toggleBuyingCategory(category.value)}
            />
            <label
              htmlFor={`buying-category-${category.value}`}
              className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-gray-700"
            >
              {category.label}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
