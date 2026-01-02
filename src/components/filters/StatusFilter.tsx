'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { useFilterStore } from '@/store/filterStore';

export function StatusFilter() {
  const {
    showActive,
    showInactive,
    setShowActive,
    setShowInactive,
  } = useFilterStore();

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">
        Visibility (Soft Delete)
      </label>
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="status-active"
            checked={showActive}
            onCheckedChange={(checked) => setShowActive(!!checked)}
          />
          <label
            htmlFor="status-active"
            className="cursor-pointer text-sm text-gray-700"
          >
            Show Visible
          </label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="status-inactive"
            checked={showInactive}
            onCheckedChange={(checked) => setShowInactive(!!checked)}
          />
          <label
            htmlFor="status-inactive"
            className="cursor-pointer text-sm text-gray-700"
          >
            Show Hidden
          </label>
        </div>
      </div>
    </div>
  );
}
