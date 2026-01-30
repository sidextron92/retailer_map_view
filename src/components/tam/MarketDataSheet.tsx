'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { detectPincodeFromLocation } from '@/lib/utils/pincode-detector';

interface PincodeData {
  pincode: string;
  count: number;
}

interface MarketDataSheetProps {
  isOpen: boolean;
  onClose: () => void;
  darkstore: string;
  userLocation: { latitude: number; longitude: number; accuracy?: number } | null;
  pincodeData: any;
}

export function MarketDataSheet({
  isOpen,
  onClose,
  darkstore,
  userLocation,
  pincodeData,
}: MarketDataSheetProps) {
  const [marketData, setMarketData] = useState<PincodeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect user's current pincode
  const currentPincode = userLocation
    ? detectPincodeFromLocation(userLocation.latitude, userLocation.longitude, pincodeData)
    : null;

  // Fetch market data
  useEffect(() => {
    if (!isOpen) return;

    async function fetchMarketData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all tam_retailers for this darkstore
        const { data, error: fetchError } = await supabase
          .from('tam_retailers')
          .select('pincode')
          .ilike('darkstore', darkstore);

        if (fetchError) throw fetchError;

        // Group by pincode and count
        const pincodeMap = new Map<string, number>();
        data?.forEach((row) => {
          const pincode = row.pincode;
          pincodeMap.set(pincode, (pincodeMap.get(pincode) || 0) + 1);
        });

        // Convert to array and sort by count (highest to lowest)
        let pincodeArray: PincodeData[] = Array.from(pincodeMap.entries()).map(
          ([pincode, count]) => ({ pincode, count })
        );

        // Filter to only show pincodes with at least 1 retailer
        pincodeArray = pincodeArray.filter((item) => item.count > 0);

        // Sort by count descending
        pincodeArray.sort((a, b) => b.count - a.count);

        // If user has a current pincode, add it to the top if not already in the list
        if (currentPincode) {
          const existingIndex = pincodeArray.findIndex(
            (item) => item.pincode === currentPincode
          );

          if (existingIndex === -1) {
            // Current pincode not in list, add it with 0 count at the top
            pincodeArray.unshift({ pincode: currentPincode, count: 0 });
          } else if (existingIndex > 0) {
            // Current pincode exists but not at the top, move it to the top
            const [currentItem] = pincodeArray.splice(existingIndex, 1);
            pincodeArray.unshift(currentItem);
          }
          // If existingIndex === 0, it's already at the top, do nothing
        }

        setMarketData(pincodeArray);
      } catch (err) {
        console.error('Error fetching market data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch market data');
      } finally {
        setLoading(false);
      }
    }

    fetchMarketData();
  }, [isOpen, darkstore, currentPincode]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[90vh] flex-col rounded-t-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-white px-6 py-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Market Data</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Data Table */}
          {!loading && !error && (
            <>
              {marketData.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-gray-500">No retailer data available</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                          Pincode
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                          Retailers
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {marketData.map((item, index) => {
                        const isCurrentPincode = item.pincode === currentPincode;
                        return (
                          <tr
                            key={item.pincode}
                            className={
                              isCurrentPincode
                                ? 'bg-yellow-50'
                                : index % 2 === 0
                                ? 'bg-white'
                                : 'bg-gray-50'
                            }
                          >
                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {item.pincode}
                                </span>
                                {isCurrentPincode && (
                                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                                    Current
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                              {item.count}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with Summary */}
        {!loading && !error && marketData.length > 0 && (
          <div className="border-t bg-gray-50 px-6 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Total Pincodes:</span>
              <span className="font-semibold text-gray-900">{marketData.length}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Total Retailers:</span>
              <span className="font-semibold text-gray-900">
                {marketData.reduce((sum, item) => sum + item.count, 0)}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
