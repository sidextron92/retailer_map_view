'use client';

import { format } from 'date-fns';
import {
  Phone,
  MapPin,
  Calendar,
  Navigation,
  FileText,
} from 'lucide-react';
import type { Retailer } from '@/types/retailer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { calculateDistance, formatDistance } from '@/lib/utils/distance';

interface RetailerDetailModalProps {
  retailer: Retailer | null;
  isOpen: boolean;
  onClose: () => void;
  userLocation?: { latitude: number; longitude: number } | null;
}

function openGoogleMaps(lat: number, lng: number): void {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    // Opens in Google Maps app if installed, otherwise web
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      '_blank'
    );
  } else {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      '_blank'
    );
  }
}

export function RetailerDetailModal({
  retailer,
  isOpen,
  onClose,
  userLocation,
}: RetailerDetailModalProps) {
  if (!retailer) return null;

  // Calculate distance if user location is available
  const distance = userLocation
    ? calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        retailer.latitude,
        retailer.longitude
      )
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{retailer.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 -mt-2">
          {(retailer.trader_name || retailer.sk_id) && (
            <div className="flex items-center gap-2">
              {retailer.trader_name && (
                <span className="text-sm text-gray-600">
                  Trader: {retailer.trader_name}
                </span>
              )}
              {retailer.sk_id && (
                <span className="text-xs text-gray-500">SK: {retailer.sk_id}</span>
              )}
            </div>
          )}
          {(retailer.buying_category || retailer.darkstore || retailer.teamlead_name) && (
            <div className="flex items-center gap-2 flex-wrap">
              {retailer.buying_category && (
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                  {retailer.buying_category}
                </span>
              )}
              {retailer.darkstore && (
                <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                  DS: {retailer.darkstore}
                </span>
              )}
              {retailer.teamlead_name && (
                <span className="text-xs bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded">
                  TL: {retailer.teamlead_name}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            {retailer.retailer_status && (
              <span
                className={cn(
                  'inline-block rounded-full px-2 py-1 text-xs font-medium',
                  retailer.retailer_status.toLowerCase() === 'active'
                    ? 'bg-green-100 text-green-800'
                    : retailer.retailer_status.toLowerCase() === 'idle'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                )}
              >
                {retailer.retailer_status}
              </span>
            )}
            <span
              className={cn(
                'inline-block rounded-full px-2 py-1 text-xs font-medium',
                retailer.is_active
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              )}
            >
              {retailer.is_active ? 'Visible' : 'Hidden'}
            </span>
          </div>

          {/* Location Information */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700">
              Location Details
            </h3>

            {/* Distance from current location */}
            {distance !== null && (
              <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-3">
                <Navigation className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-xs text-blue-600 font-medium">Distance from you</p>
                  <p className="text-sm font-semibold text-blue-700">{formatDistance(distance)}</p>
                </div>
              </div>
            )}

            {retailer.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-gray-400" />
                <a
                  href={`tel:${retailer.phone}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {retailer.phone}
                </a>
              </div>
            )}

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
              <div className="text-sm text-gray-700">
                <p>{retailer.address}</p>
                {(retailer.city || retailer.state || retailer.pincode) && (
                  <p className="mt-1 text-gray-500">
                    {[retailer.city, retailer.state, retailer.pincode]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Visit & Order Information */}
          {(retailer.last_visit_date ||
            retailer.next_scheduled_visit ||
            retailer.last_order_date) && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Visit & Order History
              </h3>

              {retailer.last_order_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Last Order</p>
                    <p className="text-sm text-gray-700">
                      {format(new Date(retailer.last_order_date), 'PPP')}
                    </p>
                  </div>
                </div>
              )}

              {retailer.last_visit_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Last Visit</p>
                    <p className="text-sm text-gray-700">
                      {format(new Date(retailer.last_visit_date), 'PPP')}
                    </p>
                  </div>
                </div>
              )}

              {retailer.next_scheduled_visit && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Next Scheduled</p>
                    <p className="text-sm text-gray-700">
                      {format(new Date(retailer.next_scheduled_visit), 'PPP')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {retailer.notes && (
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Notes</h3>
              </div>
              <p className="text-sm text-gray-600">{retailer.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button
            onClick={() => openGoogleMaps(retailer.latitude, retailer.longitude)}
            className="w-full"
            size="lg"
          >
            <Navigation className="mr-2 h-4 w-4" />
            Navigate with Google Maps
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
