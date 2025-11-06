import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Compass, Users, MapPin, MessageSquare, Calendar, User, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('discover');
  const [profile, setProfile] = useState<any>(null);
  const [notificationCount, setNotificationCount] = useState(3);

  const tabs = [
    { id: 'discover', icon: Compass, label: 'Discover', path: '/app/discover' },
    { id: 'friends', icon: Users, label: 'Friends', path: '/app/friends' },
    { id: 'map', icon: MapPin, label: 'Map', path: '/app/map' },
    { id: 'messages', icon: MessageSquare, label: 'Messages', path: '/app/messages' },
    { id: 'events', icon: Calendar, label: 'Events', path: '/app/events' },
  ];

  useEffect(() => {
    const currentTab = tabs.find(tab => tab.path === location.pathname);
    if (currentTab) {
      setActiveTab(currentTab.id);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => setProfile(data));
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="container-mobile flex items-center justify-between py-3">
          {/* Profile - Top Left */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => navigate('/app/profile')}
          >
            <Avatar className="w-8 h-8">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback>{profile?.display_name?.[0] || user?.email?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hidden sm:inline">{profile?.display_name || 'Profile'}</span>
          </Button>

          {/* Notification - Top Right */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => navigate('/app/notifications')}
          >
            <Bell className="w-5 h-5" />
            {notificationCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {notificationCount}
              </Badge>
            )}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
        <div className="container-mobile">
          <div className="flex items-center justify-around py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <Button
                  key={tab.id}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "flex flex-col items-center gap-1 h-auto py-3 px-2 transition-smooth",
                    isActive && "text-primary"
                  )}
                  onClick={() => {
                    setActiveTab(tab.id);
                    navigate(tab.path);
                  }}
                >
                  <div className={cn(
                    "p-2 rounded-xl transition-smooth",
                    isActive ? "gradient-primary text-white shadow-primary" : "hover:bg-muted"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium">{tab.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;