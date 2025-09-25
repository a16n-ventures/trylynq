import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bell, MapPin, Users, MessageCircle, Plus, Settings, Search, Crown } from 'lucide-react';
import { Input } from '@/components/ui/input';

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data - in real app this would come from API
  const nearbyFriends = [
    {
      id: 1,
      name: 'Alex Johnson',
      avatar: '',
      location: 'Downtown',
      distance: '0.5 miles',
      status: 'online',
      lastSeen: 'Active now'
    },
    {
      id: 2,
      name: 'Sarah Chen',
      avatar: '',
      location: 'University District',
      distance: '1.2 miles',
      status: 'away',
      lastSeen: '2 hours ago'
    },
    {
      id: 3,
      name: 'Mike Rodriguez',
      avatar: '',
      location: 'Midtown',
      distance: '2.8 miles',
      status: 'online',
      lastSeen: 'Active now'
    }
  ];

  const recentActivity = [
    {
      id: 1,
      type: 'friend_nearby',
      message: 'Emma Wilson is now in your area',
      time: '5 minutes ago',
      action: 'Say Hi'
    },
    {
      id: 2,
      type: 'message',
      message: 'New message from David Kim',
      time: '1 hour ago',
      action: 'Reply'
    },
    {
      id: 3,
      type: 'event',
      message: 'Coffee meetup starting in 30 minutes',
      time: '2 hours ago',
      action: 'View Event'
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
                onClick={() => window.location.href = '/premium'}
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
              <div className="text-2xl font-bold">12</div>
              <div className="text-xs text-muted-foreground">Nearby</div>
            </CardContent>
          </Card>
          
          <Card className="gradient-card shadow-card border-0">
            <CardContent className="p-4 text-center">
              <div className="gradient-secondary text-white w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold">3</div>
              <div className="text-xs text-muted-foreground">Messages</div>
            </CardContent>
          </Card>
          
          <Card className="gradient-card shadow-card border-0">
            <CardContent className="p-4 text-center">
              <div className="bg-accent text-white w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold">5</div>
              <div className="text-xs text-muted-foreground">Events</div>
            </CardContent>
          </Card>
        </div>

        {/* Nearby Friends */}
        <Card className="gradient-card shadow-card border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="heading-lg">Friends Nearby</CardTitle>
              <Button variant="ghost" size="sm" className="text-primary">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {nearbyFriends.map((friend) => (
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
                
                <Button size="sm" variant="outline" className="shrink-0">
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Chat
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="gradient-card shadow-card border-0">
          <CardHeader className="pb-3">
            <CardTitle className="heading-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-smooth">
                <div className="gradient-primary w-2 h-2 rounded-full shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{activity.message}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
                <Button size="sm" variant="ghost" className="shrink-0 text-primary">
                  {activity.action}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Button 
            className="h-16 gradient-primary text-white shadow-primary hover:shadow-glow transition-smooth"
            onClick={() => window.location.href = '/create-event'}
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Event
          </Button>
          <Button 
            variant="outline" 
            className="h-16 border-2 hover:bg-muted/50 transition-smooth"
            onClick={() => window.location.href = '/app/map'}
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