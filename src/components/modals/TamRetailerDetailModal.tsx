'use client';

import { X } from 'lucide-react';
import type { TamRetailer } from '@/types/tam-retailer';
import { format } from 'date-fns';

interface TamRetailerDetailModalProps {
  retailers: TamRetailer[];
  isOpen: boolean;
  onClose: () => void;
}

export function TamRetailerDetailModal({ retailers, isOpen, onClose }: TamRetailerDetailModalProps) {
  if (!isOpen || retailers.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {retailers.length === 1 ? 'TAM Retailer Details' : `${retailers.length} TAM Retailers`}
          </h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-6">
            {retailers.map((retailer, index) => (
              <div
                key={retailer.id}
                className={`${
                  index > 0 ? 'border-t pt-6' : ''
                } space-y-4`}
              >
                {/* Shop Photo */}
                <div className="overflow-hidden rounded-lg">
                  <img
                    src={retailer.shop_photo_url}
                    alt={retailer.shop_name || 'Shop photo'}
                    className="h-64 w-full object-cover"
                  />
                </div>

                {/* Shop Details */}
                <div className="space-y-3">
                  {/* Shop Name */}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Shop Name</label>
                    <p className="text-base font-semibold text-gray-900">
                      {retailer.shop_name || 'Unnamed Shop'}
                    </p>
                  </div>

                  {/* Categories */}
                  {retailer.category_tags && retailer.category_tags.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Categories</label>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {retailer.category_tags.map((category) => (
                          <span
                            key={category}
                            className="inline-block rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800"
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Location Data */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Pincode</label>
                      <p className="text-base text-gray-900">{retailer.pincode}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Darkstore</label>
                      <p className="text-base text-gray-900">{retailer.darkstore}</p>
                    </div>
                  </div>

                  {/* Coordinates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Latitude</label>
                      <p className="font-mono text-sm text-gray-900">
                        {retailer.latitude.toFixed(6)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Longitude</label>
                      <p className="font-mono text-sm text-gray-900">
                        {retailer.longitude.toFixed(6)}
                      </p>
                    </div>
                  </div>

                  {/* Accuracy */}
                  {retailer.location_accuracy !== null && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Location Accuracy</label>
                      <p className="text-sm text-gray-900">
                        {retailer.location_accuracy.toFixed(2)} meters
                      </p>
                    </div>
                  )}

                  {/* Timestamp */}
                  {retailer.created_at && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Captured On</label>
                      <p className="text-sm text-gray-900">
                        {format(new Date(retailer.created_at), 'PPpp')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
