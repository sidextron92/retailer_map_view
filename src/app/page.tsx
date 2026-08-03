'use client';

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Filter, MapPin, Loader2, Plus, BarChart3 } from 'lucide-react';
import { MapView } from '@/components/map/MapView';
import { RetailerDetailModal } from '@/components/modals/RetailerDetailModal';
import { TamRetailerDetailModal } from '@/components/modals/TamRetailerDetailModal';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { AddRetailerSheet } from '@/components/tam/AddRetailerSheet';
import { MarketDataSheet } from '@/components/tam/MarketDataSheet';
import { useRetailers } from '@/hooks/useRetailers';
import { useDarkstore } from '@/hooks/useDarkstore';
import { useTamRetailers } from '@/hooks/useTamRetailers';
import { useFilterStore } from '@/store/filterStore';
import { applyFilters, getActiveFilterCount } from '@/lib/utils/filters';
import { Button } from '@/components/ui/button';
import type { Retailer } from '@/types/retailer';
import type { TamRetailer } from '@/types/tam-retailer';
import type { PincodeFeatureCollection } from '@/lib/utils/pincode-detector';

function HomeContent() {
  const searchParams = useSearchParams();

  // Read URL parameters for operations mode, TAM mode, and darkstore.
  // Also tolerate shared links like ?mode=tam?darkstore=Agra.
  const { mode, darkstoreParam } = useMemo(() => {
    const rawMode = searchParams.get('mode');
    const malformedQueryIndex = rawMode?.indexOf('?') ?? -1;

    if (rawMode && malformedQueryIndex !== -1) {
      const nestedParams = new URLSearchParams(rawMode.slice(malformedQueryIndex + 1));

      return {
        mode: rawMode.slice(0, malformedQueryIndex).toLowerCase(),
        darkstoreParam: searchParams.get('darkstore') ?? nestedParams.get('darkstore'),
      };
    }

    return {
      mode: rawMode?.toLowerCase() ?? null,
      darkstoreParam: searchParams.get('darkstore'),
    };
  }, [searchParams]);
  const isOpsMode = mode === 'ops';
  const isTamMode = mode === 'tam';

  // Read URL parameters for server-side filtering (retailers)
  const urlFilters = useMemo(() => ({
    darkstore: darkstoreParam,
    skId: searchParams.get('sk_id'),
    buyingCategory: searchParams.get('buying_category'),
  }), [darkstoreParam, searchParams]);

  // Fetch retailers with server-side filters applied
  const { retailers, loading, error } = useRetailers(urlFilters);

  // Fetch darkstore location if darkstore parameter is present
  const { darkstore } = useDarkstore(darkstoreParam);

  // Fetch TAM retailers if in TAM mode
  const { retailers: tamRetailers, refresh: refreshTamRetailers } = useTamRetailers(isTamMode ? darkstoreParam : null);

  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const filters = useFilterStore();
  const activeFilterCount = getActiveFilterCount(filters);

  // TAM mode state
  const [selectedTamRetailers, setSelectedTamRetailers] = useState<TamRetailer[]>([]);
  const [isAddRetailerSheetOpen, setIsAddRetailerSheetOpen] = useState(false);
  const [isMarketDataSheetOpen, setIsMarketDataSheetOpen] = useState(false);
  const [pincodeDataForTam, setPincodeDataForTam] = useState<PincodeFeatureCollection | null>(null);

  // Pin placement state (for low-accuracy GPS fallback in TAM mode)
  const [isPinPlacementMode, setIsPinPlacementMode] = useState(false);
  const [manualLocation, setManualLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Pincode loading states
  const [currentZoom, setCurrentZoom] = useState<number>(0);
  const [loadPincodes, setLoadPincodes] = useState<(() => Promise<void>) | null>(null);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState<Error | null>(null);
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const [pincodeDataLoaded, setPincodeDataLoaded] = useState(false);

  // Apply filters to retailers
  const filteredRetailers = useMemo(
    () => applyFilters(retailers, filters),
    [retailers, filters]
  );

  // Handle pincode load function updates from MapView
  const handlePincodeLoadReady = useCallback((loadFn: () => Promise<void>) => {
    setLoadPincodes(() => loadFn);
  }, []);

  // Handle pincode data loaded status from MapView
  const handlePincodeDataStatus = useCallback((isLoaded: boolean) => {
    setPincodeDataLoaded(isLoaded);
  }, []);

  // Handle pincode data updates from MapView (for TAM mode)
  const handlePincodeData = useCallback((data: PincodeFeatureCollection) => {
    setPincodeDataForTam(data);
  }, []);

  // Handle "Add Retailer" button click
  const handleAddRetailerClick = () => {
    // Always refresh location to get latest position
    const geolocateButton = document.querySelector('.mapboxgl-ctrl-geolocate');
    if (geolocateButton) {
      // Click the geolocate button to refresh position
      (geolocateButton as HTMLButtonElement).click();

      // Wait a moment for location update, then open sheet
      setTimeout(() => {
        setIsAddRetailerSheetOpen(true);
      }, 1000);
    } else {
      // Fallback: open sheet directly if button not found
      setIsAddRetailerSheetOpen(true);
    }
  };

  // Handle successful retailer submission
  const handleRetailerAdded = () => {
    refreshTamRetailers();
    setIsAddRetailerSheetOpen(false);
    setManualLocation(null); // Reset manual location for next use
  };

  // Handle TAM retailer marker click
  const handleTamRetailerClick = (retailers: TamRetailer[]) => {
    setSelectedTamRetailers(retailers);
  };

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

  // TAM mode error state - requires darkstore parameter
  if (isTamMode && !darkstoreParam) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="max-w-md rounded-lg bg-white p-8 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-red-600">
            TAM Mode Error
          </h2>
          <p className="mb-4 text-gray-700">
            TAM mode requires a darkstore location parameter.
          </p>
          <div className="rounded-lg bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              <strong>Usage:</strong>
            </p>
            <p className="mt-2 text-sm text-yellow-700">
              Add the darkstore parameter to your URL:
            </p>
            <code className="mt-2 block rounded bg-yellow-100 p-2 text-xs text-yellow-900">
              ?mode=tam&darkstore=malda
            </code>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (retailers.length === 0 && !isTamMode) {
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

      {/* Yellow border overlay for TAM mode */}
      {isTamMode && (
        <div className="absolute inset-0 pointer-events-none z-50 border-8 border-yellow-500" />
      )}

      <MapView
        retailers={isTamMode ? [] : filteredRetailers}
        tamRetailers={isTamMode ? tamRetailers : []}
        darkstore={darkstore}
        isOpsMode={isOpsMode}
        isTamMode={isTamMode}
        isPinPlacementMode={isPinPlacementMode}
        onMarkerClick={setSelectedRetailer}
        onTamRetailerClick={handleTamRetailerClick}
        onLocationChange={setUserLocation}
        onZoomChange={setCurrentZoom}
        onPincodeLoadReady={handlePincodeLoadReady}
        onPincodeDataStatus={handlePincodeDataStatus}
        onPincodeDataUpdate={handlePincodeData}
        onPinPlaced={(lat, lng) => {
          setManualLocation({ latitude: lat, longitude: lng });
          setIsPinPlacementMode(false);
          setIsAddRetailerSheetOpen(true);
        }}
        onPinPlacementCancel={() => {
          setIsPinPlacementMode(false);
          setIsAddRetailerSheetOpen(true);
        }}
      />

      {/* Button Group - Fixed at bottom right */}
      <div className="fixed right-4 bottom-4 z-30 flex flex-col gap-2 items-end">
        {/* Load Pincodes Button - Only visible when zoom >= 10 and pincodes not loaded */}
        {currentZoom >= 10 && !pincodeDataLoaded && (
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

        {/* Show Market Data Button - Only visible in TAM mode */}
        {isTamMode && (
          <Button
            onClick={() => setIsMarketDataSheetOpen(true)}
            className="h-9 gap-1.5 shadow-lg text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-900"
            size="sm"
          >
            <BarChart3 className="h-4 w-4" />
            Show Market Data
          </Button>
        )}

        {/* Add Retailer Button - Only visible in TAM mode */}
        {isTamMode && (
          <Button
            onClick={handleAddRetailerClick}
            className="h-12 gap-2 shadow-lg bg-yellow-500 hover:bg-yellow-600"
            size="lg"
          >
            <Plus className="h-5 w-5" />
            Add Retailer
          </Button>
        )}

        {/* Filter Toggle Button - Hidden in TAM mode */}
        {!isTamMode && (
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
        )}
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

      {/* Add Retailer Sheet - TAM mode */}
      {isTamMode && darkstore && (
        <AddRetailerSheet
          isOpen={isAddRetailerSheetOpen}
          onClose={() => {
            setIsAddRetailerSheetOpen(false);
            setManualLocation(null);
          }}
          darkstore={darkstore.darkstore}
          userLocation={userLocation}
          manualLocation={manualLocation}
          pincodeData={pincodeDataForTam}
          onSuccess={handleRetailerAdded}
          onRequestManualPin={() => {
            setIsAddRetailerSheetOpen(false);
            setIsPinPlacementMode(true);
          }}
        />
      )}

      {/* Market Data Sheet - TAM mode */}
      {isTamMode && darkstore && (
        <MarketDataSheet
          isOpen={isMarketDataSheetOpen}
          onClose={() => setIsMarketDataSheetOpen(false)}
          darkstore={darkstore.darkstore}
          userLocation={userLocation}
          pincodeData={pincodeDataForTam}
        />
      )}

      {/* TAM Retailer Detail Modal */}
      <TamRetailerDetailModal
        retailers={selectedTamRetailers}
        isOpen={selectedTamRetailers.length > 0}
        onClose={() => setSelectedTamRetailers([])}
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
