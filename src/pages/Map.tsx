import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Crosshair, 
  MapPin, 
  Search, 
  Filter, 
  Eye, 
  EyeOff, 
  Navigation,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { ContactImportModal } from '@/components/map/ContactImportModal';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch'; // Ensure this exists
import LeafletMap from '@/components/map/LeafletMap';
import type { LeafletMapHandle } from '@/components/map/LeafletMap';

// --- Types ---
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

// --- Helpers ---
const toNumber = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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
  // --- State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [friendsLocations, setFriendsLocations] = useState<any[]>([]);
  const [friendsPresence, setFriendsPresence] = useState<Record<string, 'online' | 'offline'>>({});
  const [showContactImport, setShowContactImport] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendOnMap | null>(null);
  const [isGhostMode, setIsGhostMode] = useState(false); // Local state for immediate UI feedback
  
  const { user } = useAuth();
  const { location, error: locationError, loading: locationLoading } = useGeolocation();
  const navigate = useNavigate();
  const mapRef = useRef<LeafletMapHandle>(null);

  const handleRecenter = () => {
    mapRef.current?.recenter();
  };

  // --- 1. Fetch Friends Logic ---
  const fetchFriendsLocations = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;
    try {
      // A. Get Friends IDs
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

      // B. Get Locations (Only those sharing)
      const { data: locations, error: locationsError } = await supabase
        .from('user_locations')
        .select('user_id, latitude, longitude, is_sharing_location')
        .in('user_id', friendIds)
        .eq('is_sharing_location', true);

      if (locationsError) throw locationsError;

      // C. Get Profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', friendIds);

      // D. Merge
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
      toast.error('Failed to update map');
    }
  }, [user]);

  // --- 2. Toggle Ghost Mode (Mutation) ---
  const toggleGhostMode = async () => {
    if (!user) return;
    const newValue = !isGhostMode;
    setIsGhostMode(newValue); // Optimistic update

    try {
      const { error } = await supabase
        .from('user_locations')
        .upsert({ 
          user_id: user.id, 
          is_sharing_location: !newValue // If ghost mode is ON, sharing is OFF
        });

      if (error) throw error;
      
      toast.success(newValue ? "You are now invisible" : "You are visible on the map");
    } catch (error) {
      setIsGhostMode(!newValue); // Revert on error
      toast.error("Failed to update location settings");
    }
  };

  // --- 3. Initial Load & Realtime ---
  useEffect(() => {
    if (!user) return;

    // Check my initial ghost mode status
    const checkMyStatus = async () => {
      const { data } = await supabase
        .from('user_locations')
        .select('is_sharing_location')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setIsGhostMode(!data.is_sharing_location);
      }
    };
    checkMyStatus();

    // Fetch Friends
    const controller = new AbortController();
    fetchFriendsLocations(controller.signal);

    // Realtime Subscription
    let channel: any = null;
    (async () => {
      // Get friend IDs first to filter subscription (optimization)
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
          const userId = payload.new?.user_id || payload.old?.user_id;
          // Only refetch if the change belongs to a friend
          if (userId && friendIds.includes(userId)) {
            fetchFriendsLocations();
          }
        })
        .subscribe();
    })();

    return () => {
      controller.abort();
      if (channel?.unsubscribe) channel.unsubscribe();
    };
  }, [user, fetchFriendsLocations]);

  // --- 4. Presence (Online Status) ---
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

  // --- 5. Data Processing ---
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
        locationLabel: coords ? 'On the map' : 'Location hidden',
        coordinates: coords,
        status: online ? 'online' : 'offline',
        lastSeen: online ? 'Active now' : 'Offline',
        distanceKm: null,
        latitude: lat,
        longitude: lng,
      };
    });
  }, [friendsLocations, friendsPresence]);

  const friendsWithDistance = useMemo(() => {
    if (!location?.latitude || !location?.longitude) return friendsMapped;
    const { latitude: userLat, longitude: userLng } = location;
    return friendsMapped.map((f) => {
      if (f.latitude == null || f.longitude == null) return { ...f, distanceKm: null };
      const km = distanceKm(userLat, userLng, f.latitude, f.longitude);
      return { ...f, distanceKm: Number(km.toFixed(2)) };
    });
  }, [friendsMapped, location]);

  const filteredFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return friendsWithDistance;
    return friendsWithDistance.filter((f) => {
      const nameMatch = f.name.toLowerCase().includes(q);
      const locMatch = (f.locationLabel || '').toLowerCase().includes(q);
      return nameMatch || locMatch;
    });
  }, [friendsWithDistance, searchQuery]);

  const getStatusBadge = (status: FriendOnMap['status']) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white text-[10px] h-5">Online</Badge>;
      case 'away':
        return <Badge className="bg-yellow-500 text-white text-[10px] h-5">Away</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">Offline</Badge>;
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      
      {/* --- LAYER 1: MAP --- */}
      <div className="absolute inset-0 z-0">
        <LeafletMap
          ref={mapRef}
          userLocation={location ?? { latitude: 6.5244, longitude: 3.3792 }} // Default: Lagos
          friendsLocations={friendsLocations}
          loading={locationLoading}
          error={locationError}
        />
      </div>

      {/* --- LAYER 2: UI OVERLAY --- */}
      {/* pointer-events-none ensures clicks pass through empty spaces to the map */}
      <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
        
        {/* A. HEADER (Now Active) */}
        <div className="bg-gradient-to-b from-black/60 to-transparent p-4 pointer-events-auto">
          <div className="container-mobile flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
              <Input 
                placeholder="Find friends..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white/20 border-white/30 text-white placeholder:text-white/70 backdrop-blur-md"
              />
            </div>
            
            {/* Ghost Mode Toggle */}
            <Button 
              size="icon" 
              variant={isGhostMode ? "destructive" : "secondary"}
              className={`rounded-full shadow-lg transition-all ${isGhostMode ? 'opacity-100' : 'bg-white/20 text-white border-white/30 hover:bg-white/30'}`}
              onClick={toggleGhostMode}
              title={isGhostMode ? "You are hidden" : "You are visible"}
            >
              {isGhostMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>

            {/* Filter / Import */}
            <Button 
              size="icon" 
              variant="secondary" 
              className="bg-white/20 text-white border-white/30 hover:bg-white/30 rounded-full backdrop-blur-md"
              onClick={() => setShowContactImport(true)}
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* B. SPACER (Push content down) */}
        <div className="flex-grow" />

        {/* C. BOTTOM SHEET & CONTROLS */}
        <div className="relative pointer-events-auto pb-6">
          
          {/* Re-center Button */}
          {location && (
            <div className="container-mobile flex justify-end mb-4">
              <Button
                onClick={handleRecenter}
                className="rounded-full shadow-lg h-12 w-12 bg-background text-foreground hover:bg-muted"
                title="Recenter"
              >
                <Crosshair className="h-6 w-6" />
              </Button>
            </div>
          )}

          <div className="max-h-[50vh] overflow-y-auto">
            <div className="container-mobile space-y-4">
              
              {/* Selected Friend Card */}
              {selectedFriend && (
                <Card className="gradient-card shadow-card border-0 animate-in slide-in-from-bottom-10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-14 h-14 border-2 border-white/20">
                          <AvatarImage src={selectedFriend.avatar || undefined} />
                          <AvatarFallback>{selectedFriend.name.slice(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-bold text-lg leading-tight">{selectedFriend.name}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> 
                            {selectedFriend.locationLabel}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setSelectedFriend(null)}>
                        <span className="sr-only">Close</span>
                        <Crosshair className="w-4 h-4 rotate-45" /> 
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        className="gradient-primary text-white"
                        onClick={() => navigate(`/messages?userId=${selectedFriend.id}`)}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Message
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const { latitude, longitude } = selectedFriend;
                          if (latitude && longitude) {
                            // Production-ready universal maps link
                            const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
                            window.open(url, '_blank');
                          } else {
                            toast.error('Location unavailable');
                          }
                        }}
                      >
                        <Navigation className="w-4 h-4 mr-2" />
                        Directions
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Nearby Friends List */}
              {!selectedFriend && (
                <Card className="gradient-card shadow-card border-0 backdrop-blur-md bg-background/80">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Nearby friends</h3>
                      <Badge variant="secondary" className="text-xs">
                        {filteredFriends.length}
                      </Badge>
                    </div>

                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {filteredFriends.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          {searchQuery ? "No friends found." : "No friends are sharing location."}
                        </div>
                      ) : (
                        filteredFriends.map((friend) => (
                          <div
                            key={friend.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                            onClick={() => {
                                setSelectedFriend(friend);
                                // Optionally trigger map flyTo here via ref if you add that method to LeafletMap
                            }}
                          >
                            <div className="relative">
                              <Avatar className="w-10 h-10">
                                <AvatarImage src={friend.avatar || undefined} />
                                <AvatarFallback>{friend.name.slice(0,2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              {friend.status === 'online' && (
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center">
                                <h4 className="font-medium text-sm truncate">{friend.name}</h4>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {friend.distanceKm ? `${friend.distanceKm}km` : ''}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {friend.locationLabel}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      <ContactImportModal 
        open={showContactImport} 
        onOpenChange={setShowContactImport} 
      />
    </div>
  );
};

export default Map;
  
