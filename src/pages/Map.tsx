import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Search, Filter, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { LeafletMap } from '@/components/map/LeafletMap';
import { ContactImportModal } from '@/components/map/ContactImportModal';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const Map = () => {
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendsLocations, setFriendsLocations] = useState<any[]>([]);
  const [showContactImport, setShowContactImport] = useState(false);
  const { user } = useAuth();
  const { location, error: locationError, loading: locationLoading } = useGeolocation();
  const navigate = useNavigate();

  // Fetch friends' locations
  useEffect(() => {
    if (!user) return;

    const fetchFriendsLocations = async () => {
      try {
        // Get accepted friends
        const { data: friendships, error: friendshipsError } = await supabase
          .from('friendships')
          .select('requester_id, addressee_id')
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
          .eq('status', 'accepted');

        if (friendshipsError) throw friendshipsError;

        const friendIds = friendships?.map(f => 
          f.requester_id === user.id ? f.addressee_id : f.requester_id
        ) || [];

        if (friendIds.length === 0) {
          setFriendsLocations([]);
          return;
        }

        // Get friends' locations
        const { data: locations, error: locationsError } = await supabase
          .from('user_locations')
          .select(`
            user_id,
            latitude,
            longitude,
            profiles (display_name, avatar_url)
          `)
          .in('user_id', friendIds)
          .eq('is_sharing_location', true);

        if (locationsError) throw locationsError;

        setFriendsLocations(locations || []);
      } catch (err) {
        console.error('Error fetching friends locations:', err);
        toast.error('Failed to load friends locations');
      }
    };

    fetchFriendsLocations();

    // Subscribe to location updates
    const channel = supabase
      .channel('location-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_locations'
      }, () => {
        fetchFriendsLocations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const friendsOnMap = friendsLocations.map(loc => ({
    id: loc.user_id,
    name: loc.profiles?.display_name || 'Friend',
    avatar: loc.profiles?.avatar_url || '',
    location: 'On the map',
    coordinates: { lat: parseFloat(loc.latitude), lng: parseFloat(loc.longitude) },
    status: 'online',
    lastSeen: 'Active now',
    distance: '0 miles',
    latitude: parseFloat(loc.latitude),
    longitude: parseFloat(loc.longitude)
  }));

  const getStatusBadge = (status: string) => {
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-primary text-white">
        <div className="container-mobile py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="heading-lg text-white">Friend Map</h1>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/20 p-2"
                onClick={() => setShowContactImport(true)}
              >
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

          {/* Search */}
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

      <div className="container-mobile py-6 space-y-6">
        {/* Real Map */}
        <Card className="gradient-card shadow-card border-0">
          <CardContent className="p-4">
            {locationLoading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
                  <p className="text-sm text-muted-foreground">Getting your location...</p>
                </div>
              </div>
            ) : locationError ? (
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-12 h-12 mx-auto mb-4 text-destructive" />
                  <p className="text-sm text-muted-foreground mb-2">{locationError}</p>
                  <p className="text-xs text-muted-foreground">Please enable location services</p>
                </div>
              </div>
            ) : (
              <LeafletMap 
                userLocation={location}
                friendsLocations={friendsOnMap}
              />
            )}
          </CardContent>
        </Card>

        {/* Nearby Friends List */}
        <Card className="gradient-card shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="heading-lg">Nearby Friends</h3>
              <Badge variant="secondary" className="text-xs">
                {friendsOnMap.length} online
              </Badge>
            </div>
            
            <div className="space-y-3">
              {friendsOnMap.map((friend) => (
                <div 
                  key={friend.id} 
                  className={`flex items-center gap-3 p-3 rounded-xl transition-smooth cursor-pointer ${
                    selectedFriend?.id === friend.id ? 'bg-primary/10' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedFriend(friend)}
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={friend.avatar} />
                    <AvatarFallback className="gradient-primary text-white">
                      {friend.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold truncate">{friend.name}</h4>
                      {getStatusBadge(friend.status)}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>{friend.location} • {friend.distance}</span>
                    </div>
                  </div>
                  
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => navigate(`/app/messages?user=${friend.id}`)}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Selected Friend Details */}
        {selectedFriend && (
          <Card className="gradient-card shadow-card border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={selectedFriend.avatar} />
                  <AvatarFallback className="gradient-primary text-white text-lg">
                    {selectedFriend.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                
                <div>
                  <h3 className="heading-lg">{selectedFriend.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedFriend.location}</p>
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
                  Send Message
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (selectedFriend.latitude && selectedFriend.longitude) {
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedFriend.latitude},${selectedFriend.longitude}`, '_blank');
                    }
                  }}
                >
                  Get Directions
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Import Modal */}
        <ContactImportModal 
          open={showContactImport}
          onOpenChange={setShowContactImport}
        />
      </div>
    </div>
  );
};

export default Map;