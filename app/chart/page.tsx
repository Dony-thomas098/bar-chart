'use client';

import React, { Suspense, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/AuthProvider';
import { useChartSync } from '@/hooks/useChartSync';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChartData } from '@/lib/chart-types';

import { PiascoreReader } from '@/components/PiascoreReader';

function ChartViewerContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const getInitialChartId = () => {
    if (params?.id && params.id !== 'edit') return params.id as string;
    const spId = searchParams?.get('id');
    if (spId) return spId;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const wId = urlParams.get('id');
      if (wId) return wId;
    }
    return '';
  };

  const [resolvedChartId, setResolvedChartId] = useState<string>(getInitialChartId);

  useEffect(() => {
    const currentId =
      (params?.id && params.id !== 'edit' ? (params.id as string) : null) ||
      searchParams?.get('id') ||
      (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null) ||
      '';
    if (currentId && currentId !== resolvedChartId) {
      setResolvedChartId(currentId);
    }
  }, [params, searchParams, resolvedChartId]);

  useEffect(() => {
    if (resolvedChartId === 'edit') {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      router.replace(`/chart/edit/${search}`);
    }
  }, [resolvedChartId, router]);

  const { chart, loading: chartLoading } = useChartSync(resolvedChartId === 'edit' ? '' : resolvedChartId);

  if (resolvedChartId === 'edit') {
    return null;
  }

  if (chartLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#121214] text-white">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#007aff] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading score...</span>
        </div>
      </div>
    );
  }

  if (!chart) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#121214] text-white gap-4">
        <p className="text-slate-400 text-sm">Chart not found or access denied.</p>
        <button
          onClick={() => router.push('/')}
          className="px-5 py-2.5 bg-[#007aff] font-bold rounded-xl text-white hover:bg-[#0066cc] transition-all"
        >
          Go to Catalog
        </button>
      </div>
    );
  }

  return (
    <PiascoreReader
      initialChart={chart as ChartData}
      folderId={chart.folder_id}
    />
  );
}

export default function ChartViewerPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#121214] text-white">
        <div className="w-6 h-6 border-2 border-[#007aff] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ChartViewerContent />
    </Suspense>
  );
}
