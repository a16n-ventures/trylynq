import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Settings, Edit3, MapPin, Users, Camera, Bell, Shield, LogOut, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [locationSharing, setLocationSharing] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [stats, setStats] = useState({ friends: 0, events: 0, messages: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setDisplayName(profileData.display_name || '');
        setBio(profileData.bio || '');
      }

      // Fetch location sharing status
      const { data: locationData } = await supabase
        .from('user_locations')
        .select('is_sharing_location')
        .eq('user_id', user?.id)
        .single();

      if (locationData) {
        setLocationSharing(locationData.is_sharing_location);
      }

      // Count friends
      const { count: friendCount } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user?.id},addressee_id.eq.${user?.id}`);

      // Count events
      const { count: eventCount } = await supabase
        .from('event_attendees')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      // Count messages sent
      const { count: messageCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', user?.id);

      setStats({
        friends: friendCount || 0,
        events: eventCount || 0,
        messages: messageCount || 0
      });

    } catch (error) {
      console.error('Profile fetch error:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          bio: bio
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
      setIsEditing(false);
      fetchProfile();
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile');
    }
  };

  const handleLocationToggle = async (checked: boolean) => {
    setLocationSharing(checked);
    try {
      await supabase
        .from('user_locations')
        .update({ is_sharing_location: checked })
        .eq('user_id', user?.id);
      
      toast.success(checked ? 'Location sharing enabled' : 'Location sharing disabled');
    } catch (error) {
      console.error('Location toggle error:', error);
      toast.error('Failed to update location sharing');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading profile...</p>
      </div>
    );
  }

  const statsList = [
    { label: 'Friends', value: stats.friends, icon: Users },
    { label: 'Events Joined', value: stats.events, icon: MapPin },
    { label: 'Messages Sent', value: stats.messages, icon: Bell }
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
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-white/20 text-white text-2xl">
                  {displayName.split(' ').map(n => n[0]).join('') || 'U'}
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
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/70 mb-2"
                  placeholder="Your name"
                />
              ) : (
                <h2 className="heading-lg text-white mb-1">{displayName || 'Set your name'}</h2>
              )}
              <p className="text-white/70 text-sm">{user?.email}</p>
              <p className="text-white/70 text-sm">Member since {new Date(profile?.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
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
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people about yourself..."
                className="min-h-[100px]"
              />
            ) : (
              <p className="text-muted-foreground">{bio || 'No bio yet. Add one by editing your profile!'}</p>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {statsList.map((stat, index) => {
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
                onCheckedChange={handleLocationToggle}
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
            <Button 
              variant="outline" 
              className="w-full justify-start gradient-primary text-white border-0 hover:opacity-90"
              onClick={() => navigate('/premium')}
            >
              <Crown className="w-4 h-4 mr-3" />
              Upgrade to Premium
            </Button>

            <Button variant="outline" className="w-full justify-start">
              <Settings className="w-4 h-4 mr-3" />
              Account Settings
            </Button>
            
            <Button variant="outline" className="w-full justify-start">
              <Shield className="w-4 h-4 mr-3" />
              Privacy Policy
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </Button>
          </CardContent>
        </Card>

        {isEditing && (
          <div className="grid grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditing(false);
                setDisplayName(profile?.display_name || '');
                setBio(profile?.bio || '');
              }}
            >
              Cancel
            </Button>
            <Button 
              className="gradient-primary text-white"
              onClick={handleSave}
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