import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from '@/integrations/supabase/client';
import { Avatar, Button, Input, Card, CardContent } from "@/components/ui";
import { MessageSquare, UserPlus, Users } from "lucide-react";
import { FixedSizeList as VirtualList } from "react-window";

type Profile = {
  id: string;
  full_name?: string;
  avatar_url?: string | null;
  updated_at?: string;
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "accepted" | "pending" | "rejected";
  created_at: string;
};

async function sendFriendRequestRPC(targetId: string, myId: string) {
  try {
    const { data, error } = await supabase.rpc("send_friend_request", {
      requester: myId,
      addressee: targetId,
    });
    if (error) throw error;
    return data;
  } catch (err) {
    const { data, error } = await supabase
      .from<Friendship>("friendships")
      .insert({ requester_id: myId, addressee_id: targetId, status: "pending" })
      .select();
    if (error) throw error;
    return data;
  }
}

export default function Friends() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"all" | "requests" | "nearby" | "suggestions">("all");
  const [search, setSearch] = useState("");
  const [openChatWith, setOpenChatWith] = useState<Profile | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const userId = user?.id;

  const acceptedFriendsQuery = useInfiniteQuery(
    ["friends", "accepted", userId, search],
    async ({ pageParam = 0 }) => {
      const limit = 20;
      const offset = pageParam * limit;
      let baseQuery = supabase
        .from("friendships")
        .select(`*, requester:profiles!requester_id(*), addressee:profiles!addressee_id(*)`)
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(limit)
        .offset(offset);

      const { data, error } = await baseQuery;
      if (error) throw error;
      const profiles: Profile[] = (data || []).map((row: any) => {
        const friendProfile = row.requester_id === userId ? row.addressee : row.requester;
        return {
          id: friendProfile.id,
          full_name: friendProfile.full_name,
          avatar_url: friendProfile.avatar_url,
          updated_at: friendProfile.updated_at,
        };
      });
      return { profiles, nextPage: profiles.length === limit ? pageParam + 1 : null };
    },
    { getNextPageParam: (lastPage) => lastPage.nextPage, enabled: !!userId }
  );

  const pendingQuery = useQuery(["friends", "pending", userId], async () => {
    const { data, error } = await supabase
      .from("friendships")
      .select(`*, requester:profiles!requester_id(*), addressee:profiles!addressee_id(*)`)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }, { enabled: !!userId });

  const nearbyQuery = useQuery(["profiles", "nearby", userId], async () => {
    const { data, error } = await supabase
      .from<Profile>("profiles")
      .select("id, full_name, avatar_url, updated_at")
      .neq("id", userId)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  }, { enabled: !!userId });

  async function fetchMutualFriends(otherId: string) {
    const { data, error } = await supabase.rpc("get_mutual_friends", { a: userId, b: otherId });
    if (error) return [];
    return data || [];
  }

  const recommendationsQuery = useQuery(["ai-recs", userId], async () => {
    const edgeUrl = process.env.NEXT_PUBLIC_RECOMMEND_EDGE || "/api/recommend-friends";
    const res = await fetch(edgeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, limit: 12 }),
    });
    if (!res.ok) throw new Error("Failed to fetch recommendations");
    const payload = await res.json();
    return payload.recommendations as Profile[];
  }, { enabled: !!userId });

  const sendRequestMutation = useMutation((targetId: string) => sendFriendRequestRPC(targetId, userId));

  useEffect(() => {
    if (!userId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase.channel("friendship-updates");

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `requester_id=eq.${userId}` }, () => {
        acceptedFriendsQuery.refetch();
        recommendationsQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${userId}` }, () => {
        acceptedFriendsQuery.refetch();
        recommendationsQuery.refetch();
      })
      .subscribe();

    channelRef.current = channel;
    return () => supabase.removeChannel(channelRef.current);
  }, [userId]);

  const acceptedProfiles = useMemo(() => {
    const pages = acceptedFriendsQuery.data?.pages || [];
    return pages.flatMap((p: any) => p.profiles) as Profile[];
  }, [acceptedFriendsQuery.data]);

  function FriendRow({ index, style }: { index: number; style: any }) {
    const profile = acceptedProfiles[index];
    if (!profile) return <div style={style} />;
    return (
      <div style={style} className="p-2 flex items-center gap-3">
        <Avatar src={profile.avatar_url} alt={profile.full_name || ""} />
        <div className="flex-1">
          <div className="font-medium">{profile.full_name || "Unknown"}</div>
          <div className="text-xs text-muted-foreground">{profile.updated_at}</div>
        </div>
        <Button variant="ghost" onClick={() => setOpenChatWith(profile)} title="Message">
          <MessageSquare size={16} />
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-4 mb-4">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search friends..." />
        <Button onClick={() => setSearch("")}>Clear</Button>
      </div>

      <div className="flex gap-3 mb-4">
        <Button variant={activeTab === "all" ? "default" : "ghost"} onClick={() => setActiveTab("all")}>All</Button>
        <Button variant={activeTab === "requests" ? "default" : "ghost"} onClick={() => setActiveTab("requests")}>Requests</Button>
        <Button variant={activeTab === "nearby" ? "default" : "ghost"} onClick={() => setActiveTab("nearby")}>Nearby</Button>
        <Button variant={activeTab === "suggestions" ? "default" : "ghost"} onClick={() => setActiveTab("suggestions")}>Suggestions</Button>
      </div>

      <Card>
        <CardContent>
          {activeTab === "all" && (
            <div>
              {acceptedFriendsQuery.isLoading ? (
                <div>Loading friends...</div>
              ) : acceptedProfiles.length === 0 ? (
                <div>No friends yet — try Suggestions.</div>
              ) : (
                <VirtualList height={400} width="100%" itemSize={64} itemCount={acceptedProfiles.length}>
                  {({ index, style }) => <FriendRow index={index} style={style} />}
                </VirtualList>
              )}
              {acceptedFriendsQuery.hasNextPage && (
                <div className="mt-2 text-center">
                  <Button onClick={() => acceptedFriendsQuery.fetchNextPage()}>Load more</Button>
                </div>
              )}
            </div>
          )}

          {activeTab === "requests" && (
            <div>
              {pendingQuery.isLoading ? (
                <div>Loading requests...</div>
              ) : pendingQuery.data?.length === 0 ? (
                <div>No pending requests</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {pendingQuery.data?.map((r: any) => (
                    <div key={r.id} className="p-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar src={r.requester.avatar_url} alt={r.requester.full_name} />
                        <div>
                          <div className="font-medium">{r.requester.full_name}</div>
                          <div className="text-xs text-muted-foreground">Requested</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => sendRequestMutation.mutate(r.id)}>Accept</Button>
                        <Button variant="ghost" onClick={() => sendRequestMutation.mutate(r.id)}>Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "nearby" && (
            <div>
              <div className="mb-2 font-semibold">Nearby</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {nearbyQuery.data?.map((p) => (
                  <div key={p.id} className="p-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar src={p.avatar_url} alt={p.full_name} />
                      <div>
                        <div className="font-medium">{p.full_name}</div>
                        <div className="text-xs text-muted-foreground">Nearby user</div>
                      </div>
                    </div>
                    <Button onClick={() => sendRequestMutation.mutate(p.id)} title="Send Request"><UserPlus size={16} /></Button>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <div className="mb-2 font-semibold">Mutual Connections</div>
                <div className="text-sm text-muted-foreground">Click a profile to view mutual friends</div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {nearbyQuery.data?.map((p) => (
                    <button
                      key={p.id}
                      className="p-2 border rounded flex items-center justify-between"
                      onClick={async () => {
                        const mutuals = await fetchMutualFriends(p.id);
                        console.log("Mutuals for", p.id, mutuals);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar src={p.avatar_url} alt={p.full_name} />
                        <div>
                          <div className="font-medium">{p.full_name}</div>
                          <div className="text-xs text-muted-foreground">View mutual friends</div>
                        </div>
                      </div>
                      <Users size={18} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "suggestions" && (
            <div>
              <div className="mb-2 font-semibold">AI-driven Suggestions</div>
              {recommendationsQuery.isLoading ? (
                <div>Loading suggestions...</div>
              ) : recommendationsQuery.data?.length === 0 ? (
                <div>No suggestions available right now.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {recommendationsQuery.data?.map((p) => (
                    <div key={p.id} className="p-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar src={p.avatar_url} alt={p.full_name} />
                        <div>
                          <div className="font-medium">{p.full_name}</div>
                          <div className="text-xs text-muted-foreground">Recommended for you</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => sendRequestMutation.mutate(p.id)} title="Send Request"><UserPlus size={16} /></Button>
                        <Button variant="ghost" onClick={() => setOpenChatWith(p)} title="Message"><MessageSquare size={16} /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {openChatWith && (
        <div className="fixed bottom-4 right-4 w-96 bg-white shadow-lg rounded">
          <div className="p-2 border-b flex items-center justify-between">
            <div className="font-medium">Chat with {openChatWith.full_name}</div>
            <Button variant="ghost" onClick={() => setOpenChatWith(null)}>Close</Button>
          </div>
          <div className="p-2 h-64 overflow-auto"></div>
          <div className="p-2 border-t flex gap-2">
            <Input placeholder="Type a message..." />
            <Button>Send</Button>
          </div>
        </div>
      )}
    </div>
  );
}
