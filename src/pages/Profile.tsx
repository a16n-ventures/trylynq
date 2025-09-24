import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Settings, Edit3, MapPin, Users, Camera, Bell, Shield, LogOut } from 'lucide-react';

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [locationSharing, setLocationSharing] = useState(true);
  const [notifications, setNotifications] = useState(true);

  // Mock user data
  const user = {
    name: 'John Doe',
    email: 'john.doe@university.edu',
    bio: 'Computer Science student at University. Love exploring new places and meeting friends!',
    avatar: '',
    location: 'University Campus',
    joinDate: 'March 2024',
    friends: 127,
    mutualFriends: 24
  };

  const stats = [
    { label: 'Friends', value: user.friends, icon: Users },
    { label: 'Events Joined', value: 12, icon: MapPin },
    { label: 'Messages Sent', value: 2847, icon: Bell }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-primary text-white">
        <div className="container-mobile py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="heading-lg text-white">Profile</h1>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/20"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit3 className="w-5 h-5 mr-2" />
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
          </div>

          {/* Profile Info */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <AvatarImage src={user.avatar} />
                <AvatarFallback className="bg-white/20 text-white text-2xl">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <Button 
                  size="sm" 
                  className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full gradient-secondary text-white p-0"
                >
                  <Camera className="w-4 h-4" />
                </Button>
              )}
            </div>
            
            <div className="flex-1">
              {isEditing ? (
                <Input 
                  defaultValue={user.name}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/70 mb-2"
                />
              ) : (
                <h2 className="heading-lg text-white mb-1">{user.name}</h2>
              )}
              <div className="flex items-center gap-1 text-white/80 text-sm">
                <MapPin className="w-4 h-4" />
                <span>{user.location}</span>
              </div>
              <p className="text-white/70 text-sm">Member since {user.joinDate}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-mobile py-6 space-y-6">
        {/* Bio Section */}
        <Card className="gradient-card shadow-card border-0">
          <CardHeader className="pb-3">
            <CardTitle className="heading-lg">About</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea 
                defaultValue={user.bio}
                placeholder="Tell people about yourself..."
                className="min-h-[100px]"
              />
            ) : (
              <p className="text-muted-foreground">{user.bio}</p>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="gradient-card shadow-card border-0">
                <CardContent className="p-4 text-center">
                  <div className="gradient-primary text-white w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Settings */}
        <Card className="gradient-card shadow-card border-0">
          <CardHeader className="pb-3">
            <CardTitle className="heading-lg">Privacy & Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Location Sharing</h4>
                <p className="text-sm text-muted-foreground">Let friends see your general location</p>
              </div>
              <Switch 
                checked={locationSharing}
                onCheckedChange={setLocationSharing}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Push Notifications</h4>
                <p className="text-sm text-muted-foreground">Get notified about messages and events</p>
              </div>
              <Switch 
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card className="gradient-card shadow-card border-0">
          <CardContent className="p-4 space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <Settings className="w-4 h-4 mr-3" />
              Account Settings
            </Button>
            
            <Button variant="outline" className="w-full justify-start">
              <Shield className="w-4 h-4 mr-3" />
              Privacy Policy
            </Button>
            
            <Button variant="outline" className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50">
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </Button>
          </CardContent>
        </Card>

        {isEditing && (
          <div className="grid grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
            <Button 
              className="gradient-primary text-white"
              onClick={() => setIsEditing(false)}
            >
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;