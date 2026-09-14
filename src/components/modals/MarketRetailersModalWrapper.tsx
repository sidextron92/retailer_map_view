'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { MarketRetailersModal } from './MarketRetailersModal';
import { useMarketRetailers } from '@/hooks/useMarketRetailers';

interface MarketRetailersModalWrapperProps {
  marketId: string | null;
  marketName: string;
  darkstore: string;
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MarketRetailersModalWrapper({
  marketId,
  marketName,
  darkstore,
  isOpen,
  onClose,
  isAdmin = false,
  onEdit,
  onDelete,
}: MarketRetailersModalWrapperProps) {
  const { retailers } = useMarketRetailers(marketId, darkstore);

  return (
    <>
      <MarketRetailersModal
        marketName={marketName}
        retailers={retailers}
        isOpen={isOpen}
        onClose={onClose}
      />

      {/* Admin action bar attached to the modal overlay */}
      {isAdmin && isOpen && (
        <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 shadow-lg">
            <button
              onClick={() => {
                onClose();
                onEdit?.();
              }}
              className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-100"
            >
              <Pencil className="h-4 w-4" />
              Edit Boundary
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      )}
    </>
  );
}
