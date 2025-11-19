import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, TrendingUp, Plus, ExternalLink, Ticket, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

// --- TYPES (Matched to Database) ---
type Event = {
  id: string;
  title: string;       // Database column: title
  description?: string;
  start_date: string;  // Database column: start_date
  location: string;
  ticket_price: number;
  image_url?: string;
  creator_id: string;
};

// --- COMPONENTS ---
const EventSkeleton = () => (
  <div className="space-y-3">
    {[1, 2].map(i => (
      <Card key={i} className="border-0 shadow-sm bg-card/50">
        <CardContent className="p-4 flex gap-4">
          <div className="w-20 h-24 rounded-xl bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-1/2 bg-muted animate-pulse rounded" />
            <div className="h-4 w-1/3 bg-muted/50 animate-pulse rounded" />
            <div className="h-8 w-24 bg-muted animate-pulse rounded mt-2" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const EmptyState = ({ action }: { action: () => void }) => (
  <Card className="border-2 border-dashed border-muted bg-muted/5 shadow-none py-12">
    <CardContent className="flex flex-col items-center text-center space-y-3">
      <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-2">
        <Calendar className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <h3 className="font-semibold text-lg text-foreground">No Events Found</h3>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
        There are no upcoming events in this category. Why not host one?
      </p>
      <Button onClick={action} className="mt-4 gradient-primary text-white shadow-md">
        <Plus className="w-4 h-4 mr-2" /> Create Event
      </Button>
    </CardContent>
  </Card>
);

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
      
      const { data: attendees } = await supabase
        .from("event_attendees")
        .select("event_id")
        .eq("user_id", userId)
        .eq("status", "going");
      
      if (!attendees || attendees.length === 0) return [];
      
      const eventIds = attendees.map((a) => a.event_id);
      
      const { data: events } = await supabase
        .from("events")
        .select("*")
        .in("id", eventIds)
        .order("start_date", { ascending: true });
      
      return events || [];
    },
    enabled: !!userId,
  });

  // 3. Fetch Stats (Aggregated locally to avoid SQL sum issues)
  const { data: stats } = useQuery({
    queryKey: ["events", "stats", userId],
    queryFn: async () => {
      if (!userId) return { totalAttendees: 0 };
      
      // Get my event IDs
      const { data: myEventIds } = await supabase.from('events').select('id').eq('creator_id', userId);
      if (!myEventIds?.length) return { totalAttendees: 0 };
      
      const ids = myEventIds.map(e => e.id);

      // Count attendees
      const { count } = await supabase
        .from('event_attendees')
        .select('*', { count: 'exact', head: true })
        .in('event_id', ids)
        .eq('status', 'going');
      
      return { totalAttendees: count || 0 };
    },
    enabled: !!userId
  });

  const renderEventCard = (event: Event, type: 'mine' | 'attending') => (
    <Card key={event.id} className="overflow-hidden hover:shadow-md transition-all border-border/60 cursor-pointer group" onClick={() => navigate(`/events/${event.id}`)}>
      <CardContent className="p-0">
        <div className="flex h-32">
          {/* Date Strip or Image */}
          <div className="w-24 bg-muted/30 flex flex-col items-center justify-center p-2 border-r border-border/50 relative">
            {event.image_url ? (
               <img src={event.image_url} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            ) : (
               <>
                 <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                   {format(new Date(event.start_date), 'MMM')}
                 </span>
                 <span className="text-2xl font-bold text-primary">
                   {format(new Date(event.start_date), 'd')}
                 </span>
               </>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 p-4 min-w-0 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-bold truncate pr-2 text-lg leading-tight">{event.title}</h3>
                {event.ticket_price > 0 ? (
                  <Badge variant="secondary" className="shrink-0 bg-green-100 text-green-700 border-0">
                    ₦{event.ticket_price}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 text-muted-foreground">Free</Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{event.location || 'Online'}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-2">
               {type === 'mine' ? (
                 <Button size="sm" variant="outline" className="h-7 text-xs px-4 w-full">Manage</Button>
               ) : (
                 <Button size="sm" className="h-7 text-xs px-4 w-full gradient-primary text-white">View Ticket</Button>
               )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container-mobile py-4 space-y-6 pb-24">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-2xl font-bold tracking-tight">Events</h1>
        <Button onClick={() => navigate('/create-event')} size="sm" className="rounded-full shadow-md gap-1">
          <Plus className="w-4 h-4" /> Create
        </Button>
      </div>

      <Tabs defaultValue="my" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="my" className="rounded-lg">Hosted</TabsTrigger>
          <TabsTrigger value="attending" className="rounded-lg">Going</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-lg">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-3 mt-6 animate-in fade-in-50">
          {loadingMy ? <EventSkeleton /> : myEvents.length === 0 ? (
            <EmptyState action={() => navigate('/create-event')} />
          ) : (
            myEvents.map(e => renderEventCard(e, 'mine'))
          )}
        </TabsContent>

        <TabsContent value="attending" className="space-y-3 mt-6 animate-in fade-in-50">
          {loadingAttending ? <EventSkeleton /> : attendingEvents.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-muted rounded-xl bg-muted/5">
              <Ticket className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">You haven't joined any events yet.</p>
              <Button variant="link" onClick={() => navigate('/app/discover')}>Find Events</Button>
            </div>
          ) : (
            attendingEvents.map(e => renderEventCard(e, 'attending'))
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 mt-6 animate-in fade-in-50">
          <div className="grid grid-cols-2 gap-3">
            <Card className="gradient-card border-0 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-32">
                <div className="bg-primary/10 p-2 rounded-full mb-2"><Calendar className="w-5 h-5 text-primary" /></div>
                <span className="text-2xl font-bold">{myEvents.length}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Hosted</span>
              </CardContent>
            </Card>
            <Card className="gradient-card border-0 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-32">
                <div className="bg-blue-100 p-2 rounded-full mb-2"><Users className="w-5 h-5 text-blue-600" /></div>
                <span className="text-2xl font-bold">{stats?.totalAttendees || 0}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Attendees</span>
              </CardContent>
            </Card>
          </div>
          <Card className="border-muted/50 shadow-none bg-muted/10">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" /> Engagement</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Keep hosting! Consistent events grow your community 3x faster.</p></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
