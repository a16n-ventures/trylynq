import React, { useMemo, useRef, useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Send, Phone, Video, MoreVertical, ArrowLeft, Plus } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// --- TYPES ---
// This is the expected shape of the data from the 'get_conversations' RPC
type Conversation = {
  partner_id: string;
  display_name: string;
  avatar_url?: string;
  last_message_content: string;
  last_message_at: string;
  unread_count: number;
  // We'll add presence later
  // online: boolean;
};

// This maps to your 'messages' table, with the 'sender' profile joined
type ChatMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_me?: boolean; // We'll add this client-side
  sender: {
    display_name: string;
    avatar_url?: string;
  };
};

// --- COMPONENT ---
const Messages: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [selectedPartner, setSelectedPartner] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // --- DATA FETCHING ---

  // 1. Fetch the list of conversations
  // This query relies on a Supabase RPC function (see note below)
  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc('get_conversations');
      
      if (error) {
        console.error('Error fetching conversations:', error);
        toast.error('Failed to load conversations');
        return [];
      }
      return data || [];
    },
    enabled: !!user,
  });

  // 2. Fetch messages for the *selected* chat
  const { data: chatMessages = [], isLoading: loadingMessages } = useQuery<ChatMessage[]>({
    queryKey: ['messages', selectedPartner?.partner_id],
    queryFn: async () => {
      if (!selectedPartner || !user) return [];
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          receiver_id,
          content,
          created_at,
          sender:profiles!sender_id (display_name, avatar_url)
        `)
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${selectedPartner.partner_id}),` +
          `and(sender_id.eq.${selectedPartner.partner_id},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        toast.error('Failed to load messages');
        return [];
      }
      
      // Add 'is_me' flag for UI
      return data.map(msg => ({ ...msg, is_me: msg.sender_id === user.id }));
    },
    enabled: !!selectedPartner && !!user,
  });

  // 3. Mutation for sending a message
  const sendMessageMutation = useMutation({
    mutationFn: async (newMessageContent: string) => {
      if (!user || !selectedPartner) throw new Error('User or partner not defined');

      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedPartner.partner_id,
          content: newMessageContent,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      // Don't need to manually refetch, real-time subscription will handle it
    },
    onError: (error: Error) => {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    },
  });

  // --- REAL-TIME SUBSCRIPTIONS ---

  useEffect(() => {
    if (!user) return;

    // 1. Listen for *any* new message to update the conversation list
    const conversationChannel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          // Only listen for messages *sent to me*
          filter: `receiver_id=eq.${user.id}` 
        },
        (payload) => {
          console.log('New message received, refetching conversations:', payload);
          // Refetch the conversation list to update last message/unread count
          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        }
      )
      .subscribe();

    // 2. Listen for messages *in the active chat*
    let chatChannel: any = null;
    if (selectedPartner) {
      chatChannel = supabase
        .channel(`chat:${[user.id, selectedPartner.partner_id].sort().join(':')}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            // Filter for messages *from my partner*
            filter: `sender_id=eq.${selectedPartner.partner_id}`
          },
          (payload) => {
            // New message from partner, refetch the messages query
            console.log('New message in active chat:', payload);
            queryClient.invalidateQueries({ queryKey: ['messages', selectedPartner.partner_id] });
          }
        )
        .subscribe();
    }

    // Cleanup subscriptions on unmount or when selection changes
    return () => {
      supabase.removeChannel(conversationChannel);
      if (chatChannel) {
        supabase.removeChannel(chatChannel);
      }
    };
  }, [user, selectedPartner, queryClient]);


  // --- UI LOGIC ---

  // Scroll to bottom when new messages are loaded
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages.length, selectedPartner]);

  const handleSendMessage = () => {
    const content = message.trim();
    if (!content) return;
    
    // Optimistically add message to UI
    const optimisticMessage: ChatMessage = {
      id: Math.random().toString(), // temp ID
      sender_id: user!.id,
      receiver_id: selectedPartner!.partner_id,
      content: content,
      created_at: new Date().toISOString(),
      is_me: true,
      sender: { display_name: 'Me', avatar_url: '' }, // Sender profile is not critical for optimistic update
    };

    queryClient.setQueryData(
      ['messages', selectedPartner?.partner_id],
      (oldData: ChatMessage[] | undefined) => [...(oldData || []), optimisticMessage]
    );

    // Send to Supabase
    sendMessageMutation.mutate(content);
    setMessage('');
  };

  // Filter conversations for search
  const filteredConversations = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return conversations;
    return conversations.filter(convo =>
      convo.display_name.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  // --- RENDER ---

  if (selectedPartner) {
    // --- CHAT VIEW ---
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Chat Header */}
        <div className="gradient-primary text-white">
          <div className="container-mobile py-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20 p-2"
                onClick={() => setSelectedPartner(null)}
                aria-label="Back to conversations"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>

              <Avatar className="w-10 h-10">
                {selectedPartner.avatar_url ? (
                  <AvatarImage src={selectedPartner.avatar_url} />
                ) : (
                  <AvatarFallback className="bg-white/20 text-white">
                    {selectedPartner.display_name.split(' ').map(n => n[0]).join('').slice(0,2)}
                  </AvatarFallback>
                )}
              </Avatar>

              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-white truncate">{selectedPartner.display_name}</h2>
                <p className="text-sm text-white/70 truncate">
                  {/* TODO: Add real-time presence */}
                  Active now
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 p-2" aria-label="Call">
                  <Phone className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 p-2" aria-label="Video call">
                  <Video className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 p-2" aria-label="More">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 container-mobile py-4 space-y-4 overflow-y-auto">
          {loadingMessages ? (
            <div className="text-center text-muted-foreground p-8">Loading messages...</div>
          ) : (
            chatMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.is_me ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%]`}>
                  <div className={`rounded-2xl px-4 py-2 ${msg.is_me ? 'gradient-primary text-white' : 'bg-muted text-foreground'}`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 px-2">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Message Input */}
        <div className="border-t border-border bg-background">
          <div className="container-mobile py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Input
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="pr-12"
                  aria-label="Message input"
                />
              </div>
              <Button
                size="sm"
                className="gradient-primary text-white p-2"
                onClick={handleSendMessage}
                disabled={!message.trim() || sendMessageMutation.isLoading}
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- CONVERSATIONS LIST VIEW ---
  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-primary text-white">
        <div className="container-mobile py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="heading-lg text-white">Messages</h1>
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 p-2" aria-label="New conversation">
              <Plus className="w-5 h-5" />
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
            <Input
              placeholder="Search conversations..."
              className="pl-10 bg-white/20 border-white/30 text-white placeholder:text-white/70"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              aria-label="Search conversations"
            />
          </div>
        </div>
      </div>

      <div className="container-mobile py-6">
        <Card className="gradient-card shadow-card border-0">
          <CardContent className="p-0">
            {loadingConversations ? (
              <div className="text-center text-muted-foreground p-8">Loading conversations...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center text-muted-foreground p-8">No conversations yet.</div>
            ) : (
              filteredConversations.map((convo, index) => (
                <div
                  key={convo.partner_id}
                  className={`flex items-center gap-3 p-4 hover:bg-muted/50 transition-smooth cursor-pointer ${index !== filteredConversations.length - 1 ? 'border-b border-border/50' : ''}`}
                  onClick={() => setSelectedPartner(convo)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSelectedPartner(convo); }}
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      {convo.avatar_url ? <AvatarImage src={convo.avatar_url} /> : (
                        <AvatarFallback className="gradient-primary text-white">
                          {convo.display_name.split(' ').map(n => n[0]).join('').slice(0,2)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    {/* TODO: Add online presence dot */}
                    {/* <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" /> */}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold truncate">{convo.display_name}</h3>
                      <span className="text-xs text-muted-foreground">
                        {new Date(convo.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{convo.last_message_content}</p>
                  </div>

                  {convo.unread_count > 0 && (
                    <Badge className="gradient-primary text-white text-xs min-w-[1.5rem] h-6 flex items-center justify-center">
                      {convo.unread_count}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Messages;
