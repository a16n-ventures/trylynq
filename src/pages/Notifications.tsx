import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Bell, UserPlus, Calendar, Heart } from "lucide-react";

const mockNotifications = [
  { id: 1, type: 'friend_request', user: 'John Doe', message: 'sent you a friend request', time: '2m ago', icon: UserPlus },
  { id: 2, type: 'event', user: 'Sarah Smith', message: 'invited you to Tech Meetup', time: '1h ago', icon: Calendar },
  { id: 3, type: 'like', user: 'Mike Johnson', message: 'liked your post', time: '3h ago', icon: Heart },
  { id: 4, type: 'friend_request', user: 'Emma Wilson', message: 'accepted your friend request', time: '5h ago', icon: UserPlus },
];

export default function Notifications() {
  return (
    <div className="container-mobile py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Button variant="ghost" size="sm">Mark all as read</Button>
      </div>

      <div className="space-y-2">
        {mockNotifications.map((notification) => {
          const Icon = notification.icon;
          return (
            <Card key={notification.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={undefined} />
                      <AvatarFallback>{notification.user[0]}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Icon className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">{notification.user}</span>{' '}
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                  </div>
                  {notification.type === 'friend_request' && notification.message.includes('sent') && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="default">Accept</Button>
                      <Button size="sm" variant="outline">Decline</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
