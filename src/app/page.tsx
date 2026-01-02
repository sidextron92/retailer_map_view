'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Filter } from 'lucide-react';
import { MapView } from '@/components/map/MapView';
import { RetailerDetailModal } from '@/components/modals/RetailerDetailModal';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { useRetailers } from '@/hooks/useRetailers';
import { useFilterStore } from '@/store/filterStore';
import { applyFilters, getActiveFilterCount } from '@/lib/utils/filters';
import { Button } from '@/components/ui/button';
import type { Retailer } from '@/types/retailer';

function HomeContent() {
  const { retailers, loading, error } = useRetailers();
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filters = useFilterStore();
  const setUrlFilters = useFilterStore((state) => state.setUrlFilters);
  const activeFilterCount = getActiveFilterCount(filters);
  const searchParams = useSearchParams();

  // Apply URL-based filters on mount
  useEffect(() => {
    const darkstore = searchParams.get('darkstore');
    const skId = searchParams.get('sk_id');
    const buyingCategory = searchParams.get('buying_category');

    if (darkstore || skId || buyingCategory) {
      setUrlFilters({
        darkstore: darkstore || undefined,
        skId: skId || undefined,
        buyingCategory: buyingCategory || undefined,
      });
    }
  }, [searchParams, setUrlFilters]);

  // Apply filters to retailers
  const filteredRetailers = useMemo(
    () => applyFilters(retailers, filters),
    [retailers, filters]
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-lg font-semibold text-gray-700">
            Loading retailers...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="max-w-md rounded-lg bg-white p-8 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-red-600">
            Error Loading Data
          </h2>
          <p className="mb-4 text-gray-700">{error.message}</p>
          <div className="rounded-lg bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              <strong>Troubleshooting:</strong>
            </p>
            <ul className="mt-2 list-inside list-disc text-sm text-yellow-700">
              <li>Check that your Supabase credentials are set in .env.local</li>
              <li>Verify the database schema has been created</li>
              <li>Ensure the retailers table exists in Supabase</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (retailers.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="max-w-md rounded-lg bg-white p-8 shadow-lg text-center">
          <h2 className="mb-4 text-xl font-semibold text-gray-700">
            No Retailers Found
          </h2>
          <p className="mb-4 text-gray-600">
            Get started by adding some retailer data to your Supabase database.
          </p>
          <div className="rounded-lg bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              <strong>Next Steps:</strong>
            </p>
            <ol className="mt-2 list-inside list-decimal text-left text-sm text-blue-700">
              <li>Go to your Supabase dashboard</li>
              <li>Run the SQL migration from supabase/migrations/001_initial_schema.sql</li>
              <li>Add sample retailer data</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen w-full overflow-hidden">
      <MapView
        retailers={filteredRetailers}
        onMarkerClick={setSelectedRetailer}
      />

      {/* Filter Toggle Button */}
      <Button
        onClick={() => setIsFilterOpen(true)}
        className="fixed right-4 top-4 z-30 h-12 gap-2 shadow-lg"
        size="lg"
      >
        <Filter className="h-5 w-5" />
        Filters
        {activeFilterCount > 0 && (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-medium text-blue-600">
            {activeFilterCount}
          </span>
        )}
      </Button>

      {/* Filter Panel */}
      <FilterPanel isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} />

      {/* Retailer Detail Modal */}
      <RetailerDetailModal
        retailer={selectedRetailer}
        isOpen={!!selectedRetailer}
        onClose={() => setSelectedRetailer(null)}
      />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-lg font-semibold text-gray-700">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
