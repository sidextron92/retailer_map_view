'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { TamRetailer } from '@/types/tam-retailer';
import { format } from 'date-fns';

interface TamRetailerDetailModalProps {
  retailers: TamRetailer[];
  isOpen: boolean;
  onClose: () => void;
}

export function TamRetailerDetailModal({ retailers, isOpen, onClose }: TamRetailerDetailModalProps) {
  const [fullSizeImage, setFullSizeImage] = useState<string | null>(null);

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
                  index > 0 ? 'border-t pt-4' : ''
                } space-y-3`}
              >
                {/* Shop Photo - Clickable */}
                <div
                  className="overflow-hidden rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setFullSizeImage(retailer.shop_photo_url)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={retailer.shop_photo_url}
                    alt={retailer.shop_name || 'Shop photo'}
                    className="h-32 w-full object-cover"
                  />
                </div>

                {/* Shop Details */}
                <div className="space-y-2">
                  {/* Shop Name */}
                  <div>
                    <label className="text-xs font-medium text-gray-500">Shop Name</label>
                    <p className="text-sm font-semibold text-gray-900">
                      {retailer.shop_name || 'Unnamed Shop'}
                    </p>
                  </div>

                  {/* Categories */}
                  {retailer.category_tags && retailer.category_tags.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">Categories</label>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {retailer.category_tags.map((category) => (
                          <span
                            key={category}
                            className="inline-block rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800"
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pincode and LatLong */}
                  <div className="flex items-baseline gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Pincode</label>
                      <p className="text-sm text-gray-900">{retailer.pincode}</p>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-500">LatLong</label>
                      <p className="font-mono text-xs text-gray-900">
                        {retailer.latitude.toFixed(6)},{retailer.longitude.toFixed(6)}
                        {retailer.location_accuracy !== null && (
                          <span className="ml-2 text-gray-600">
                            (±{retailer.location_accuracy.toFixed(0)}m)
                          </span>
                        )}
                        {retailer.location_source === 'manual' && (
                          <span className="ml-1.5 inline-flex items-center rounded bg-blue-100 px-1 py-0.5 text-[10px] font-medium text-blue-800">
                            Manual
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Timestamp */}
                  {retailer.created_at && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">Captured</label>
                      <p className="text-xs text-gray-900">
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

      {/* Full Size Image Modal */}
      {fullSizeImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setFullSizeImage(null);
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setFullSizeImage(null);
            }}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 hover:bg-white/20"
          >
            <X className="h-6 w-6 text-white" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullSizeImage}
            alt="Full size shop photo"
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
