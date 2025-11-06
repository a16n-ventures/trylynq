import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, TrendingUp, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export default function Events() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  useState(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  });

  const { data: myEvents = [], isLoading: loadingMy } = useQuery({
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

  const { data: attendingEvents = [], isLoading: loadingAttending } = useQuery({
    queryKey: ["events", "attending", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data: attendees, error } = await supabase
        .from("event_attendees")
        .select("event_id")
        .eq("user_id", userId)
        .eq("status", "going");
      
      if (error || !attendees?.length) return [];
      
      const eventIds = attendees.map((a) => a.event_id);
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

  return (
    <div className="container-mobile py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
        <Button onClick={() => navigate('/create-event')} className="gap-2">
          <Plus className="w-4 h-4" />
          Create
        </Button>
      </div>

      <Tabs defaultValue="my" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="my">My Events</TabsTrigger>
          <TabsTrigger value="attending">Attending</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-3 mt-4">
          {loadingMy ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : myEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>You haven't created any events yet</p>
              <Button onClick={() => navigate('/create-event')} className="mt-4">
                Create Your First Event
              </Button>
            </div>
          ) : (
            myEvents.map((event) => (
              <Card key={event.id}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg bg-gradient-primary flex flex-col items-center justify-center text-white">
                      <div className="text-xs font-medium">{format(new Date(event.start_date), 'MMM').toUpperCase()}</div>
                      <div className="text-2xl font-bold">{format(new Date(event.start_date), 'd')}</div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{event.title}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="w-4 h-4" />
                        <span>{event.location || 'No location'}</span>
                      </div>
                      {event.ticket_price > 0 && (
                        <div className="text-sm font-medium text-primary mt-1">
                          ₦{event.ticket_price}
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="outline">Manage</Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="attending" className="space-y-3 mt-4">
          {loadingAttending ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : attendingEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>You're not attending any events</p>
            </div>
          ) : (
            attendingEvents.map((event) => (
              <Card key={event.id}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg bg-gradient-primary flex flex-col items-center justify-center text-white">
                      <div className="text-xs font-medium">{format(new Date(event.start_date), 'MMM').toUpperCase()}</div>
                      <div className="text-2xl font-bold">{format(new Date(event.start_date), 'd')}</div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{event.title}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="w-4 h-4" />
                        <span>{event.location || 'No location'}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">Details</Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="demographics" className="space-y-3 mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
                <h3 className="font-semibold">Event Analytics</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-sm text-muted-foreground">Total Events Created</span>
                  <span className="font-semibold">{myEvents.length}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-sm text-muted-foreground">Events Attending</span>
                  <span className="font-semibold">{attendingEvents.length}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-sm text-muted-foreground">Avg. Attendees</span>
                  <span className="font-semibold">12</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Most Popular Category</span>
                  <span className="font-semibold">Social</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Audience Demographics</h3>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Age 18-24</span>
                    <span>35%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '35%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Age 25-34</span>
                    <span>45%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '45%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Age 35+</span>
                    <span>20%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '20%' }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
