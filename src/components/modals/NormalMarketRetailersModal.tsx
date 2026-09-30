'use client';

import { useMemo } from 'react';
import { MapPin, Phone, Store, X } from 'lucide-react';
import type { Retailer } from '@/types/retailer';

interface NormalMarketRetailersModalProps {
  marketName: string;
  retailers: Retailer[];
  loading: boolean;
  error: Error | null;
  isOpen: boolean;
  onClose: () => void;
}

type StatusKey = 'active' | 'idle' | 'churn' | 'other';

const STATUS_STYLES: Record<StatusKey, string> = {
  active: 'bg-green-100 text-green-800',
  idle: 'bg-yellow-100 text-yellow-800',
  churn: 'bg-red-100 text-red-800',
  other: 'bg-gray-100 text-gray-700',
};

function getStatusKey(status: string | null): StatusKey {
  const normalized = status?.trim().toLowerCase();
  if (normalized === 'active' || normalized === 'idle' || normalized === 'churn') {
    return normalized;
  }
  return 'other';
}

export function NormalMarketRetailersModal({
  marketName,
  retailers,
  loading,
  error,
  isOpen,
  onClose,
}: NormalMarketRetailersModalProps) {
  const statusCounts = useMemo(
    () => retailers.reduce(
      (counts, retailer) => {
        counts[getStatusKey(retailer.retailer_status)] += 1;
        return counts;
      },
      { active: 0, idle: 0, churn: 0, other: 0 } as Record<StatusKey, number>
    ),
    [retailers]
  );

  if (!isOpen) return null;

  const summaryCards = [
    { label: 'Total', value: retailers.length, className: 'bg-blue-50 text-blue-800' },
    { label: 'Active', value: statusCounts.active, className: STATUS_STYLES.active },
    { label: 'Idle', value: statusCounts.idle, className: STATUS_STYLES.idle },
    { label: 'Churn', value: statusCounts.churn, className: STATUS_STYLES.churn },
    { label: 'Other / Unspecified', value: statusCounts.other, className: STATUS_STYLES.other },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="normal-market-retailers-title"
      >
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div>
            <h2 id="normal-market-retailers-title" className="text-xl font-semibold text-gray-900">
              {marketName}
            </h2>
            <p className="text-sm text-gray-500">Retailers inside this market boundary</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100"
            aria-label="Close market retailers"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b bg-gray-50 px-6 py-4 sm:grid-cols-5">
          {summaryCards.map((card) => (
            <div key={card.label} className={`rounded-lg px-3 py-2 ${card.className}`}>
              <p className="text-xs font-medium">{card.label}</p>
              <p className="text-xl font-semibold">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="overflow-y-auto p-6">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">Loading retailers...</div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              Unable to load retailers: {error.message}
            </div>
          ) : retailers.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              No retailers were found inside this market.
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {retailers.map((retailer) => {
                const statusKey = getStatusKey(retailer.retailer_status);

                return (
                  <article key={retailer.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{retailer.name}</h3>
                        {(retailer.trader_name || retailer.sk_id) && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {[retailer.trader_name, retailer.sk_id ? `SK: ${retailer.sk_id}` : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[statusKey]}`}>
                        {retailer.retailer_status || 'Unspecified'}
                      </span>
                    </div>

                    <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                      {retailer.buying_category && (
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 shrink-0 text-gray-400" />
                          <span>{retailer.buying_category}</span>
                        </div>
                      )}
                      {retailer.phone && (
                        <a href={`tel:${retailer.phone}`} className="flex items-center gap-2 text-blue-600 hover:underline">
                          <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                          <span>{retailer.phone}</span>
                        </a>
                      )}
                      <div className="flex items-start gap-2 sm:col-span-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                        <span>
                          {[retailer.address, retailer.city, retailer.state, retailer.pincode]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
