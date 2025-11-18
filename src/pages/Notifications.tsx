import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Bell, UserPlus, Calendar, Heart, Loader2, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// --- Types ---
type NotificationType = 'friend_request' | 'event_invite' | 'like' | 'system';

type Notification = {
  id: string;
  type: NotificationType;
  created_at: string;
  read: boolean;
  sender_id?: string;
  event_id?: string; // Optional, for event invites
  metadata?: any; // Flexible field for extra data
  sender?: {
    display_name: string;
    avatar_url: string;
  };
};

export default function Notifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // 1. Fetch Notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("notifications") // Ensure this table exists
        .select(`
          id, type, created_at, read, metadata,
          sender:profiles!sender_id (display_name, avatar_url)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // 2. Mutation: Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user?.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications cleared");
    }
  });

  // 3. Mutation: Accept Friend Request (Directly from notification)
  const acceptFriendMutation = useMutation({
    mutationFn: async ({ notificationId, senderId }: { notificationId: string, senderId: string }) => {
      // 1. Accept the friendship
      const { error: friendError } = await supabase
        .from("friendships")
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq("requester_id", senderId)
        .eq("addressee_id", user?.id); // Ensure safety
      
      if (friendError) throw friendError;

      // 2. Delete/Archive the notification so it doesn't show again
      await supabase.from("notifications").delete().eq("id", notificationId);
    },
    onSuccess: () => {
      toast.success("Friend request accepted!");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] }); // Update friends list too
    },
    onError: () => toast.error("Failed to accept request")
  });

  const declineFriendMutation = useMutation({
    mutationFn: async ({ notificationId, senderId }: { notificationId: string, senderId: string }) => {
      await supabase.from("friendships").delete().eq("requester_id", senderId).eq("addressee_id", user?.id);
      await supabase.from("notifications").delete().eq("id", notificationId);
    },
    onSuccess: () => {
      toast.info("Request declined");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  // --- Render Helpers ---

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'friend_request': return <UserPlus className="w-3 h-3 text-white" />;
      case 'event_invite': return <Calendar className="w-3 h-3 text-white" />;
      case 'like': return <Heart className="w-3 h-3 text-white" />;
      default: return <Bell className="w-3 h-3 text-white" />;
    }
  };

  const getMessage = (n: Notification) => {
    switch (n.type) {
      case 'friend_request': return "sent you a friend request";
      case 'event_invite': return `invited you to an event`;
      case 'like': return "liked your post";
      case 'system': return n.metadata?.message || "System notification";
      default: return "New notification";
    }
  };

  return (
    <div className="container-mobile py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => markAllReadMutation.mutate()}
          disabled={notifications.length === 0 || markAllReadMutation.isPending}
          className="text-xs text-muted-foreground"
        >
          Mark all read
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center opacity-60">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium">No notifications yet</p>
          <p className="text-sm text-muted-foreground">We'll let you know when something happens.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={`border-0 shadow-sm ${!n.read ? 'bg-primary/5' : 'bg-card'}`}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <Avatar className="w-10 h-10 border border-border/50">
                      <AvatarImage src={n.sender?.avatar_url} />
                      <AvatarFallback>{n.sender?.display_name?.[0] || 'S'}</AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-background ${
                        n.type === 'friend_request' ? 'bg-blue-500' : 
                        n.type === 'event_invite' ? 'bg-purple-500' : 'bg-primary'
                      }`}>
                      {getIcon(n.type)}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">
                      <span className="font-semibold">{n.sender?.display_name || 'System'}</span>{' '}
                      <span className="text-muted-foreground">{getMessage(n)}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>

                    {/* Action Buttons for Friend Requests */}
                    {n.type === 'friend_request' && (
                      <div className="flex gap-2 mt-2">
                        <Button 
                          size="sm" 
                          className="h-7 text-xs gradient-primary text-white"
                          onClick={() => acceptFriendMutation.mutate({ notificationId: n.id, senderId: n.sender_id! })}
                          disabled={acceptFriendMutation.isPending}
                        >
                          {acceptFriendMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-xs"
                          onClick={() => declineFriendMutation.mutate({ notificationId: n.id, senderId: n.sender_id! })}
                          disabled={declineFriendMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {!n.read && (
                    <div className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
    }
        
