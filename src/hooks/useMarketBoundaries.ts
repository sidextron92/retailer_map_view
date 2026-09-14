'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getMarketFillColor, getMarketOutlineColor } from '@/lib/utils/market-colors';
import type { MarketBoundary, MarketBoundaryFeatureProperties } from '@/types/market';
import type { Feature, FeatureCollection, Polygon } from 'geojson';

export type MarketFeature = Feature<Polygon, MarketBoundaryFeatureProperties>;
export type MarketFeatureCollection = FeatureCollection<Polygon, MarketBoundaryFeatureProperties>;

function toFeatureCollection(markets: MarketBoundary[]): MarketFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: markets.map((market) => ({
      type: 'Feature',
      properties: {
        id: market.id,
        name: market.name,
        darkstore: market.darkstore,
        fillColor: getMarketFillColor(market.id),
        outlineColor: getMarketOutlineColor(market.id),
      },
      geometry: market.geometry,
    })),
  };
}

export function useMarketBoundaries(darkstore: string | null | undefined) {
  const [markets, setMarkets] = useState<MarketBoundary[]>([]);
  const [featureCollection, setFeatureCollection] = useState<MarketFeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMarkets = useCallback(async () => {
    if (!darkstore) {
      setMarkets([]);
      setFeatureCollection(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('rmv_market_boundaries')
        .select('*')
        .ilike('darkstore', darkstore)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const marketData = (data || []) as MarketBoundary[];
      setMarkets(marketData);
      setFeatureCollection(toFeatureCollection(marketData));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch market boundaries';
      setError(new Error(message));
      console.error('Error fetching market boundaries:', err);
    } finally {
      setLoading(false);
    }
  }, [darkstore]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  const createMarket = useCallback(async (name: string, geometry: Polygon) => {
    if (!darkstore) throw new Error('Darkstore is required');

    const { data, error: insertError } = await supabase
      .from('rmv_market_boundaries')
      .insert({
        name,
        darkstore,
        geometry,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await fetchMarkets();
    return data as MarketBoundary;
  }, [darkstore, fetchMarkets]);

  const updateMarket = useCallback(async (id: string, updates: { name?: string; geometry?: Polygon }) => {
    const { error: updateError } = await supabase
      .from('rmv_market_boundaries')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;

    await fetchMarkets();
  }, [fetchMarkets]);

  const deleteMarket = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase
      .from('rmv_market_boundaries')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    await fetchMarkets();
  }, [fetchMarkets]);

  return {
    markets,
    featureCollection,
    loading,
    error,
    refresh: fetchMarkets,
    createMarket,
    updateMarket,
    deleteMarket,
  };
}
