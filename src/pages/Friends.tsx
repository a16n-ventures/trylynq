import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, MessageSquare, UserPlus, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext"; // Import useAuth
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"; // Use Tabs
import { Badge } from "@/components/ui/badge"; // Import Badge

// --- TYPES ---
// (Define types for better code quality)
type Profile = {
  user_id: string; // Changed from id to match db
  display_name?: string | null;
  avatar_url?: string | null;
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  // These are the joined profiles
  requester: Profile;
  addressee: Profile;
};

export default function Friends() {
  const { user } = useAuth(); // Use auth context
  const userId = user?.id;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // --- QUERIES ---

  // 1. Fetch ACCEPTED friends
  const { data: friends = [], isPending: loadingFriends } = useQuery<Friendship[]>({
    queryKey: ['friends', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id, 
          requester_id, 
          addressee_id, 
          status, 
          requester:profiles!requester_id (user_id, display_name, avatar_url), 
          addressee:profiles!addressee_id (user_id, display_name, avatar_url)
        `)
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq('status', 'accepted');
      if (error) {
        toast.error('Failed to load friends');
        throw error;
      }
      return data || [];
    },
    enabled: !!userId,
  });

  // 2. Fetch PENDING friend requests
  const { data: requests = [], isPending: loadingRequests } = useQuery<Friendship[]>({
    queryKey: ['friendRequests', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id, 
          requester_id, 
          addressee_id, 
          status, 
          requester:profiles!requester_id (user_id, display_name, avatar_url), 
          addressee:profiles!addressee_id (user_id, display_name, avatar_url)
        `)
        .eq('addressee_id', userId) // Only requests sent *to me*
        .eq('status', 'pending');
      if (error) {
        toast.error('Failed to load friend requests');
        throw error;
      }
      return data || [];
    },
    enabled: !!userId,
  });

  // 3. Get all user IDs who are already friends or have a pending request
  const existingFriendIds = useMemo(() => {
    const friendIds = friends.map(f => f.requester_id === userId ? f.addressee_id : f.requester_id);
    const requestIds = requests.map(r => r.requester_id);
    return new Set([...friendIds, ...requestIds, userId]); // Include self
  }, [friends, requests, userId]);

  // 4. Fetch SUGGESTIONS (profiles that are NOT friends or pending)
  //    This query now intelligently excludes existing connections
  const { data: suggestions = [], isPending: loadingSuggestions } = useQuery<Profile[]>({
    queryKey: ['suggestions', userId, existingFriendIds],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .not('user_id', 'in', `(${Array.from(existingFriendIds).map(id => `'${id}'`).join(',')})`)
        .limit(20);
        
      if (error) {
        toast.error('Failed to load suggestions');
        throw error;
      }
      return data || [];
    },
    enabled: !!userId && existingFriendIds.size > 0, // Run after existing IDs are calculated
  });


  // --- MUTATIONS ---

  // 1. Send Friend Request
  const sendFriendRequest = useMutation({
    mutationFn: async (targetId: string) => {
      if (!userId) throw new Error('No user logged in');
      const { data, error } = await supabase
        .from('friendships')
        .insert({ requester_id: userId, addressee_id: targetId, status: 'pending' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Friend request sent!');
      // Refetch suggestions to remove the user we just added
      queryClient.invalidateQueries({ queryKey: ['suggestions', userId] });
    },
    onError: () => {
      toast.error('Failed to send request');
    }
  });

  // 2. Accept Friend Request
  const acceptFriendRequest = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { data, error } = await supabase
        .from('friendships')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', friendshipId)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Friend request accepted!');
      // Refetch both requests and friends list
      queryClient.invalidateQueries({ queryKey: ['friendRequests', userId] });
      queryClient.invalidateQueries({ queryKey: ['friends', userId] });
    },
    onError: () => {
      toast.error('Failed to accept request');
    }
  });

  // 3. Reject Friend Request
  const rejectFriendRequest = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { data, error } = await supabase
        .from('friendships')
        .delete() // Or update status to 'declined' if you want to keep a record
        .eq('id', friendshipId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.info('Friend request rejected');
      // Refetch requests list
      queryClient.invalidateQueries({ queryKey: ['friendRequests', userId] });
    },
    onError: () => {
      toast.error('Failed to reject request');
    }
  });

  // Helper for rendering
  const renderProfile = (profile: Profile) => (
    <>
      <Avatar className="w-12 h-12">
        <AvatarImage src={profile.avatar_url || undefined} />
        <AvatarFallback>
          {profile.display_name?.split(' ').map(n => n[0]).join('') || 'U'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="font-semibold">{profile.display_name}</div>
      </div>
    </>
  );

  return (
    <div className="container-mobile py-4 space-y-4">
      <h1 className="text-2xl font-bold">Friends</h1>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          placeholder="Search friends..." 
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Friends</TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            {requests.length > 0 && (
              <Badge className="ml-2 gradient-primary text-white text-xs px-2 h-5">
                {requests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-4">
          <Card className="gradient-card shadow-card border-0">
            <CardContent className="p-0">
              {loadingFriends ? (
                <div className="p-4 text-center text-muted-foreground">Loading friends...</div>
              ) : friends.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">No friends yet.</div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {friends.map((f) => {
                    // Determine which profile is the friend's
                    const friendProfile = f.requester_id === userId ? f.addressee : f.requester;
                    return (
                      <li key={f.id} className="flex items-center gap-3 p-4">
                        {renderProfile(friendProfile)}
                        <Button variant="outline" size="sm">
                          <MessageSquare size={16} className="mr-2" />
                          Chat
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-3 mt-4">
          <Card className="gradient-card shadow-card border-0">
            <CardContent className="p-0">
              {loadingRequests ? (
                <div className="p-4 text-center text-muted-foreground">Loading requests...</div>
              ) : requests.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">No new friend requests.</div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {requests.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 p-4">
                      {renderProfile(r.requester)} {/* The requester sent the request */}
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="w-9 h-9"
                        onClick={() => rejectFriendRequest.mutate(r.id)}
                      >
                        <X size={16} />
                      </Button>
                      <Button 
                        size="icon" 
                        className="w-9 h-9 gradient-primary text-white"
                        onClick={() => acceptFriendRequest.mutate(r.id)}
                      >
                        <Check size={16} />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-3 mt-4">
          <Card className="gradient-card shadow-card border-0">
            <CardContent className="p-0">
              {loadingSuggestions ? (
                <div className="p-4 text-center text-muted-foreground">Loading suggestions...</div>
              ) : suggestions.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">No suggestions available.</div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {suggestions.map((p) => (
                    <li key={p.user_id} className="flex items-center gap-3 p-4">
                      {renderProfile(p)}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendFriendRequest.mutate(p.user_id)}
                        disabled={sendFriendRequest.isLoading}
                      >
                        <UserPlus size={16} className="mr-2" />
                        Add
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
