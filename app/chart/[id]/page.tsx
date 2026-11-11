'use client';

import React, { Suspense, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/AuthProvider';
import { useChartSync } from '@/hooks/useChartSync';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChartData } from '@/lib/chart-types';
import ChartEditor from './edit/page';

const PiascoreReader = dynamic(
  () => import('@/components/PiascoreReader').then((mod) => mod.PiascoreReader),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-[#121214] text-white">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#007aff] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading score...</span>
        </div>
      </div>
    ),
  }
);

function ChartViewerDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isGuest, loading: authLoading } = useAuth();

  const getInitialChartId = () => {
    if (params?.id && params.id !== 'edit' && params.id !== 'view' && params.id !== 'demo') return params.id as string;
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
  const chartId = resolvedChartId;

  useEffect(() => {
    const currentId =
      (params?.id && params.id !== 'edit' && params.id !== 'view' && params.id !== 'demo' ? (params.id as string) : null) ||
      searchParams?.get('id') ||
      (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null) ||
      '';
    if (currentId && currentId !== resolvedChartId) {
      setResolvedChartId(currentId);
    }
  }, [params, searchParams, resolvedChartId]);

  useEffect(() => {
    if (chartId === 'edit') {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      router.replace(`/chart/edit/${search}`);
    }
  }, [chartId, router]);

  const { chart, loading: chartLoading } = useChartSync(chartId === 'edit' ? '' : chartId);

  if (chartId === 'edit') {
    return null;
  }

  if (chartLoading || authLoading || !chartId) {
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
    const isGuestOrUnauthenticated = !user || isGuest || user?.email === 'guest@offline.local';
    const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';

    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#121214] text-white gap-4 px-6 text-center">
        <p className="text-slate-400 text-sm max-w-sm">
          {isGuestOrUnauthenticated
            ? 'Sign in to access your band’s cloud charts and songs on this device.'
            : 'Chart not found or access denied for your current band workspace.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {isGuestOrUnauthenticated ? (
            <button
              onClick={() => router.push(`/auth?returnTo=${encodeURIComponent(currentUrl)}`)}
              className="px-6 py-2.5 bg-[#007aff] hover:bg-[#0066cc] font-bold rounded-xl text-white transition-all shadow-lg"
            >
              Sign In to View
            </button>
          ) : (
            <button
              onClick={() => router.push('/')}
              className="px-5 py-2.5 bg-[#007aff] font-bold rounded-xl text-white hover:bg-[#0066cc] transition-all"
            >
              Go to Catalog
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 font-bold rounded-xl text-white transition-all"
          >
            Retry
          </button>
          {isGuestOrUnauthenticated ? (
            <button
              onClick={() => router.push('/')}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 font-bold rounded-xl text-white transition-all"
            >
              Go to Catalog
            </button>
          ) : (
            <button
              onClick={() => router.push('/profile')}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 font-bold rounded-xl text-white transition-all"
            >
              Check Band
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <PiascoreReader
      key={chart.id}
      initialChart={chart as ChartData}
      folderId={chart.folder_id}
    />
  );
}

function ChartViewerDetailRouter() {
  const params = useParams();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const isEditRoute = params?.id === 'edit' || pathname.includes('/edit');

  if (isEditRoute) {
    return <ChartEditor />;
  }

  return <ChartViewerDetailContent />;
}

export default function ChartViewer() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#121214] text-white">
        <div className="w-6 h-6 border-2 border-[#007aff] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ChartViewerDetailRouter />
    </Suspense>
  );
}
