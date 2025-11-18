import React, { useMemo, useRef, useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Using Textarea for multi-line
import { 
  Search, 
  Send, 
  Phone, 
  Video, 
  MoreVertical, 
  ArrowLeft, 
  Plus, 
  Image as ImageIcon, 
  Smile 
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// --- TYPES ---

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Conversation = {
  partner_id: string;
  display_name: string;
  avatar_url?: string;
  last_message_content: string;
  last_message_at: string;
  unread_count: number;
};

type ChatMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_me?: boolean;
  status?: 'sending' | 'sent' | 'error'; // For optimistic UI
};

const Messages: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  
  const [selectedPartner, setSelectedPartner] = useState<Conversation | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');

  // --- DATA FETCHING ---

  // 1. Fetch Conversations (Direct Query Replacement for RPC)
  // Strategy: Fetch latest messages where user is sender OR receiver.
  // Then process client-side to deduplicate into "conversations".
  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Fetch distinct interactions. 
      // Note: In a massive app, you'd want a dedicated 'conversations' table.
      // For now, we query the 'messages' table directly.
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          receiver_id,
          content,
          created_at,
          sender:profiles!sender_id(user_id, display_name, avatar_url),
          receiver:profiles!receiver_id(user_id, display_name, avatar_url)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false }); // Latest first

      if (error) {
        console.error('Error fetching conversations:', error);
        toast.error('Failed to load chats');
        return [];
      }

      // Client-side processing to group by partner
      const conversationMap = new Map<string, Conversation>();

      messages?.forEach((msg: any) => {
        const isMe = msg.sender_id === user.id;
        const partnerId = isMe ? msg.receiver_id : msg.sender_id;
        const partnerProfile = isMe ? msg.receiver : msg.sender;

        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            partner_id: partnerId,
            display_name: partnerProfile?.display_name || 'Unknown User',
            avatar_url: partnerProfile?.avatar_url,
            last_message_content: msg.content,
            last_message_at: msg.created_at,
            unread_count: 0, // TODO: Implement real unread count via separate query if needed
          });
        }
      });

      return Array.from(conversationMap.values());
    },
    enabled: !!user,
  });

  // 2. Fetch Friends (For "New Chat" Modal)
  const { data: friends = [] } = useQuery<Profile[]>({
    queryKey: ['friends_list', user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Reuse the logic from Friends.tsx or simplified version
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          requester_id,
          addressee_id,
          requester:profiles!requester_id(user_id, display_name, avatar_url),
          addressee:profiles!addressee_id(user_id, display_name, avatar_url)
        `)
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (error) return [];
      
      return data.map((f: any) => 
        f.requester_id === user.id ? f.addressee : f.requester
      );
    },
    enabled: isNewChatOpen,
  });

  // 3. Fetch Messages for Active Chat
  const { data: chatMessages = [], isLoading: loadingMessages } = useQuery<ChatMessage[]>({
    queryKey: ['messages', selectedPartner?.partner_id],
    queryFn: async () => {
      if (!selectedPartner || !user) return [];
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${selectedPartner.partner_id}),` +
          `and(sender_id.eq.${selectedPartner.partner_id},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true });

      if (error) {
        toast.error('Failed to load messages');
        return [];
      }
      
      return data.map(msg => ({ 
        ...msg, 
        is_me: msg.sender_id === user.id,
        status: 'sent'
      }));
    },
    enabled: !!selectedPartner && !!user,
  });

  // --- MUTATIONS ---

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !selectedPartner) throw new Error('Missing user or partner');
      
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedPartner.partner_id,
          content: content,
        });

      if (error) throw error;
    },
    onMutate: async (newContent) => {
      // Optimistic Update
      await queryClient.cancelQueries({ queryKey: ['messages', selectedPartner?.partner_id] });
      
      const previousMessages = queryClient.getQueryData(['messages', selectedPartner?.partner_id]);
      
      const optimisticMsg: ChatMessage = {
        id: 'temp-' + Date.now(),
        sender_id: user!.id,
        receiver_id: selectedPartner!.partner_id,
        content: newContent,
        created_at: new Date().toISOString(),
        is_me: true,
        status: 'sending',
      };

      queryClient.setQueryData(
        ['messages', selectedPartner?.partner_id], 
        (old: ChatMessage[] | undefined) => [...(old || []), optimisticMsg]
      );

      return { previousMessages };
    },
    onError: (err, newContent, context: any) => {
      toast.error("Message failed to send");
      queryClient.setQueryData(
        ['messages', selectedPartner?.partner_id], 
        context.previousMessages
      );
    },
    onSettled: () => {
      // Refetch to get the real ID and server timestamp
      queryClient.invalidateQueries({ queryKey: ['messages', selectedPartner?.partner_id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
    }
  });

  // --- REAL-TIME SUBSCRIPTIONS ---

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global_messages')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages' 
        },
        (payload: any) => {
          const newMsg = payload.new;
          
          // If it's the current chat, update messages
          if (selectedPartner && 
             (newMsg.sender_id === selectedPartner.partner_id || newMsg.receiver_id === selectedPartner.partner_id)) {
             queryClient.invalidateQueries({ queryKey: ['messages', selectedPartner.partner_id] });
          }
          
          // Always update conversations list (to show new snippets/timestamps)
          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedPartner, queryClient]);

  // --- HANDLERS ---

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, selectedPartner]);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    sendMessageMutation.mutate(messageInput.trim());
    setMessageInput('');
  };

  const handleStartNewChat = (friend: Profile) => {
    const convo: Conversation = {
      partner_id: friend.user_id,
      display_name: friend.display_name || 'Unknown',
      avatar_url: friend.avatar_url || undefined,
      last_message_content: '',
      last_message_at: new Date().toISOString(),
      unread_count: 0
    };
    setSelectedPartner(convo);
    setIsNewChatOpen(false);
  };

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    return conversations.filter(c => 
      c.display_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  const filteredFriends = useMemo(() => {
    if (!newChatSearch) return friends;
    return friends.filter(f => 
      f.display_name?.toLowerCase().includes(newChatSearch.toLowerCase())
    );
  }, [friends, newChatSearch]);

  // --- RENDER ---

  // 1. CHAT VIEW
  if (selectedPartner) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Header */}
        <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border p-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedPartner(null)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          
          <Avatar className="h-9 w-9 border">
            <AvatarImage src={selectedPartner.avatar_url} />
            <AvatarFallback>{selectedPartner.display_name.slice(0,2)}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 overflow-hidden">
            <h3 className="font-semibold truncate">{selectedPartner.display_name}</h3>
            <p className="text-xs text-muted-foreground">Active now</p>
          </div>

          <div className="flex gap-1">
             <Button variant="ghost" size="icon"><Phone className="h-5 w-5" /></Button>
             <Button variant="ghost" size="icon"><Video className="h-5 w-5" /></Button>
          </div>
        </div>

        {/* Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-background">
          {chatMessages.map((msg, i) => {
            const isLast = i === chatMessages.length - 1;
            return (
              <div key={msg.id} className={`flex w-full ${msg.is_me ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`
                    max-w-[75%] px-4 py-2 rounded-2xl text-sm relative
                    ${msg.is_me 
                      ? 'bg-primary text-primary-foreground rounded-br-none' 
                      : 'bg-muted text-foreground rounded-bl-none'
                    }
                  `}
                >
                  {msg.content}
                  {/* Simple timestamp for the last message in a group could go here */}
                </div>
              </div>
            );
          })}
          {msg => msg.status === 'sending' && (
             <div className="text-xs text-right text-muted-foreground pr-2">Sending...</div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 border-t bg-background flex items-end gap-2">
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </Button>
          
          <div className="flex-1 relative">
            <Textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Message..."
              className="min-h-[44px] max-h-32 py-3 resize-none rounded-2xl border-muted bg-muted/50 focus-visible:ring-0"
              onKeyDown={(e) => {
                if(e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-1 bottom-1 text-muted-foreground"
            >
               <Smile className="h-5 w-5" />
            </Button>
          </div>
          
          {messageInput.trim() ? (
            <Button 
              onClick={handleSendMessage} 
              size="icon" 
              className="shrink-0 h-11 w-11 rounded-full"
              disabled={sendMessageMutation.isPending}
            >
              <Send className="h-5 w-5" />
            </Button>
          ) : (
             <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
               <MoreVertical className="h-5 w-5" />
             </Button>
          )}
        </div>
      </div>
    );
  }

  // 2. CONVERSATIONS LIST VIEW
  return (
    <div className="container-mobile py-4 min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h1 className="text-2xl font-bold">Messages</h1>
        <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="ghost">
              <Plus className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm h-[80vh] flex flex-col p-0 gap-0">
            <DialogHeader className="p-4 border-b">
              <DialogTitle>New Message</DialogTitle>
              <div className="pt-2">
                 <span className="text-sm font-semibold">To:</span>
                 <Input 
                   className="border-0 shadow-none focus-visible:ring-0 px-2 h-auto py-1" 
                   placeholder="Search friends..."
                   value={newChatSearch}
                   onChange={(e) => setNewChatSearch(e.target.value)}
                   autoFocus
                 />
              </div>
            </DialogHeader>
            <ScrollArea className="flex-1 p-2">
              {filteredFriends.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No friends found. Add friends first!
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredFriends.map(friend => (
                    <div 
                      key={friend.user_id} 
                      className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg cursor-pointer"
                      onClick={() => handleStartNewChat(friend)}
                    >
                      <Avatar>
                        <AvatarImage src={friend.avatar_url || ''} />
                        <AvatarFallback>{friend.display_name?.slice(0,2)}</AvatarFallback>
                      </Avatar>
                      <div className="font-medium">{friend.display_name}</div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search messages..."
          className="pl-10 bg-muted/50 border-none rounded-xl"
        />
      </div>

      {/* List */}
      <div className="flex-1 space-y-2">
        {loadingConversations ? (
          <div className="p-8 text-center text-muted-foreground">Loading chats...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-center opacity-60">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-muted-foreground" />
            </div>
            <p>No messages yet.</p>
            <Button variant="link" onClick={() => setIsNewChatOpen(true)}>Start a chat</Button>
          </div>
        ) : (
          filteredConversations.map(convo => (
            <div
              key={convo.partner_id}
              onClick={() => setSelectedPartner(convo)}
              className="flex items-center gap-3 p-3 hover:bg-accent/50 active:bg-accent rounded-xl transition-colors cursor-pointer"
            >
              <div className="relative">
                <Avatar className="w-14 h-14 border border-border/30">
                  <AvatarImage src={convo.avatar_url} className="object-cover" />
                  <AvatarFallback>{convo.display_name.slice(0,2)}</AvatarFallback>
                </Avatar>
                {/* Online Indicator (Mock for now) */}
                <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full"></span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                   <h3 className="font-semibold truncate text-sm">{convo.display_name}</h3>
                   <span className="text-xs text-muted-foreground shrink-0 ml-2">
                     {/* If today, show time. If older, show date */}
                     {new Date(convo.last_message_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                   </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className={`text-sm truncate pr-2 ${convo.unread_count > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                    {convo.last_message_content || 'Sent an attachment'}
                  </p>
                  {convo.unread_count > 0 && (
                    <Badge className="h-5 min-w-[1.25rem] px-1 bg-primary text-[10px] flex justify-center items-center rounded-full">
                      {convo.unread_count}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Messages;
                        
