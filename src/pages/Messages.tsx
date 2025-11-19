import React, { useMemo, useRef, useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Send, Phone, Video, MoreVertical, ArrowLeft, Plus, 
  Image as ImageIcon, Smile, Users, Settings, Info 
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

// --- TYPES ---
type Profile = { user_id: string; display_name: string | null; avatar_url: string | null; };
type ChatMode = 'dm' | 'community';

type DMConversation = {
  type: 'dm';
  partner_id: string;
  display_name: string;
  avatar_url?: string;
  last_message_content: string;
  last_message_at: string;
};

type Community = {
  type: 'community';
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  creator_id: string;
  member_count: number;
};

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_me: boolean;
  sender_name?: string;
  sender_avatar?: string;
};

export default function Messages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState<ChatMode>('dm');
  const [selectedChat, setSelectedChat] = useState<DMConversation | Community | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');

  // Modal States
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [isCommunitySettingsOpen, setIsCommunitySettingsOpen] = useState(false);

  // Community Form State
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDesc, setNewCommunityDesc] = useState('');

  // --- QUERIES ---

  // 1. Fetch DMs
  const { data: dmConversations = [], isLoading: loadingDMs } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)`)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const map = new Map<string, DMConversation>();
      messages?.forEach((msg: any) => {
        const isMe = msg.sender_id === user.id;
        const partnerId = isMe ? msg.receiver_id : msg.sender_id;
        const partner = isMe ? msg.receiver : msg.sender;
        if (!map.has(partnerId)) {
          map.set(partnerId, {
            type: 'dm',
            partner_id: partnerId,
            display_name: partner?.display_name || 'Unknown',
            avatar_url: partner?.avatar_url,
            last_message_content: msg.content,
            last_message_at: msg.created_at,
          });
        }
      });
      return Array.from(map.values());
    },
    enabled: !!user,
  });

  // 2. Fetch Communities
  const { data: communities = [], isLoading: loadingCommunities } = useQuery({
    queryKey: ['my_communities', user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Assuming a 'community_members' table linking users to communities
      // If not exists, we might query communities directly if public, or assume user joined
      // For now, fetching all communities for demo or creating 'community_members' check
      const { data, error } = await supabase
        .from('communities')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data.map((c: any) => ({ ...c, type: 'community' })) as Community[];
    },
    enabled: !!user,
  });

  // 3. Fetch Messages (Dynamic based on selected chat type)
  const { data: chatMessages = [] } = useQuery({
    queryKey: ['chat_messages', selectedChat?.type, selectedChat?.id || (selectedChat as DMConversation)?.partner_id],
    queryFn: async () => {
      if (!user || !selectedChat) return [];

      if (selectedChat.type === 'dm') {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedChat.partner_id}),and(sender_id.eq.${selectedChat.partner_id},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true });
        return data?.map(m => ({ ...m, is_me: m.sender_id === user.id })) || [];
      } else {
        // Community Messages
        // Assuming 'community_messages' table or 'messages' with 'community_id'
        // We'll assume a table `community_messages` exists for this feature
        const { data } = await supabase
          .from('community_messages') 
          .select(`*, sender:profiles!sender_id(display_name, avatar_url)`)
          .eq('community_id', selectedChat.id)
          .order('created_at', { ascending: true });
        
        return data?.map((m: any) => ({ 
          id: m.id,
          sender_id: m.sender_id,
          content: m.content,
          created_at: m.created_at,
          is_me: m.sender_id === user.id,
          sender_name: m.sender.display_name,
          sender_avatar: m.sender.avatar_url
        })) || [];
      }
    },
    enabled: !!selectedChat,
    refetchInterval: 3000, // Simple polling for realtime updates
  });

  // --- MUTATIONS ---

  const createCommunity = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('communities')
        .insert({
          name: newCommunityName,
          description: newCommunityDesc,
          creator_id: user.id,
          member_count: 1
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setIsCreateCommunityOpen(false);
      setNewCommunityName('');
      setNewCommunityDesc('');
      queryClient.invalidateQueries({ queryKey: ['my_communities'] });
      toast.success("Community created!");
    },
    onError: () => toast.error("Failed to create community")
  });

  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      if (!user || !selectedChat) return;
      
      if (selectedChat.type === 'dm') {
        await supabase.from('messages').insert({
          sender_id: user.id,
          receiver_id: selectedChat.partner_id,
          content: text
        });
      } else {
        await supabase.from('community_messages').insert({
          sender_id: user.id,
          community_id: selectedChat.id,
          content: text
        });
      }
    },
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['chat_messages'] });
    }
  });

  const updateCommunity = useMutation({
    mutationFn: async (updates: Partial<Community>) => {
      if (selectedChat?.type !== 'community') return;
      await supabase.from('communities').update(updates).eq('id', selectedChat.id);
    },
    onSuccess: () => {
      setIsCommunitySettingsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['my_communities'] });
      toast.success("Community updated");
    }
  });

  // --- HANDLERS ---
  const handleSend = () => {
    if (messageInput.trim()) sendMessage.mutate(messageInput.trim());
  };

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [chatMessages]);

  // --- RENDER CHAT WINDOW ---
  if (selectedChat) {
    const isCommunity = selectedChat.type === 'community';
    const chatTitle = isCommunity ? selectedChat.name : selectedChat.display_name;
    const chatAvatar = selectedChat.avatar_url;

    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Chat Header */}
        <div className="border-b p-3 flex items-center gap-3 bg-background/95 backdrop-blur">
          <Button variant="ghost" size="icon" onClick={() => setSelectedChat(null)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          
          <Avatar className="h-10 w-10">
            <AvatarImage src={chatAvatar || undefined} />
            <AvatarFallback>{chatTitle[0]}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 overflow-hidden cursor-pointer" onClick={() => isCommunity && setIsCommunitySettingsOpen(true)}>
            <h3 className="font-semibold truncate">{chatTitle}</h3>
            <p className="text-xs text-muted-foreground">
              {isCommunity ? `${(selectedChat as Community).member_count} members` : 'Active now'}
            </p>
          </div>

          {isCommunity && (selectedChat as Community).creator_id === user?.id && (
            <Button variant="ghost" size="icon" onClick={() => setIsCommunitySettingsOpen(true)}>
              <Settings className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/5" ref={scrollRef}>
          {chatMessages.map((msg: Message) => (
            <div key={msg.id} className={`flex w-full ${msg.is_me ? 'justify-end' : 'justify-start'}`}>
              {!msg.is_me && isCommunity && (
                <Avatar className="w-6 h-6 mr-2 mt-1">
                  <AvatarImage src={msg.sender_avatar || undefined} />
                  <AvatarFallback>{msg.sender_name?.[0]}</AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[75%] ${msg.is_me ? 'items-end' : 'items-start'} flex flex-col`}>
                {!msg.is_me && isCommunity && <span className="text-[10px] text-muted-foreground ml-1">{msg.sender_name}</span>}
                <div className={`px-4 py-2 rounded-2xl text-sm ${msg.is_me ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-secondary text-secondary-foreground rounded-bl-none'}`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-3 border-t flex items-end gap-2 bg-background">
          <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0">
            <ImageIcon className="h-5 w-5" />
          </Button>
          <Textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder={`Message ${isCommunity ? '#' + chatTitle : chatTitle}...`}
            className="min-h-[44px] max-h-32 py-3 resize-none rounded-2xl bg-muted focus-visible:ring-0 border-0"
          />
          {messageInput.trim() ? (
            <Button onClick={handleSend} size="icon" className="rounded-full h-11 w-11 shrink-0">
              <Send className="h-5 w-5" />
            </Button>
          ) : (
             <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0">
               <MoreVertical className="h-5 w-5" />
             </Button>
          )}
        </div>

        {/* Community Settings Modal */}
        {isCommunity && (
          <Dialog open={isCommunitySettingsOpen} onOpenChange={setIsCommunitySettingsOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Community Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-center mb-4">
                   <Avatar className="w-20 h-20">
                     <AvatarImage src={chatAvatar || undefined} />
                     <AvatarFallback>{chatTitle[0]}</AvatarFallback>
                   </Avatar>
                </div>
                {(selectedChat as Community).creator_id === user?.id ? (
                  <>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input defaultValue={(selectedChat as Community).name} onChange={(e) => setNewCommunityName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input defaultValue={(selectedChat as Community).description || ''} onChange={(e) => setNewCommunityDesc(e.target.value)} />
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <h2 className="text-xl font-bold">{chatTitle}</h2>
                    <p className="text-muted-foreground mt-2">{(selectedChat as Community).description}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                {(selectedChat as Community).creator_id === user?.id && (
                   <Button onClick={() => updateCommunity.mutate({ name: newCommunityName || selectedChat.name, description: newCommunityDesc || (selectedChat as Community).description })}>Save Changes</Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  // 3. LIST VIEW
  return (
    <div className="container-mobile py-4 min-h-screen flex flex-col pb-20">
      <div className="flex items-center justify-between mb-4 px-1">
        <h1 className="text-2xl font-bold">Messages</h1>
        <div className="flex gap-2">
           {activeTab === 'community' && (
             <Button size="icon" variant="ghost" onClick={() => setIsCreateCommunityOpen(true)}>
               <Plus className="h-6 w-6" />
             </Button>
           )}
           {activeTab === 'dm' && (
             <Button size="icon" variant="ghost" onClick={() => setIsNewChatOpen(true)}>
               <Plus className="h-6 w-6" />
             </Button>
           )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChatMode)} className="w-full flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="dm">Direct</TabsTrigger>
          <TabsTrigger value="community">Communities</TabsTrigger>
        </TabsList>

        {/* SEARCH */}
        <div className="relative mb-4">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
           <Input 
             placeholder={activeTab === 'dm' ? "Search messages..." : "Search communities..."} 
             className="pl-10 bg-muted/50 border-none rounded-xl"
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
        </div>

        <TabsContent value="dm" className="flex-1">
           <div className="space-y-2">
             {dmConversations.filter(c => c.display_name.toLowerCase().includes(searchQuery.toLowerCase())).map(chat => (
               <div key={chat.partner_id} onClick={() => setSelectedChat(chat)} className="flex items-center gap-3 p-3 hover:bg-accent/50 rounded-xl cursor-pointer">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={chat.avatar_url} />
                    <AvatarFallback>{chat.display_name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                       <h3 className="font-semibold truncate">{chat.display_name}</h3>
                       <span className="text-xs text-muted-foreground">{new Date(chat.last_message_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{chat.last_message_content}</p>
                  </div>
               </div>
             ))}
           </div>
        </TabsContent>

        <TabsContent value="community" className="flex-1">
            {communities.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>You haven't joined any communities.</p>
                <Button variant="link" onClick={() => setIsCreateCommunityOpen(true)}>Create one</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {communities.filter((c: Community) => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map((comm: Community) => (
                  <div key={comm.id} onClick={() => setSelectedChat(comm)} className="flex items-center gap-3 p-3 hover:bg-accent/50 rounded-xl cursor-pointer">
                      <Avatar className="w-12 h-12 rounded-xl">
                        <AvatarImage src={comm.avatar_url || undefined} />
                        <AvatarFallback className="rounded-xl">{comm.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{comm.name}</h3>
                        <p className="text-xs text-muted-foreground">{comm.member_count} members</p>
                      </div>
                  </div>
                ))}
              </div>
            )}
        </TabsContent>
      </Tabs>

      {/* Create Community Dialog */}
      <Dialog open={isCreateCommunityOpen} onOpenChange={setIsCreateCommunityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a Community</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Community Name</Label>
              <Input placeholder="e.g. Tech Enthusiasts" value={newCommunityName} onChange={(e) => setNewCommunityName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="What's this group about?" value={newCommunityDesc} onChange={(e) => setNewCommunityDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
             <Button onClick={() => createCommunity.mutate()} disabled={!newCommunityName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
  
