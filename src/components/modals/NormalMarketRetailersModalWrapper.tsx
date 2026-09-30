'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useNormalMarketRetailers } from '@/hooks/useNormalMarketRetailers';
import { NormalMarketRetailersModal } from './NormalMarketRetailersModal';

interface NormalMarketRetailersModalWrapperProps {
  marketId: string | null;
  marketName: string;
  darkstore: string;
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function NormalMarketRetailersModalWrapper({
  marketId,
  marketName,
  darkstore,
  isOpen,
  onClose,
  isAdmin = false,
  onEdit,
  onDelete,
}: NormalMarketRetailersModalWrapperProps) {
  const { retailers, loading, error } = useNormalMarketRetailers(marketId, darkstore, isOpen);

  return (
    <>
      <NormalMarketRetailersModal
        marketName={marketName}
        retailers={retailers}
        loading={loading}
        error={error}
        isOpen={isOpen}
        onClose={onClose}
      />

      {isAdmin && isOpen && (
        <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 shadow-lg">
            <button
              type="button"
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
              type="button"
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
