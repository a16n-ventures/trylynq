import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Home, Users, MapPin, MessageCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MainLayout = () => {
  const [activeTab, setActiveTab] = useState('home');

  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'friends', icon: Users, label: 'Friends' },
    { id: 'map', icon: MapPin, label: 'Map' },
    { id: 'messages', icon: MessageCircle, label: 'Messages' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
                  onClick={() => setActiveTab(tab.id)}
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