import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, UserPlus, Users, MapPin, MessageCircle, Phone, Check, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import VoiceCall from '@/components/features/VoiceCall';

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  location: string | null;
  email: string | null;
}

interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  profiles?: Profile;
}

const Friends = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCall, setActiveCall] = useState<any>(null);
  const [acceptedFriends, setAcceptedFriends] = useState<Profile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    fetchFriendships();
    fetchSuggestions();

    // Subscribe to friendship changes
    const channel = supabase
      .channel('friendships-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships'
      }, () => {
        fetchFriendships();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchFriendships = async () => {
    if (!user) return;

    try {
      // Fetch accepted friends
      const { data: friendshipsData, error: friendshipsError } = await supabase
        .from('friendships')
        .select(`
          id,
          requester_id,
          addressee_id,
          status
        `)
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (friendshipsError) throw friendshipsError;

      // Get friend IDs
      const friendIds = friendshipsData?.map(f => 
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      ) || [];

      // Fetch friend profiles
      if (friendIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', friendIds);

        if (profilesError) throw profilesError;
        setAcceptedFriends(profilesData || []);
      } else {
        setAcceptedFriends([]);
      }

      // Fetch pending requests (where current user is addressee)
      const { data: pendingData, error: pendingError } = await supabase
        .from('friendships')
        .select('*')
        .eq('addressee_id', user.id)
        .eq('status', 'pending');

      if (pendingError) throw pendingError;

      // Fetch requester profiles for pending requests
      if (pendingData && pendingData.length > 0) {
        const requesterIds = pendingData.map(f => f.requester_id);
        const { data: requesterProfiles, error: requesterError } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', requesterIds);

        if (requesterError) throw requesterError;

        const requestsWithProfiles = pendingData.map(request => ({
          ...request,
          profiles: requesterProfiles?.find(p => p.user_id === request.requester_id)
        }));

        setPendingRequests(requestsWithProfiles);
      } else {
        setPendingRequests([]);
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching friendships:', err);
      toast.error('Failed to load friends');
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    if (!user) return;

    try {
      // Get current friend IDs and pending request IDs
      const { data: existingConnections, error: connectionsError } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (connectionsError) throw connectionsError;

      const connectedUserIds = new Set(
        existingConnections?.flatMap(f => [f.requester_id, f.addressee_id]) || []
      );
      connectedUserIds.add(user.id);

      // Fetch users not yet connected
      const { data: suggestionsData, error: suggestionsError } = await supabase
        .from('profiles')
        .select('*')
        .not('user_id', 'in', `(${Array.from(connectedUserIds).join(',')})`)
        .limit(10);

      if (suggestionsError) throw suggestionsError;
      setSuggestions(suggestionsData || []);
    } catch (err: any) {
      console.error('Error fetching suggestions:', err);
    }
  };

  const sendFriendRequest = async (addresseeId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .insert({
          requester_id: user.id,
          addressee_id: addresseeId,
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Friend request sent!');
      fetchSuggestions();
    } catch (err: any) {
      console.error('Error sending friend request:', err);
      toast.error('Failed to send friend request');
    }
  };

  const respondToRequest = async (requestId: string, accept: boolean) => {
    try {
      if (accept) {
        const { error } = await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', requestId);

        if (error) throw error;
        toast.success('Friend request accepted!');
      } else {
        const { error } = await supabase
          .from('friendships')
          .delete()
          .eq('id', requestId);

        if (error) throw error;
        toast.success('Friend request declined');
      }

      fetchFriendships();
    } catch (err: any) {
      console.error('Error responding to request:', err);
      toast.error('Failed to respond to friend request');
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

  const FriendCard = ({ friend, showActions = true }: { friend: Profile; showActions?: boolean }) => (
    <div className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-smooth">
      <Avatar className="w-12 h-12">
        <AvatarImage src={friend.avatar_url || ''} />
        <AvatarFallback className="gradient-primary text-white">
          {(friend.display_name || friend.email || 'U').substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold truncate">{friend.display_name || friend.email || 'User'}</h3>
        </div>
        {friend.location && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{friend.location}</span>
          </div>
        )}
      </div>
      
      {showActions && (
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="p-2"
            onClick={() => navigate(`/app/messages?user=${friend.user_id}`)}
          >
            <MessageCircle className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );

  const SuggestionCard = ({ suggestion }: { suggestion: Profile }) => (
    <div className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-smooth">
      <Avatar className="w-12 h-12">
        <AvatarImage src={suggestion.avatar_url || ''} />
        <AvatarFallback className="gradient-secondary text-white">
          {(suggestion.display_name || suggestion.email || 'U').substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold truncate">{suggestion.display_name || suggestion.email || 'User'}</h3>
        {suggestion.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <MapPin className="w-3 h-3" />
            <span>{suggestion.location}</span>
          </div>
        )}
      </div>
      
      <Button 
        size="sm" 
        className="gradient-primary text-white"
        onClick={() => sendFriendRequest(suggestion.user_id)}
      >
        <UserPlus className="w-4 h-4 mr-1" />
        Add
      </Button>
    </div>
  );

  const PendingRequestCard = ({ request }: { request: Friendship }) => {
    if (!request.profiles) return null;
    
    return (
      <div className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-smooth">
        <Avatar className="w-12 h-12">
          <AvatarImage src={request.profiles.avatar_url || ''} />
          <AvatarFallback className="gradient-secondary text-white">
            {(request.profiles.display_name || request.profiles.email || 'U').substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{request.profiles.display_name || request.profiles.email || 'User'}</h3>
          <p className="text-sm text-muted-foreground">Sent you a friend request</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            className="gradient-primary text-white p-2"
            onClick={() => respondToRequest(request.id, true)}
          >
            <Check className="w-4 h-4" />
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            className="p-2"
            onClick={() => respondToRequest(request.id, false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading friends...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {activeCall && (
        <VoiceCall
          contact={activeCall}
          onEndCall={() => setActiveCall(null)}
        />
      )}
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="gradient-primary text-white">
          <div className="container-mobile py-4">
            <div className="flex items-center justify-between mb-4">
              <h1 className="heading-lg text-white">Friends</h1>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
              <Input
                placeholder="Search friends..."
                className="pl-10 bg-white/20 border-white/30 text-white placeholder:text-white/70"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="container-mobile py-6">
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">
                All ({acceptedFriends.length})
              </TabsTrigger>
              <TabsTrigger value="requests">
                Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
              </TabsTrigger>
              <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="gradient-card shadow-card border-0">
                  <CardContent className="p-4 text-center">
                    <div className="gradient-primary text-white w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="text-2xl font-bold">{acceptedFriends.length}</div>
                    <div className="text-xs text-muted-foreground">Total Friends</div>
                  </CardContent>
                </Card>
                
                <Card className="gradient-card shadow-card border-0">
                  <CardContent className="p-4 text-center">
                    <div className="gradient-secondary text-white w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div className="text-2xl font-bold">{pendingRequests.length}</div>
                    <div className="text-xs text-muted-foreground">Pending</div>
                  </CardContent>
                </Card>
              </div>

              {/* All Friends */}
              <Card className="gradient-card shadow-card border-0">
                <CardHeader className="pb-3">
                  <CardTitle className="heading-lg">All Friends</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {acceptedFriends.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No friends yet. Start by adding some!</p>
                    </div>
                  ) : (
                    acceptedFriends
                      .filter(f => 
                        !searchQuery || 
                        (f.display_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        (f.email?.toLowerCase().includes(searchQuery.toLowerCase()))
                      )
                      .map((friend, index) => (
                        <div key={friend.user_id}>
                          <FriendCard friend={friend} />
                          {index !== acceptedFriends.length - 1 && <div className="border-b border-border/50 mx-4" />}
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="requests" className="space-y-6">
              <Card className="gradient-card shadow-card border-0">
                <CardHeader className="pb-3">
                  <CardTitle className="heading-lg">Friend Requests</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {pendingRequests.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No pending friend requests</p>
                    </div>
                  ) : (
                    pendingRequests.map((request, index) => (
                      <div key={request.id}>
                        <PendingRequestCard request={request} />
                        {index !== pendingRequests.length - 1 && <div className="border-b border-border/50 mx-4" />}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="suggestions" className="space-y-6">
              <Card className="gradient-card shadow-card border-0">
                <CardHeader className="pb-3">
                  <CardTitle className="heading-lg">People You May Know</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {suggestions.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No suggestions available</p>
                    </div>
                  ) : (
                    suggestions.map((suggestion, index) => (
                      <div key={suggestion.user_id}>
                        <SuggestionCard suggestion={suggestion} />
                        {index !== suggestions.length - 1 && <div className="border-b border-border/50 mx-4" />}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default Friends;
