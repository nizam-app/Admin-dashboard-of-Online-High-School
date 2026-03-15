import { useQuery } from '@tanstack/react-query';
import { getLiveSessions, getLiveSessionsStats } from '../api/liveSessionsApi';

export const useLiveSessionsStats = () => {
  return useQuery({
    queryKey: ['live-sessions-stats'],
    queryFn: getLiveSessionsStats,
    staleTime: 60 * 1000,
    retry: 1,
  });
};

export const useLiveSessions = ({ tab, page, limit }) => {
  return useQuery({
    queryKey: ['live-sessions', tab, page, limit],
    queryFn: () => getLiveSessions({ tab, page, limit }),
    staleTime: 30 * 1000,
    retry: 1,
    placeholderData: (previousData) => previousData,
  });
};
