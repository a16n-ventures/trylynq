import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, MapPin, MessageCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FloatingActionButton } from '@/components/ui/floating-action-button';

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('home');

  const tabs = [
    { id: 'home', icon: Home, label: 'Home', path: '/app' },
    { id: 'map', icon: MapPin, label: 'Map', path: '/app/map' },
    { id: 'messages', icon: MessageCircle, label: 'Messages', path: '/app/messages' },
    { id: 'friends', icon: Users, label: 'Friends', path: '/app/friends' },
    { id: 'profile', icon: User, label: 'Profile', path: '/app/profile' },
  ];

  useEffect(() => {
    const currentTab = tabs.find(tab => tab.path === location.pathname);
    if (currentTab) {
      setActiveTab(currentTab.id);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content */}
      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      {/* Floating Action Button for Create Event */}
      <FloatingActionButton 
        onClick={() => navigate('/create-event')}
        label="Create Event"
      />

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