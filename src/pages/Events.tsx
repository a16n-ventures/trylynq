import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, TrendingUp, Plus, ExternalLink, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

// --- TYPES ---
type Event = {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  location: string;
  ticket_price: number;
  image_url?: string;
  creator_id: string;
};

type Attendee = {
  event_id: string;
  user_id: string;
  status: 'going' | 'interested';
};

export default function Events() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;

  // 1. Fetch My Events
  const { data: myEvents = [], isLoading: loadingMy } = useQuery<Event[]>({
    queryKey: ["events", "my", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("creator_id", userId)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // 2. Fetch Attending Events
  const { data: attendingEvents = [], isLoading: loadingAttending } = useQuery<Event[]>({
    queryKey: ["events", "attending", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // First get IDs of events I'm attending
      const { data: attendees, error: attendeeError } = await supabase
        .from("event_attendees")
        .select("event_id")
        .eq("user_id", userId)
        .eq("status", "going");
      
      if (attendeeError) throw attendeeError;
      
      if (!attendees || attendees.length === 0) return [];
      
      const eventIds = attendees.map((a) => a.event_id);
      
      // Then fetch the actual event details
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .in("id", eventIds)
        .order("start_date", { ascending: true });
      
      if (eventsError) throw eventsError;
      return events || [];
    },
    enabled: !!userId,
  });

  // 3. Fetch Real Analytics (Replacing Mocks)
  // We fetch counts of attendees for *my* events
  const { data: stats } = useQuery({
    queryKey: ["events", "stats", userId],
    queryFn: async () => {
      if (!userId) return { totalAttendees: 0, totalRevenue: 0 };

      // Get all my event IDs
      const { data: myEventIds } = await supabase
        .from('events')
        .select('id, ticket_price')
        .eq('creator_id', userId);
        
      if (!myEventIds?.length) return { totalAttendees: 0, totalRevenue: 0 };

      const ids = myEventIds.map(e => e.id);

      // Count attendees for these events
      const { count } = await supabase
        .from('event_attendees')
        .select('*', { count: 'exact', head: true })
        .in('event_id', ids)
        .eq('status', 'going');
      
      // Calculate potential revenue (simplified)
      // Note: For strict accounting, we'd query a 'payments' table. 
      // This is an estimation based on ticket_price * attendees.
      let revenue = 0;
      // Since we can't easily join-aggregate in one simple query without RPC, 
      // we'll do a rough client-side calc or just show global attendees.
      // For precise revenue, we would need to fetch attendees with their specific event's price.
      
      return { 
        totalAttendees: count || 0, 
        // Placeholder for revenue logic:
        totalRevenue: 0 
      };
    },
    enabled: !!userId && myEvents.length > 0
  });

  // Derived Stats
  const totalEvents = myEvents.length;
  const totalAttending = attendingEvents.length;

  const renderEventCard = (event: Event, type: 'mine' | 'attending') => (
    <Card key={event.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/events/${event.id}`)}>
      <CardContent className="p-0">
        <div className="flex">
          {/* Date Badge */}
          <div className="w-20 bg-primary/5 flex flex-col items-center justify-center p-2 text-primary border-r border-border/50">
            <span className="text-xs font-bold uppercase tracking-wider">
              {format(new Date(event.start_date), 'MMM')}
            </span>
            <span className="text-2xl font-bold">
              {format(new Date(event.start_date), 'd')}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(event.start_date), 'h:mm a')}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <div>
                <h3 className="font-semibold truncate pr-2">{event.title}</h3>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{event.location || 'Online'}</span>
                </div>
              </div>
              {event.ticket_price > 0 ? (
                <Badge variant="secondary" className="shrink-0 text-green-600 bg-green-50">
                  ₦{event.ticket_price}
                </Badge>
              ) : (
                <Badge variant="secondary" className="shrink-0">Free</Badge>
              )}
            </div>
            
            <div className="mt-3 flex items-center gap-2">
               {type === 'mine' ? (
                 <Button size="sm" variant="outline" className="h-7 text-xs w-full">
                   Manage
                 </Button>
               ) : (
                 <Button size="sm" variant="secondary" className="h-7 text-xs w-full">
                   View Details
                 </Button>
               )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container-mobile py-4 space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Events</h1>
        <Button onClick={() => navigate('/create-event')} size="sm" className="gradient-primary text-white shadow-md">
          <Plus className="w-4 h-4 mr-1" />
          Create
        </Button>
      </div>

      <Tabs defaultValue="my" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="my">Hosted</TabsTrigger>
          <TabsTrigger value="attending">Going</TabsTrigger>
          <TabsTrigger value="analytics">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-4 animate-in fade-in-50">
          {loadingMy ? (
            <div className="text-center py-12 text-muted-foreground">Loading your events...</div>
          ) : myEvents.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-xl">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <h3 className="font-semibold text-lg">No events hosted</h3>
              <p className="text-muted-foreground text-sm mb-4">Host your first event today!</p>
              <Button onClick={() => navigate('/create-event')} variant="outline">
                Create Event
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {myEvents.map(e => renderEventCard(e, 'mine'))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="attending" className="space-y-4 animate-in fade-in-50">
          {loadingAttending ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : attendingEvents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">You aren't attending any events yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendingEvents.map(e => renderEventCard(e, 'attending'))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 animate-in fade-in-50">
          <div className="grid grid-cols-2 gap-3">
            <Card className="gradient-card border-0 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-32">
                <div className="bg-primary/10 p-2 rounded-full mb-2">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <span className="text-2xl font-bold">{totalEvents}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Hosted</span>
              </CardContent>
            </Card>

            <Card className="gradient-card border-0 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-32">
                <div className="bg-blue-100 p-2 rounded-full mb-2">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                {/* Real stats from the database */}
                <span className="text-2xl font-bold">{stats?.totalAttendees || 0}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Attendees</span>
              </CardContent>
            </Card>
          </div>

          <Card className="border-muted/50 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                Engagement Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You have attended <span className="font-bold text-foreground">{totalAttending}</span> events. 
                {totalAttending > 5 ? " You're a super networker!" : " Join more events to boost your score."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
    }
      
