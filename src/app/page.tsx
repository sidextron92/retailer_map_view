'use client';

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Filter, MapPin, Loader2, Plus, BarChart3, Pencil, Save, X } from 'lucide-react';
import { MapView } from '@/components/map/MapView';
import { RetailerDetailModal } from '@/components/modals/RetailerDetailModal';
import { TamRetailerDetailModal } from '@/components/modals/TamRetailerDetailModal';
import { MarketRetailersModalWrapper } from '@/components/modals/MarketRetailersModalWrapper';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { AddRetailerSheet } from '@/components/tam/AddRetailerSheet';
import { MarketDataSheet } from '@/components/tam/MarketDataSheet';
import { useRetailers } from '@/hooks/useRetailers';
import { useDarkstore } from '@/hooks/useDarkstore';
import { useTamRetailers } from '@/hooks/useTamRetailers';
import { useMarketBoundaries } from '@/hooks/useMarketBoundaries';
import { useFilterStore } from '@/store/filterStore';
import { applyFilters, getActiveFilterCount } from '@/lib/utils/filters';
import { validateMarketPolygon, formatMarketArea, getMarketAreaSqm } from '@/lib/utils/market-geometry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Retailer } from '@/types/retailer';
import type { TamRetailer } from '@/types/tam-retailer';
import type { ViewMode } from '@/types/market';
import type { PincodeFeatureCollection } from '@/lib/utils/pincode-detector';
import type { Polygon } from 'geojson';
import { toast } from 'sonner';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read URL parameters for operations mode, TAM mode, darkstore, view, and role.
  // Also tolerate shared links like ?mode=tam?darkstore=Agra.
  const { mode, darkstoreParam, view, role } = useMemo(() => {
    const rawMode = searchParams.get('mode');
    const malformedQueryIndex = rawMode?.indexOf('?') ?? -1;

    if (rawMode && malformedQueryIndex !== -1) {
      const nestedParams = new URLSearchParams(rawMode.slice(malformedQueryIndex + 1));

      return {
        mode: rawMode.slice(0, malformedQueryIndex).toLowerCase(),
        darkstoreParam: searchParams.get('darkstore') ?? nestedParams.get('darkstore'),
        view: searchParams.get('view')?.toLowerCase() ?? null,
        role: searchParams.get('role')?.toLowerCase() ?? null,
      };
    }

    return {
      mode: rawMode?.toLowerCase() ?? null,
      darkstoreParam: searchParams.get('darkstore'),
      view: searchParams.get('view')?.toLowerCase() ?? null,
      role: searchParams.get('role')?.toLowerCase() ?? null,
    };
  }, [searchParams]);
  const isOpsMode = mode === 'ops';
  const isTamMode = mode === 'tam';
  const isAdmin = role === 'admin';
  const viewMode: ViewMode = view === 'markets' ? 'markets' : 'pincode';

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

  // Fetch market boundaries scoped to darkstore (used when viewMode is markets)
  const {
    featureCollection: marketFeatureCollection,
    refresh: refreshMarketBoundaries,
    createMarket,
    updateMarket,
    deleteMarket,
  } = useMarketBoundaries(darkstoreParam);

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

  // Market mode state
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [selectedMarketName, setSelectedMarketName] = useState<string>('');
  const [isMarketRetailersModalOpen, setIsMarketRetailersModalOpen] = useState(false);
  const [drawingMarket, setDrawingMarket] = useState(false);
  const [editingMarketId, setEditingMarketId] = useState<string | null>(null);
  const [editedMarketPolygon, setEditedMarketPolygon] = useState<Polygon | null>(null);
  const [pendingMarketPolygon, setPendingMarketPolygon] = useState<Polygon | null>(null);
  const [isSaveMarketSheetOpen, setIsSaveMarketSheetOpen] = useState(false);
  const [newMarketName, setNewMarketName] = useState('');
  const [isSubmittingMarket, setIsSubmittingMarket] = useState(false);

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

  // Toggle between pincode and markets view, persisting choice in the URL
  const handleViewModeChange = useCallback((nextView: ViewMode) => {
    if (!darkstoreParam) return;

    const params = new URLSearchParams(searchParams.toString());
    if (nextView === 'markets') {
      params.set('view', 'markets');
    } else {
      params.delete('view');
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    router.replace(newUrl, { scroll: false });
  }, [darkstoreParam, router, searchParams]);

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

  // Handle market polygon click (TAM mode only)
  const handleMarketClick = useCallback((marketId: string, marketName: string) => {
    setSelectedMarketId(marketId);
    setSelectedMarketName(marketName);
    setIsMarketRetailersModalOpen(true);
  }, []);

  // Start drawing a new market boundary
  const handleStartDrawingMarket = useCallback(() => {
    setDrawingMarket(true);
  }, []);

  // Called when mapbox-gl-draw finishes a new polygon
  const handleMarketCreate = useCallback((polygon: Polygon) => {
    setPendingMarketPolygon(polygon);
    setIsSaveMarketSheetOpen(true);
  }, []);

  // Called when mapbox-gl-draw updates an existing polygon
  const handleMarketUpdate = useCallback((marketId: string, polygon: Polygon) => {
    setEditingMarketId(marketId);
    setEditedMarketPolygon(polygon);
  }, []);

  // Called when mapbox-gl-draw mode changes (e.g. Escape exits draw/edit mode)
  const handleMarketModeChange = useCallback((mode: string) => {
    // If the user exits draw_polygon without completing a feature, show the Draw Market CTA again
    if (mode !== 'draw_polygon' && drawingMarket && !pendingMarketPolygon) {
      setDrawingMarket(false);
    }
    // If the user exits direct_select while editing, cancel the edit
    if (mode !== 'direct_select' && editingMarketId) {
      setEditingMarketId(null);
      setEditedMarketPolygon(null);
    }
  }, [drawingMarket, pendingMarketPolygon, editingMarketId]);

  // Save a newly drawn market
  const handleSaveNewMarket = useCallback(async () => {
    if (!pendingMarketPolygon || !newMarketName.trim()) return;

    const existingGeometries = (marketFeatureCollection?.features || [])
      .map((f) => f.geometry);

    const validation = validateMarketPolygon(pendingMarketPolygon, existingGeometries);
    if (!validation.valid) {
      toast.error('Invalid market boundary', {
        description: validation.errors.join(' '),
      });
      return;
    }

    setIsSubmittingMarket(true);
    try {
      await createMarket(newMarketName.trim(), pendingMarketPolygon);
      toast.success('Market created successfully');
      setIsSaveMarketSheetOpen(false);
      setPendingMarketPolygon(null);
      setNewMarketName('');
      setDrawingMarket(false);
    } catch (err) {
      console.error('Error creating market:', err);
      toast.error('Failed to create market', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setIsSubmittingMarket(false);
    }
  }, [pendingMarketPolygon, newMarketName, marketFeatureCollection, createMarket]);

  // Save changes to an edited market boundary
  const handleSaveEditedMarket = useCallback(async () => {
    if (!editingMarketId || !editedMarketPolygon) return;

    const existingGeometries = (marketFeatureCollection?.features || [])
      .filter((f) => f.properties.id !== editingMarketId)
      .map((f) => f.geometry);

    const validation = validateMarketPolygon(editedMarketPolygon, existingGeometries);
    if (!validation.valid) {
      toast.error('Invalid market boundary', {
        description: validation.errors.join(' '),
      });
      return;
    }

    setIsSubmittingMarket(true);
    try {
      await updateMarket(editingMarketId, { geometry: editedMarketPolygon });
      toast.success('Market boundary updated');
      setEditingMarketId(null);
      setEditedMarketPolygon(null);
      await refreshMarketBoundaries();
    } catch (err) {
      console.error('Error updating market:', err);
      toast.error('Failed to update market', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setIsSubmittingMarket(false);
    }
  }, [editingMarketId, editedMarketPolygon, marketFeatureCollection, updateMarket, refreshMarketBoundaries]);

  // Delete a market boundary
  const handleDeleteMarket = useCallback(async () => {
    if (!selectedMarketId) return;

    if (!window.confirm(`Delete market "${selectedMarketName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteMarket(selectedMarketId);
      toast.success('Market deleted');
      setIsMarketRetailersModalOpen(false);
      setSelectedMarketId(null);
      setSelectedMarketName('');
    } catch (err) {
      console.error('Error deleting market:', err);
      toast.error('Failed to delete market', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  }, [selectedMarketId, selectedMarketName, deleteMarket]);

  // Start editing an existing market boundary
  const handleStartEditingMarket = useCallback(() => {
    setIsMarketRetailersModalOpen(false);
    if (selectedMarketId) {
      setEditingMarketId(selectedMarketId);
      setEditedMarketPolygon(null);
    }
  }, [selectedMarketId]);

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

      {/* Pulsing purple border overlay when drawing a market boundary */}
      {drawingMarket && (
        <div className="absolute inset-0 pointer-events-none z-[60] border-[6px] border-purple-500 animate-pulse" />
      )}

      {/* Cancel Drawing CTA */}
      {drawingMarket && (
        <div className="fixed top-4 left-1/2 z-[70] -translate-x-1/2">
          <Button
            onClick={() => setDrawingMarket(false)}
            className="h-10 gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white shadow-xl hover:bg-red-700"
          >
            <X className="h-4 w-4" />
            Cancel Drawing
          </Button>
        </div>
      )}

      <MapView
        retailers={isTamMode ? [] : filteredRetailers}
        tamRetailers={isTamMode ? tamRetailers : []}
        darkstore={darkstore}
        isOpsMode={isOpsMode}
        isTamMode={isTamMode}
        isPinPlacementMode={isPinPlacementMode}
        viewMode={viewMode}
        isAdmin={isAdmin}
        marketFeatureCollection={marketFeatureCollection}
        drawingMarket={drawingMarket}
        editingMarketId={editingMarketId}
        onMarkerClick={setSelectedRetailer}
        onTamRetailerClick={handleTamRetailerClick}
        onMarketClick={handleMarketClick}
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
        onMarketCreate={handleMarketCreate}
        onMarketUpdate={handleMarketUpdate}
        onMarketDelete={() => {
          // Deletion is handled through the market modal UI
        }}
        onMarketModeChange={handleMarketModeChange}
      />

      {/* Button Group - Fixed at bottom right */}
      <div className="fixed right-4 bottom-4 z-30 flex flex-col gap-2 items-end">
        {/* Pincode / Markets Toggle - Visible whenever a darkstore is present */}
        {darkstoreParam && (
          <div className="flex rounded-lg bg-white p-1 shadow-lg">
            <button
              onClick={() => handleViewModeChange('pincode')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'pincode'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Pincode
            </button>
            <button
              onClick={() => handleViewModeChange('markets')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'markets'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Markets
            </button>
          </div>
        )}

        {/* Draw Market Button - Admin only, markets view only */}
        {isAdmin && viewMode === 'markets' && !drawingMarket && !editingMarketId && (
          <Button
            onClick={handleStartDrawingMarket}
            className="h-9 gap-1.5 shadow-lg text-xs bg-purple-100 hover:bg-purple-200 text-purple-900"
            size="sm"
          >
            <Pencil className="h-4 w-4" />
            Draw Market
          </Button>
        )}

        {/* Load Pincodes Button - Only visible when zoom >= 10, pincodes not loaded, and pincode view */}
        {viewMode === 'pincode' && currentZoom >= 10 && !pincodeDataLoaded && (
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

        {/* Show Data Button - Only visible in TAM mode */}
        {isTamMode && (
          <Button
            onClick={() => setIsMarketDataSheetOpen(true)}
            className="h-9 gap-1.5 shadow-lg text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-900"
            size="sm"
          >
            <BarChart3 className="h-4 w-4" />
            {viewMode === 'markets' ? 'Show Market Data' : 'Show Pincode Data'}
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
          viewMode={viewMode}
        />
      )}

      {/* TAM Retailer Detail Modal */}
      <TamRetailerDetailModal
        retailers={selectedTamRetailers}
        isOpen={selectedTamRetailers.length > 0}
        onClose={() => setSelectedTamRetailers([])}
      />

      {/* Market Retailers Modal (TAM mode only) */}
      {isTamMode && darkstore && (
        <MarketRetailersModalWrapper
          marketId={selectedMarketId}
          marketName={selectedMarketName}
          darkstore={darkstore.darkstore}
          isOpen={isMarketRetailersModalOpen}
          onClose={() => setIsMarketRetailersModalOpen(false)}
          isAdmin={isAdmin}
          onEdit={handleStartEditingMarket}
          onDelete={handleDeleteMarket}
        />
      )}

      {/* Save New Market Sheet */}
      {isSaveMarketSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!isSubmittingMarket) {
                setIsSaveMarketSheetOpen(false);
                setPendingMarketPolygon(null);
                setNewMarketName('');
                setDrawingMarket(false);
              }
            }}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Save Market</h2>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Market Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={newMarketName}
              onChange={(e) => setNewMarketName(e.target.value)}
              placeholder="e.g. Main Bazaar"
              disabled={isSubmittingMarket}
              className="mb-4"
            />
            {pendingMarketPolygon && (
              <p className="mb-4 text-sm text-gray-500">
                Area: {formatMarketArea(getMarketAreaSqm(pendingMarketPolygon))}
              </p>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsSaveMarketSheetOpen(false);
                  setPendingMarketPolygon(null);
                  setNewMarketName('');
                  setDrawingMarket(false);
                }}
                disabled={isSubmittingMarket}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveNewMarket}
                disabled={!newMarketName.trim() || isSubmittingMarket}
              >
                {isSubmittingMarket ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Market Boundary Bar */}
      {editingMarketId && (
        <div className="fixed bottom-4 left-4 right-4 z-40 flex justify-center">
          <div className="flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-3 text-white shadow-lg">
            <span className="text-sm font-medium">Editing market boundary</span>
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1 bg-white text-gray-900 hover:bg-gray-100"
              onClick={handleSaveEditedMarket}
              disabled={isSubmittingMarket}
            >
              {isSubmittingMarket ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 border-gray-600 text-white hover:bg-gray-800"
              onClick={() => {
                setEditingMarketId(null);
                setEditedMarketPolygon(null);
              }}
              disabled={isSubmittingMarket}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
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
