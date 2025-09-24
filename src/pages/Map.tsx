import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';

const Map = () => {
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data for friends on map
  const friendsOnMap = [
    {
      id: 1,
      name: 'Alex Johnson',
      avatar: '',
      location: 'Downtown Campus',
      coordinates: { lat: 40.7128, lng: -74.0060 },
      status: 'online',
      lastSeen: 'Active now',
      distance: '0.5 miles'
    },
    {
      id: 2,
      name: 'Sarah Chen',
      avatar: '',
      location: 'University Library',
      coordinates: { lat: 40.7580, lng: -73.9855 },
      status: 'away',
      lastSeen: '2 hours ago',
      distance: '1.2 miles'
    },
    {
      id: 3,
      name: 'Mike Rodriguez',
      avatar: '',
      location: 'Coffee District',
      coordinates: { lat: 40.7505, lng: -73.9934 },
      status: 'online',
      lastSeen: 'Active now',
      distance: '0.8 miles'
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-primary text-white">
        <div className="container-mobile py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="heading-lg text-white">Friend Map</h1>
            <div className="flex items-center gap-2">
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
        {/* Map Placeholder */}
        <Card className="gradient-card shadow-card border-0 h-80">
          <CardContent className="p-0 relative h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-12 h-12 mx-auto mb-4 text-primary" />
                <p className="text-sm text-muted-foreground">Interactive map will be here</p>
                <p className="text-xs text-muted-foreground mt-1">Showing {friendsOnMap.length} friends nearby</p>
              </div>
            </div>
            
            {/* Mock friend pins overlay */}
            <div className="absolute top-4 right-4 space-y-2">
              {friendsOnMap.slice(0, 2).map((friend, index) => (
                <div 
                  key={friend.id}
                  className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-sm cursor-pointer"
                  onClick={() => setSelectedFriend(friend)}
                >
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span className="text-xs font-medium">{friend.name}</span>
                </div>
              ))}
            </div>
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
                  
                  <Button size="sm" variant="outline">
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
                <Button className="gradient-primary text-white">
                  Send Message
                </Button>
                <Button variant="outline">
                  Get Directions
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Map;