import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, Button, Input, Card, CardContent } from "@/components/ui";
import { Search, MessageSquare, UserPlus } from "lucide-react";

type Profile = {
  id: string;
  full_name?: string;
  avatar_url?: string | null;
  updated_at?: string;
};

export default function Friends() {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "requests" | "suggestions">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // ✅ Safe guard: don’t query until userId is ready
  const friendsQuery = useQuery(
    ["friends", userId],
    async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("friendships")
        .select(`id, requester_id, addressee_id, status, requester:profiles!requester_id(*), addressee:profiles!addressee_id(*)`)
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq("status", "accepted");
      if (error) throw error;
      return data || [];
    },
    { enabled: !!userId }
  );

  const sendFriendRequest = useMutation(
    async (targetId: string) => {
      if (!userId) throw new Error("No user logged in");
      const { data, error } = await supabase
        .from("friendships")
        .insert({ requester_id: userId, addressee_id: targetId, status: "pending" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    {
      onSuccess: () => friendsQuery.refetch(),
    }
  );

  const profilesQuery = useQuery(
    ["profiles", userId],
    async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, updated_at")
        .neq("id", userId)
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    { enabled: !!userId }
  );

  const profiles = useMemo(() => profilesQuery.data || [], [profilesQuery.data]);

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-4 mb-4">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search friends..." />
        <Button onClick={() => setActiveTab("all")}>All</Button>
        <Button onClick={() => setActiveTab("requests")}>Requests</Button>
        <Button onClick={() => setActiveTab("suggestions")}>Suggestions</Button>
      </div>

      <Card>
        <CardContent>
          {activeTab === "all" && (
            <div>
              {friendsQuery.isLoading ? (
                <div>Loading friends...</div>
              ) : (
                <ul>
                  {friendsQuery.data?.map((f: any) => {
                    const friend =
                      f.requester_id === userId ? f.addressee : f.requester;
                    return (
                      <li key={f.id} className="flex items-center gap-3 p-2 border-b">
                        <Avatar src={friend.avatar_url || undefined} alt={friend.full_name} />
                        <div className="flex-1">
                          <div className="font-medium">{friend.full_name}</div>
                        </div>
                        <Button variant="ghost" title="Message">
                          <MessageSquare size={16} />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {activeTab === "suggestions" && (
            <div>
              {profiles.length === 0 ? (
                <div>No suggestions available.</div>
              ) : (
                <ul>
                  {profiles.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 p-2 border-b">
                      <Avatar src={p.avatar_url || undefined} alt={p.full_name} />
                      <div className="flex-1">
                        <div className="font-medium">{p.full_name}</div>
                      </div>
                      <Button
                        variant="ghost"
                        title="Add friend"
                        onClick={() => sendFriendRequest.mutate(p.id)}
                      >
                        <UserPlus size={16} />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
