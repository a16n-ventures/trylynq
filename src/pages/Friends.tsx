import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, UserPlus, Users, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useState as useVoiceCall } from 'react';
import VoiceCall from '@/components/features/VoiceCall';

const Friends = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCall, setActiveCall] = useState(null);

  // Mock data for different friend categories
  const nearbyFriends = [
    {
      id: 1,
      name: 'Alex Johnson',
      avatar: '',
      location: 'Downtown Campus',
      distance: '0.5 miles',
      status: 'online',
      mutualFriends: 5,
      lastSeen: 'Active now'
    },
    {
      id: 2,
      name: 'Sarah Chen',
      avatar: '',
      location: 'University Library',
      distance: '1.2 miles',
      status: 'away',
      mutualFriends: 3,
      lastSeen: '2 hours ago'
    }
  ];

  const suggestions = [
    {
      id: 3,
      name: 'Emma Wilson',
      avatar: '',
      mutualFriends: 8,
      reason: 'In your contacts',
      location: 'Same city'
    },
    {
      id: 4,
      name: 'David Kim',
      avatar: '',
      mutualFriends: 4,
      reason: 'Computer Science major',
      location: 'Campus'
    }
  ];

  const allFriends = [
    ...nearbyFriends,
    {
      id: 5,
      name: 'Jessica Rodriguez',
      avatar: '',
      location: 'Los Angeles',
      distance: '2,400 miles',
      status: 'offline',
      mutualFriends: 2,
      lastSeen: '1 day ago'
    },
    {
      id: 6,
      name: 'Michael Brown',
      avatar: '',
      location: 'Chicago',
      distance: '800 miles',
      status: 'online',
      mutualFriends: 6,
      lastSeen: 'Active now'
    }
  ];

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

  const FriendCard = ({ friend, showActions = true, showDistance = true }) => (
    <div className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-smooth">
      <Avatar className="w-12 h-12">
        <AvatarImage src={friend.avatar} />
        <AvatarFallback className="gradient-primary text-white">
          {friend.name.split(' ').map(n => n[0]).join('')}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold truncate">{friend.name}</h3>
          {friend.status && getStatusBadge(friend.status)}
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="w-3 h-3" />
          <span>{friend.location}</span>
          {showDistance && friend.distance && (
            <>
              <span>•</span>
              <span>{friend.distance}</span>
            </>
          )}
        </div>
        {friend.mutualFriends && (
          <p className="text-xs text-muted-foreground mt-1">
            {friend.mutualFriends} mutual friends
          </p>
        )}
      </div>
      
      {showActions && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="p-2">
            <MessageCircle className="w-4 h-4" />
          </Button>
          {friend.status === 'online' && (
            <Button 
              size="sm" 
              variant="outline" 
              className="p-2"
              onClick={() => setActiveCall(friend)}
            >
              <Phone className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const SuggestionCard = ({ suggestion }) => (
    <div className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-smooth">
      <Avatar className="w-12 h-12">
        <AvatarImage src={suggestion.avatar} />
        <AvatarFallback className="gradient-secondary text-white">
          {suggestion.name.split(' ').map(n => n[0]).join('')}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold truncate">{suggestion.name}</h3>
        <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <MapPin className="w-3 h-3" />
          <span>{suggestion.location}</span>
          <span>•</span>
          <span>{suggestion.mutualFriends} mutual friends</span>
        </div>
      </div>
      
      <Button size="sm" className="gradient-primary text-white">
        <UserPlus className="w-4 h-4 mr-1" />
        Add
      </Button>
    </div>
  );

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
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
              <UserPlus className="w-5 h-5 mr-2" />
              Add Friends
            </Button>
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
        <Tabs defaultValue="nearby" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="nearby">Nearby</TabsTrigger>
            <TabsTrigger value="all">All Friends</TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          </TabsList>

          <TabsContent value="nearby" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="gradient-card shadow-card border-0">
                <CardContent className="p-4 text-center">
                  <div className="gradient-primary text-white w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-2xl font-bold">{nearbyFriends.length}</div>
                  <div className="text-xs text-muted-foreground">Nearby Now</div>
                </CardContent>
              </Card>
              
              <Card className="gradient-card shadow-card border-0">
                <CardContent className="p-4 text-center">
                  <div className="gradient-secondary text-white w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="text-2xl font-bold">5</div>
                  <div className="text-xs text-muted-foreground">Same City</div>
                </CardContent>
              </Card>
            </div>

            {/* Nearby Friends */}
            <Card className="gradient-card shadow-card border-0">
              <CardHeader className="pb-3">
                <CardTitle className="heading-lg">Friends Nearby</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {nearbyFriends.map((friend, index) => (
                  <div key={friend.id}>
                    <FriendCard friend={friend} />
                    {index !== nearbyFriends.length - 1 && <div className="border-b border-border/50 mx-4" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="space-y-6">
            <Card className="gradient-card shadow-card border-0">
              <CardHeader className="pb-3">
                <CardTitle className="heading-lg">All Friends ({allFriends.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {allFriends.map((friend, index) => (
                  <div key={friend.id}>
                    <FriendCard friend={friend} />
                    {index !== allFriends.length - 1 && <div className="border-b border-border/50 mx-4" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-6">
            <Card className="gradient-card shadow-card border-0">
              <CardHeader className="pb-3">
                <CardTitle className="heading-lg">People You May Know</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {suggestions.map((suggestion, index) => (
                  <div key={suggestion.id}>
                    <SuggestionCard suggestion={suggestion} />
                    {index !== suggestions.length - 1 && <div className="border-b border-border/50 mx-4" />}
                  </div>
                ))}
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