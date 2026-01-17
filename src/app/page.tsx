'use client';

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Filter, MapPin, Loader2 } from 'lucide-react';
import { MapView } from '@/components/map/MapView';
import { RetailerDetailModal } from '@/components/modals/RetailerDetailModal';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { useRetailers } from '@/hooks/useRetailers';
import { useDarkstore } from '@/hooks/useDarkstore';
import { useFilterStore } from '@/store/filterStore';
import { applyFilters, getActiveFilterCount } from '@/lib/utils/filters';
import { Button } from '@/components/ui/button';
import type { Retailer } from '@/types/retailer';

function HomeContent() {
  const searchParams = useSearchParams();

  // Read URL parameters for operations mode and darkstore
  const mode = searchParams.get('mode');
  const darkstoreParam = searchParams.get('darkstore');
  const isOpsMode = mode === 'ops';

  // Read URL parameters for server-side filtering (retailers)
  const urlFilters = useMemo(() => ({
    darkstore: darkstoreParam,
    skId: searchParams.get('sk_id'),
    buyingCategory: searchParams.get('buying_category'),
  }), [darkstoreParam, searchParams]);

  // Fetch retailers with server-side filters applied
  const { retailers, loading, error } = useRetailers(urlFilters);

  // Fetch darkstore location if darkstore parameter is present
  const { darkstore, loading: darkstoreLoading, error: darkstoreError } = useDarkstore(darkstoreParam);

  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const filters = useFilterStore();
  const activeFilterCount = getActiveFilterCount(filters);

  // Pincode loading states
  const [currentZoom, setCurrentZoom] = useState<number>(0);
  const [loadPincodes, setLoadPincodes] = useState<(() => Promise<void>) | null>(null);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState<Error | null>(null);
  const [showErrorMessage, setShowErrorMessage] = useState(false);

  // Apply filters to retailers
  const filteredRetailers = useMemo(
    () => applyFilters(retailers, filters),
    [retailers, filters]
  );

  // Handle pincode load function updates from MapView
  const handlePincodeLoadReady = useCallback((loadFn: () => Promise<void>) => {
    setLoadPincodes(() => loadFn);
  }, []);

  // Auto-hide error message after 5 seconds
  useEffect(() => {
    if (showErrorMessage) {
      const timer = setTimeout(() => {
        setShowErrorMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showErrorMessage]);

  // Handle load pincodes button click
  const handleLoadPincodesClick = async () => {
    if (!loadPincodes) return;

    try {
      setPincodeLoading(true);
      setPincodeError(null);
      setShowErrorMessage(false);
      await loadPincodes();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load pincodes');
      setPincodeError(err);
      setShowErrorMessage(true);
    } finally {
      setPincodeLoading(false);
    }
  };

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
    <main className="h-screen w-full overflow-hidden relative">
      {/* Blue border overlay for ops mode */}
      {isOpsMode && (
        <div className="absolute inset-0 pointer-events-none z-50 border-8 border-blue-600" />
      )}

      <MapView
        retailers={filteredRetailers}
        darkstore={darkstore}
        isOpsMode={isOpsMode}
        onMarkerClick={setSelectedRetailer}
        onLocationChange={setUserLocation}
        onZoomChange={setCurrentZoom}
        onPincodeLoadReady={handlePincodeLoadReady}
      />

      {/* Button Group - Fixed at bottom right */}
      <div className="fixed right-4 bottom-4 z-30 flex flex-col gap-2 items-end">
        {/* Load Pincodes Button - Only visible when zoom >= 10 */}
        {currentZoom >= 10 && (
          <Button
            onClick={handleLoadPincodesClick}
            className="h-9 gap-1.5 shadow-lg text-xs"
            size="sm"
            disabled={pincodeLoading || !loadPincodes}
          >
            {pincodeLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4" />
                Load Pincodes
              </>
            )}
          </Button>
        )}

        {/* Filter Toggle Button */}
        <Button
          onClick={() => setIsFilterOpen(true)}
          className="h-12 gap-2 shadow-lg"
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
      </div>

      {/* Filter Panel */}
      <FilterPanel isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} />

      {/* Retailer Detail Modal */}
      <RetailerDetailModal
        retailer={selectedRetailer}
        isOpen={!!selectedRetailer}
        onClose={() => setSelectedRetailer(null)}
        userLocation={userLocation}
      />

      {/* Error Message Toast */}
      {showErrorMessage && pincodeError && (
        <div className="fixed top-4 right-4 z-50 max-w-md rounded-lg bg-red-50 border border-red-200 p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Failed to load pincodes</h3>
              <p className="mt-1 text-sm text-red-700">{pincodeError.message}</p>
            </div>
            <button
              onClick={() => setShowErrorMessage(false)}
              className="flex-shrink-0 text-red-400 hover:text-red-600"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
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
