import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Users, Search, Filter, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { ContactImportModal } from '@/components/map/ContactImportModal';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // Import query hooks

import LeafletMap from '@/components/map/LeafletMap';

// --- Types ---
// This is the shape returned by our new RPC function
type FriendOnMap = {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  latitude: number | null;
  longitude: number | null;
};

// This is the enriched client-side type
type EnrichedFriend = {
  id: string;
  name: string;
  avatar?: string;
  locationLabel: string;
  coordinates: { lat: number; lng: number } | null;
  status: 'online' | 'offline'; // Simplified from original
  lastSeen?: string;
  distanceKm: number | null;
};

// --- Haversine Formula ---
const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  // ... (haversine formula from your original file, no changes)
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const Map = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [friendsPresence, setFriendsPresence] = useState<Record<string, 'online' | 'offline'>>({});
  const [showContactImport, setShowContactImport] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<EnrichedFriend | null>(null);
  
  const { user } = useAuth();
  const { location, error: locationError, loading: locationLoading } = useGeolocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- Data Fetching (Phase 2.1 & 2.2) ---
  // Replaced complex useEffect with a single useQuery calling our RPC
  const { data: friendsLocations = [], isLoading: loadingFriends } = useQuery<FriendOnMap[]>({
    queryKey: ['friendsOnMap', user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Call the RPC function
      const { data, error } = await supabase.rpc('get_friends_on_map');
      if (error) {
        toast.error('Failed to load friends locations');
        throw error;
      }
      return data || [];
    },
    enabled: !!user,
  });
  
  // --- Location Broadcasting (Phase 2.4) ---
  const upsertLocationMutation = useMutation({
    mutationFn: async ({ latitude, longitude }: { latitude: number, longitude: number }) => {
      if (!user) return;
      
      const { error } = await supabase
        .from('user_locations')
        .upsert({
          user_id: user.id,
          latitude: latitude,
          longitude: longitude,
          last_updated: new Date().toISOString(),
          // is_sharing_location is set from profile page, don't default it here
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
    },
    onError: (error: Error) => {
      console.error('Failed to broadcast location:', error.message);
      // Don't toast this error, it's a background task
    }
  });

  // Effect to broadcast location when it changes
  useEffect(() => {
    if (location && user) {
      upsertLocationMutation.mutate({
        latitude: location.latitude,
        longitude: location.longitude,
      });
    }
  }, [location, user, upsertLocationMutation]);


  // --- Real-time Subscriptions ---

  // 1. Scalable Location Updates (Phase 2.3)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('public:user_locations')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'user_locations' 
          // RLS (see SQL below) automatically filters this
          // so we only get updates for rows we're allowed to see (our friends)
        },
        (payload) => {
          console.log('Location change received, refetching map data:', payload);
          // Invalidate the query to refetch
          queryClient.invalidateQueries({ queryKey: ['friendsOnMap', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // 2. Presence Tracking (Unchanged from original)
  useEffect(() => {
    if (!user) return;
    const presenceChannel = supabase.channel('online-users', {
      config: { presence: { key: user.id } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const onlineIds: Record<string, 'online' | 'offline'> = {};
        for (const id in state) {
          onlineIds[id] = 'online';
        }
        setFriendsPresence((prev) => ({ ...prev, ...onlineIds }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: user.id, online: true });
        }
      });

    return () => {
      presenceChannel.unsubscribe();
    };
  }, [user]);

  // --- Data Memoization (Enriching data) ---
  const friendsEnriched: EnrichedFriend[] = useMemo(() => {
    const userLat = location?.latitude;
    const userLng = location?.longitude;
    
    return friendsLocations.map((loc) => {
      const { user_id, display_name, avatar_url, latitude, longitude } = loc;
      const coords = (latitude !== null && longitude !== null) ? { lat: latitude, lng: longitude } : null;
      const online = friendsPresence[user_id] === 'online';

      let dist: number | null = null;
      if (coords && userLat && userLng) {
        dist = Number(distanceKm(userLat, userLng, coords.lat, coords.lng).toFixed(2));
      }

      return {
        id: user_id,
        name: display_name || 'Friend',
        avatar: avatar_url || undefined,
        locationLabel: coords ? 'On the map' : 'Location unavailable',
        coordinates: coords,
        status: online ? 'online' : 'offline',
        lastSeen: online ? 'Active now' : 'Offline',
        distanceKm: dist,
      };
    });
  }, [friendsLocations, friendsPresence, location]);

  // Search filter (Unchanged)
  const filteredFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return friendsEnriched;
    return friendsEnriched.filter((f) => {
      const nameMatch = f.name.toLowerCase().includes(q);
      const locMatch = (f.locationLabel || '').toLowerCase().includes(q);
      const distMatch = f.distanceKm ? f.distanceKm.toString().includes(q) : false;
      return nameMatch || locMatch || distMatch;
    });
  }, [friendsEnriched, searchQuery]);

  // ... (Rest of your component JSX, no changes needed)
  // ...
  
  return (
    <div className="min-h-screen bg-background">
      {/* ... (Header JSX) ... */}
      
      <div className="container-mobile py-6 space-y-6">
        <Card className="gradient-card shadow-card border-0">
          <CardContent className="p-0">
            {/* The LeafletMap component now receives the RPC data */}
            <LeafletMap
              userLocation={location ?? { latitude: 6.5244, longitude: 3.3792 }} // Default location
              friendsLocations={friendsLocations} // Pass the raw RPC data
              loading={locationLoading || loadingFriends} // Loading if user location OR friends are loading
              error={locationError}
            />
          </CardContent>
        </Card>
        
        <Card className="gradient-card shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="heading-lg">Nearby friends</h3>
              <Badge variant="secondary" className="text-xs">
                {filteredFriends.length} found
              </Badge>
            </div>

            {loadingFriends ? (
              <div className="text-sm text-muted-foreground p-3">Loading friends...</div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-sm text-muted-foreground p-3">No friends found or sharing location.</div>
            ) : (
              <div className="space-y-3">
                {/* Render using filteredFriends */}
                {filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    // ... (rest of your friend item JSX)
                  >
                    {/* ... */}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* ... (SelectedFriend card JSX) ... */}
      </div>
    </div>
  );
};

export default Map;
