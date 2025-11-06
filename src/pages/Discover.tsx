import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, MapPin } from "lucide-react";

export default function Discover() {
  return (
    <div className="container-mobile py-4 space-y-4">
      <h1 className="text-2xl font-bold">Discover</h1>

      <Tabs defaultValue="communities" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="communities">Communities</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="communities" className="space-y-3 mt-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Tech Enthusiasts</h3>
                    <p className="text-sm text-muted-foreground">1.2K members</p>
                    <p className="text-sm mt-1">Join us for tech talks and networking</p>
                  </div>
                  <Button size="sm">Join</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="events" className="space-y-3 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="w-16 h-16 rounded-lg bg-gradient-primary flex flex-col items-center justify-center text-white">
                    <div className="text-xs font-medium">MAR</div>
                    <div className="text-2xl font-bold">{15 + i}</div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Community Meetup #{i}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <Calendar className="w-4 h-4" />
                      <span>March {15 + i}, 2024</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>Lagos, Nigeria</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">View</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
