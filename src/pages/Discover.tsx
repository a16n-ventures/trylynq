import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, MapPin, X, Loader2 } from "lucide-react";
import React, { useState, useEffect } from "react";
// Assumed Supabase client import path
import { supabase } from "@/lib/supabase/client"; 

// --- Type Definitions for Supabase Data ---

// For the story tray (assumes a 'profiles' table)
interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  // Assumes you have a way to track this, e.g., a DB view or function
  // We will query for profiles that *have* stories posted in the last 24h
}

// For the story viewer modal (assumes a 'stories' table)
interface Story {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  user_id: string; // Foreign key to profiles
  created_at: string;
}

// For the Communities tab
interface Community {
  id: string;
  name: string;
  member_count: number;
  description: string;
  avatar_url: string | null;
}

// For the Events tab
interface Event {
  id: string;
  name: string;
  event_date: string; // ISO timestamp string
  location: string;
}


// --- Story Viewer Component ---
// To provide the "full functionality" of viewing a story

interface StoryViewerProps {
  user: Profile;
  onClose: () => void;
}

function StoryViewer({ user, onClose }: StoryViewerProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch all active stories for this user
  useEffect(() => {
    async function fetchUserStories() {
      setLoading(true);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching stories:', error);
      } else if (data) {
        setStories(data);
      }
      setLoading(false);
    }
    fetchUserStories();
  }, [user.id]);

  const goToNextStory = () => {
    setCurrentStoryIndex((prev) => Math.min(prev + 1, stories.length - 1));
  };

  const goToPrevStory = () => {
    setCurrentStoryIndex((prev) => Math.max(prev - 1, 0));
  };

  const currentStory = stories[currentStoryIndex];

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white z-50"
      >
        <X className="w-8 h-8" />
      </button>

      {loading && <Loader2 className="w-10 h-10 text-white animate-spin" />}
      
      {!loading && stories.length === 0 && (
        <div className="text-white text-center">
          <p>No active stories for this user.</p>
          <Button onClick={onClose} variant="outline" className="mt-4">Close</Button>
        </div>
      )}

      {!loading && currentStory && (
        <div className="relative w-full max-w-md h-[90vh] bg-black rounded-lg overflow-hidden">
          {/* Story Content */}
          <div className="absolute inset-0 flex items-center justify-center">
            {currentStory.media_type === 'image' ? (
              <img
                src={currentStory.media_url}
                alt="Story"
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                src={currentStory.media_url}
                className="w-full h-full object-contain"
                autoPlay
                playsInline
                onEnded={goToNextStory} // Auto-advance on video end
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          {/* User Info */}
          <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/50 to-transparent">
            <div className="flex items-center gap-2">
              <img src={user.avatar_url} alt={user.username} className="w-10 h-10 rounded-full border-2 border-white object-cover" />
              <span className="text-white font-semibold">{user.username}</span>
            </div>
          </div>
          
          {/* Navigation */}
          <div className="absolute inset-y-0 left-0 w-1/3" onClick={goToPrevStory} />
          <div className="absolute inset-y-0 right-0 w-1/3" onClick={goToNextStory} />
        </div>
      )}
    </div>
  );
}


// --- Main Discover Component ---

export default function Discover() {
  const [storyUsers, setStoryUsers] = useState<Profile[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedStoryUser, setSelectedStoryUser] = useState<Profile | null>(null);

  useEffect(() => {
    // Fetch users who have active stories
    async function fetchStoryUsers() {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // Query profiles that have at least one story (using inner join)
      // created in the last 24 hours.
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, 
          username, 
          avatar_url,
          stories!inner (id, created_at)
        `)
        .filter('stories.created_at', 'gte', oneDayAgo)
        .limit(15);

      if (error) {
        console.error('Error fetching story users:', error);
      } else if (data) {
        // We only need profile data, not the nested stories here
        setStoryUsers(data as Profile[]);
      }
    }

    // Fetch communities
    async function fetchCommunities() {
      const { data, error } = await supabase
        .from('communities')
        .select('*')
        .limit(10); // Example limit

      if (error) {
        console.error('Error fetching communities:', error);
      } else if (data) {
        setCommunities(data);
      }
    }

    // Fetch events
    async function fetchEvents() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true })
        .limit(10); // Example limit

      if (error) {
        console.error('Error fetching events:', error);
      } else if (data) {
        setEvents(data);
      }
    }

    fetchStoryUsers();
    fetchCommunities();
    fetchEvents();
  }, []);

  const openStory = (user: Profile) => {
    setSelectedStoryUser(user);
  };

  const closeStory = () => {
    setSelectedStoryUser(null);
  };

  // Helper to format event date
  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
    const day = date.getDate();
    const fullDate = date.toLocaleDateString('default', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return { month, day, fullDate };
  };

  return (
    <>
      <div className="container-mobile py-4 space-y-4">
        {/* --- Story Tray Feature --- */}
        <div className="w-full overflow-x-auto pb-2 -mt-2">
          <div className="flex gap-4 px-1">
            {storyUsers.map((user) => (
              <div
                key={user.id}
                className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0"
                onClick={() => openStory(user)}
              >
                <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600">
                  <div className="w-full h-full rounded-full bg-background p-0.5">
                    <img
                      src={user.avatar_url}
                      alt={user.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                </div>
                <span className="text-xs font-medium max-w-16 truncate">
                  {user.username}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* --- Original Content --- */}
        <h1 className="text-2xl font-bold">Discover</h1>

        <Tabs defaultValue="communities" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="communities">Communities</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          {/* --- Communities Tab (Live Data) --- */}
          <TabsContent value="communities" className="space-y-3 mt-4">
            {communities.length === 0 && <p className="text-muted-foreground text-sm">No communities found.</p>}
            
            {communities.map((community) => (
              <Card key={community.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {community.avatar_url ? (
                         <img src={community.avatar_url} alt={community.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <Users className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{community.name}</h3>
                      <p className="text-sm text-muted-foreground">{community.member_count} members</p>
                      <p className="text-sm mt-1">{community.description}</p>
                    </div>
                    <Button size="sm">Join</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* --- Events Tab (Live Data) --- */}
          <TabsContent value="events" className="space-y-3 mt-4">
            {events.length === 0 && <p className="text-muted-foreground text-sm">No events found.</p>}

            {events.map((event) => {
              const { month, day, fullDate } = formatEventDate(event.event_date);
              return (
                <Card key={event.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-lg bg-gradient-primary flex flex-col items-center justify-center text-white flex-shrink-0">
                        <div className="text-xs font-medium">{month}</div>
                        <div className="text-2xl font-bold">{day}</div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{event.name}</h3>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <Calendar className="w-4 h-4" />
                          <span>{fullDate}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span>{event.location}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">View</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>

      {/* --- Story Viewer Modal --- */}
      {selectedStoryUser && (
        <StoryViewer user={selectedStoryUser} onClose={closeStory} />
      )}
    </>
  );
}
