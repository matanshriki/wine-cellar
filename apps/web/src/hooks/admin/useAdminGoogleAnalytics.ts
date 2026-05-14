import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface GA4OverviewPeriod {
  activeUsers: number;
  sessions: number;
  pageViews: number;
  avgSessionDuration: number; // seconds
  bounceRate: number;         // percentage 0-100
  newUsers: number;
  engagementRate: number;     // percentage 0-100
}

export interface GA4Source {
  channel: string;
  sessions: number;
  users: number;
}

export interface GA4Country {
  country: string;
  countryCode: string;
  users: number;
  sessions: number;
}

export interface GA4Page {
  path: string;
  title: string;
  views: number;
  users: number;
  avgDuration: number;
  bounceRate: number;
}

export interface GA4Device {
  device: string;
  sessions: number;
  users: number;
  pct: number;
}

export interface GA4LandingPage {
  path: string;
  sessions: number;
  bounceRate: number;
}

export interface GA4DailyPoint {
  date: string;   // "YYYYMMDD"
  sessions: number;
  users: number;
  pageViews: number;
}

export interface GA4Data {
  propertyId: string;
  fetchedAt: string;
  realtimeUsers: number;
  overview: {
    '7d': GA4OverviewPeriod | null;
    '30d': GA4OverviewPeriod | null;
  };
  sources: GA4Source[];
  countries: GA4Country[];
  pages: GA4Page[];
  devices: GA4Device[];
  landingPages: GA4LandingPage[];
  dailyTrend: GA4DailyPoint[];
}

export function useAdminGoogleAnalytics() {
  return useQuery<GA4Data>({
    queryKey: ['admin', 'ga4'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/analytics/ga4`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // Include the hint from the API in the error message so the UI can show it
        const detail = [body.error, body.hint].filter(Boolean).join(' — ');
        throw new Error(detail || `HTTP ${res.status}`);
      }

      return res.json() as Promise<GA4Data>;
    },
    staleTime: 5 * 60_000,  // cache 5 min — GA4 quota is limited
    retry: 1,
  });
}
