import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Crosshair, MapPin, Users, Search, Filter, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { ContactImportModal } from '@/components/map/ContactImportModal';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import LeafletMap from '@/components/map/LeafletMap';
import type { LeafletMapHandle } from '@/components/map/LeafletMap';

type UserProfile = {
  display_name?: string | null;
  avatar_url?: string | null;
};

type UserLocationRow = {
  user_id: string;
  latitude: string | number | null;
  longitude: string | number | null;
  is_sharing_location?: boolean | null;
  profiles?: UserProfile | null;
};

type FriendOnMap = {
  id: string;
  name: string;
  avatar?: string;
  locationLabel: string;
  coordinates?: { lat: number; lng: number } | null;
  status: 'online' | 'away' | 'offline';
  lastSeen?: string;
  distanceKm?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

const toNumber = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/**
 * haversine formula - returns distance in kilometers
 */
const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
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
  const [friendsLocations, setFriendsLocations] = useState<any[]>([]);
  const [friendsPresence, setFriendsPresence] = useState<Record<string, 'online' | 'offline'>>({});
  const [showContactImport, setShowContactImport] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendOnMap | null>(null);
  const { user } = useAuth();
  const { location, error: locationError, loading: locationLoading } = useGeolocation();
  const navigate = useNavigate();

  const mapRef = useRef<LeafletMapHandle>(null);

  const handleRecenter = () => {
    mapRef.current?.recenter();
  }

  const fetchFriendsLocations = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;
    try {
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (friendshipsError) throw friendshipsError;

      const friendIds = (friendships || []).map((f: any) =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      );

      if (!friendIds.length) {
        setFriendsLocations([]);
        return;
      }

      const { data: locations, error: locationsError } = await supabase
        .from('user_locations')
        .select('user_id, latitude, longitude, is_sharing_location')
        .in('user_id', friendIds)
        .eq('is_sharing_location', true);

      if (locationsError) throw locationsError;

      // Fetch profiles separately
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', friendIds);

      // Merge profiles with locations
      const locationsWithProfiles = (locations || []).map((loc) => {
        const profile = profiles?.find((p) => p.user_id === loc.user_id);
        return {
          ...loc,
          profiles: profile ? { display_name: profile.display_name, avatar_url: profile.avatar_url } : null,
        };
      });

      if (!signal?.aborted) setFriendsLocations(locationsWithProfiles);
    } catch (err) {
      console.error('fetchFriendsLocations error', err);
      toast.error('Failed to load friends locations');
    }
  }, [user]);

  // load + realtime updates for locations
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    const controller = new AbortController();

    fetchFriendsLocations(controller.signal);

    let channel: any = null;
    (async () => {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted');
      const friendIds = (friendships || []).map((f: any) =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      );

      channel = supabase
        .channel('public:user_locations')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_locations' }, (payload: any) => {
          const rec = payload?.new || payload?.old;
          const userId = rec?.user_id;
          if (userId && friendIds.includes(userId) && isMounted) fetchFriendsLocations();
        })
        .subscribe();
    })();

    return () => {
      isMounted = false;
      controller.abort();
      if (channel?.unsubscribe) channel.unsubscribe();
      // @ts-ignore
    };
  }, [user, fetchFriendsLocations]);

  // realtime presence tracking (Supabase Realtime presence)
  useEffect(() => {
    if (!user) return;
    const presenceChannel = supabase.channel('online-users', {
      config: { presence: { key: user.id } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const onlineIds = Object.keys(state);
        setFriendsPresence((prev) => {
          const updated: Record<string, 'online' | 'offline'> = {};
          for (const id of onlineIds) updated[id] = 'online';
          return updated;
        });
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

  // merge presence + location data
  const friendsMapped: FriendOnMap[] = useMemo(() => {
    return friendsLocations.map((loc) => {
      const lat = toNumber(loc.latitude);
      const lng = toNumber(loc.longitude);
      const name = loc.profiles?.display_name || 'Friend';
      const avatar = loc.profiles?.avatar_url || undefined;
      const coords = lat !== null && lng !== null ? { lat, lng } : null;
      const online = friendsPresence[loc.user_id] === 'online';

      return {
        id: String(loc.user_id),
        name,
        avatar,
        locationLabel: coords ? 'On the map' : 'Location unavailable',
        coordinates: coords,
        status: online ? 'online' : 'offline',
        lastSeen: online ? 'Active now' : 'Offline',
        distanceKm: null,
        latitude: lat,
        longitude: lng,
      };
    });
  }, [friendsLocations, friendsPresence]);

  // compute distance from user location
  const friendsWithDistance = useMemo(() => {
    if (!location?.latitude || !location?.longitude) return friendsMapped;
    const { latitude: userLat, longitude: userLng } = location;
    return friendsMapped.map((f) => {
      if (f.latitude == null || f.longitude == null) return { ...f, distanceKm: null };
      const km = distanceKm(userLat, userLng, f.latitude, f.longitude);
      return { ...f, distanceKm: Number(km.toFixed(2)) };
    });
  }, [friendsMapped, location]);

  // search filter
  const filteredFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return friendsWithDistance;
    return friendsWithDistance.filter((f) => {
      const nameMatch = f.name.toLowerCase().includes(q);
      const locMatch = (f.locationLabel || '').toLowerCase().includes(q);
      const distMatch = f.distanceKm ? f.distanceKm.toString().includes(q) : false;
      return nameMatch || locMatch || distMatch;
    });
  }, [friendsWithDistance, searchQuery]);

  const getStatusBadge = (status: FriendOnMap['status']) => {
    switch (status) {
      case 'online':
        return <Badge className="status-online text-xs">Online</Badge>;
      case 'away':
        return <Badge className="status-away text-xs">Away</Badge>;
      default:
        return <Badge className="status-offline text-xs">Offline</Badge>;
    }
  };

  return (
    // 1. ROOT CONTAINER: Full screen, relative positioning context, overflow hidden
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      
      {/* 2. MAP LAYER (z-0): Absolute position to fill parent, sits in background */}
      <div className="absolute inset-0 z-0">
        <LeafletMap ref={mapRef}
          userLocation={location ?? { latitude: 6.5244, longitude: 3.3792 }}
          friendsLocations={friendsLocations}
          loading={locationLoading}
          error={locationError}
        />
      </div>

      {/* 3. UI OVERLAY (z-10): Sits on top, flex-col layout, pointer-events-none to allow map clicks */}
      <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
        
        {/* A. HEADER: Top of flex, pointer-events-auto to be interactive */}
        <div className="gradient-primary text-white pointer-events-auto">
          <div className="container-mobile py-4">
            <div className="flex items-center justify-between mb-4">
              <h1 className="heading-lg text-white">Friend map</h1>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 p-2" onClick={() => setShowContactImport(true)}>
                  <UserPlus className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 p-2">
                  <Filter className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 p-2">
                  <Users className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
              <Input
                placeholder="Search friends or locations..."
                className="pl-10 bg-white/20 border-white/30 text-white placeholder:text-white/70"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* B. SPACER: Pushes the bottom content down */}
        <div className="flex-grow" />

        {/* C. BOTTOM SHEET: Bottom of flex, pointer-events-auto, scrollable, max-height */}
        <div className="relative pointer-events-auto"> 

          {/* Re-center button */}
      {location && (
        <Button
          onClick={handleRecenter}
          variant="secondary"
          size="icon"
          className="absolute bottom-24 right-6 z-20 rounded-full shadow-lg"
          title="Re-center on my location"
        >
          <Crosshair className="h-5 w-5" />
        </Button>
      )}

        <div className="overflow-y-auto max-h-[60vh]">
          <div className="container-mobile py-6 space-y-6">
            
            {/* Card 1: Nearby Friends */}
            <Card className="gradient-card shadow-card border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="heading-lg">Nearby friends</h3>
                  <Badge variant="secondary" className="text-xs">
                    {filteredFriends.length} found
                  </Badge>
                </div>

                {filteredFriends.length === 0 && (
                  <div className="text-sm text-muted-foreground p-3">No friends found or sharing location.</div>
                )}

                <div className="space-y-3">
                  {filteredFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-smooth cursor-pointer ${
                        selectedFriend?.id === friend.id ? 'bg-primary/10' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedFriend(friend)}
                    >
                      <Avatar className="w-12 h-12">
                        {friend.avatar ? (
                          <AvatarImage src={friend.avatar} />
                        ) : (
                          <AvatarFallback className="gradient-primary text-white">
                            {friend.name ?? '?'
                              .split(' ')
                              .map((n) => n[0] ?? '')
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold truncate">{friend.name}</h4>
                          {getStatusBadge(friend.status)}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span>
                            {friend.locationLabel}
                            {friend.distanceKm != null ? ` • ${friend.distanceKm} km` : ''}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/app/messages?user=${friend.id}`);
                        }}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Selected Friend */}
            {selectedFriend && (
              <Card className="gradient-card shadow-card border-0">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="w-16 h-16">
                      {selectedFriend.avatar ? (
                        <AvatarImage src={selectedFriend.avatar} />
                      ) : (
                        <AvatarFallback className="gradient-primary text-white text-lg">
                          {selectedFriend.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <h3 className="heading-lg">{selectedFriend.name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedFriend.locationLabel}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(selectedFriend.status)}
                        <span className="text-xs text-muted-foreground">{selectedFriend.lastSeen}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      className="gradient-primary text-white"
                      onClick={() => navigate(`/app/messages?user=${selectedFriend.id}`)}
                    >
                      Send message
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const { latitude, longitude } = selectedFriend;
                        if (latitude && longitude) {
                          // BUG FIX: Correctly formatted Google Maps URL
                          const destination = encodeURIComponent(`${latitude},${longitude}`);
                          window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
                        } else {
                          toast.error('Location unavailable for this friend');
                        }
                      }}
                    >
                      Get directions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* 4. MODAL: Renders in a portal, sits on top of everything */}
      <ContactImportModal open={showContactImport} onOpenChange={setShowContactImport} />
    </div>
  );
};

export default Map;
  
