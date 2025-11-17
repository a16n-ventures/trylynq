import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bell, MapPin, Users, MessageCircle, Plus, Settings, Search, Crown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom'; // 1. Import useNavigate

interface Friend {
  id: string;
  name: string;
  avatar: string;
  location: string;
  distance: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: string;
}

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [nearbyFriends, setNearbyFriends] = useState<Friend[]>([]);
  const [stats, setStats] = useState({ nearby: 0, messages: 0, events: 0 });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate(); // 2. Initialize useNavigate

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch accepted friendships
      const { data: friendships, error: friendErr } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user?.id},addressee_id.eq.${user?.id}`);

      if (friendErr) throw friendErr;

      const friendIds = friendships?.map(f => 
        f.requester_id === user?.id ? f.addressee_id : f.requester_id
      ) || [];

      // Fetch friends with locations
      if (friendIds.length > 0) {
        const { data: friendsData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', friendIds);

        const { data: locationsData } = await supabase
          .from('user_locations')
          .select('user_id, latitude, longitude, is_sharing_location')
          .in('user_id', friendIds)
          .eq('is_sharing_location', true);

        // Merge profiles with locations
        const friends: Friend[] = (friendsData || []).map(profile => {
          const location = locationsData?.find(l => l.user_id === profile.user_id);
          return {
            id: profile.user_id,
            name: profile.display_name || 'Friend',
            avatar: profile.avatar_url || '',
            location: location ? 'Nearby' : 'Unknown',
            distance: location ? '< 5 miles' : 'N/A',
            status: 'online' as const,
            lastSeen: 'Active now'
          };
        }).slice(0, 3);

        setNearbyFriends(friends);
        setStats(prev => ({ ...prev, nearby: friends.length }));
      }

      // Count unread messages
      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user?.id)
        .is('read_at', null);

      // Count upcoming events
      const { count: eventCount } = await supabase
        .from('event_attendees')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      setStats({
        nearby: friendIds.length,
        messages: msgCount || 0,
        events: eventCount || 0
      });

    } catch (error) {
      console.error('Dashboard fetch error:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

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
        <div className="container-mobile py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="heading-lg text-white">Welcome back!</h1>
              <p className="opacity-90">Discover who's nearby</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 p-2">
                <Bell className="w-5 h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/20 p-2"
                onClick={() => navigate('/premium')} // 3. FIX: Use navigate
              >
                <Crown className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 p-2">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
            <Input
              placeholder="Search friends or places..."
              className="pl-10 bg-white/20 border-white/30 text-white placeholder:text-white/70"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="container-mobile py-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="gradient-card shadow-card border-0">
            <CardContent className="p-4 text-center">
              <div className="gradient-primary text-white w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold">{stats.nearby}</div>
              <div className="text-xs text-muted-foreground">Friends</div>
            </CardContent>
          </Card>
          
          <Card className="gradient-card shadow-card border-0">
            <CardContent className="p-4 text-center">
              <div className="gradient-secondary text-white w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold">{stats.messages}</div>
              <div className="text-xs text-muted-foreground">Messages</div>
            </CardContent>
          </Card>
          
          <Card className="gradient-card shadow-card border-0">
            <CardContent className="p-4 text-center">
              <div className="bg-accent text-white w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold">{stats.events}</div>
              <div className="text-xs text-muted-foreground">Events</div>
            </CardContent>
          </Card>
        </div>

        {/* Nearby Friends */}
        <Card className="gradient-card shadow-card border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="heading-lg">Friends Nearby</CardTitle>
              <Button variant="ghost" size="sm" className="text-primary" onClick={() => navigate('/app/friends')}> 
                {/* 3. FIX: Use navigate */}
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-center text-muted-foreground py-4">Loading friends...</p>
            ) : nearbyFriends.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No friends nearby yet. Add some friends!</p>
            ) : (
              nearbyFriends.map((friend) => (
              <div key={friend.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-smooth">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={friend.avatar} />
                  <AvatarFallback className="gradient-primary text-white">
                    {friend.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{friend.name}</h3>
                    {getStatusBadge(friend.status)}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span>{friend.location} • {friend.distance}</span>
                  </div>
                </div>
                
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate('/app/messages')}> 
                  {/* 3. FIX: Use navigate */}
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Chat
                </Button>
              </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Button 
            className="h-16 gradient-primary text-white shadow-primary hover:shadow-glow transition-smooth"
            onClick={() => navigate('/create-event')} // 3. FIX: Use navigate
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Event
          </Button>
          <Button 
            variant="outline" 
            className="h-16 border-2 hover:bg-muted/50 transition-smooth"
            onClick={() => navigate('/app/map')} // 3. FIX: Use navigate
          >
            <MapPin className="w-5 h-5 mr-2" />
            View Map
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
