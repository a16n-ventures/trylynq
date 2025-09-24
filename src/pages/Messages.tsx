import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Send, Phone, Video, MoreVertical, ArrowLeft, Plus } from 'lucide-react';

const Messages = () => {
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock conversations data
  const conversations = [
    {
      id: 1,
      name: 'Alex Johnson',
      avatar: '',
      lastMessage: 'Hey! Are you free for coffee later?',
      timestamp: '2 min ago',
      unread: 2,
      online: true
    },
    {
      id: 2,
      name: 'Sarah Chen',
      avatar: '',
      lastMessage: 'Perfect! See you at the library',
      timestamp: '1 hour ago',
      unread: 0,
      online: false
    },
    {
      id: 3,
      name: 'Study Group',
      avatar: '',
      lastMessage: 'Mike: Anyone up for reviewing tomorrow?',
      timestamp: '3 hours ago',
      unread: 5,
      online: true,
      isGroup: true
    }
  ];

  // Mock messages for selected chat
  const chatMessages = selectedChat ? [
    {
      id: 1,
      sender: 'Alex Johnson',
      message: 'Hey! How\'s your day going?',
      timestamp: '10:30 AM',
      isMe: false
    },
    {
      id: 2,
      sender: 'Me',
      message: 'Pretty good! Just finished my morning class',
      timestamp: '10:32 AM',
      isMe: true
    },
    {
      id: 3,
      sender: 'Alex Johnson',
      message: 'Nice! Are you free for coffee later? I found this great new place downtown',
      timestamp: '10:35 AM',
      isMe: false
    },
    {
      id: 4,
      sender: 'Me',
      message: 'Sounds perfect! What time works for you?',
      timestamp: '10:37 AM',
      isMe: true
    }
  ] : [];

  const handleSendMessage = () => {
    if (message.trim()) {
      // In real app, send message via API
      console.log('Sending message:', message);
      setMessage('');
    }
  };

  if (selectedChat) {
    // Chat View
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
                onClick={() => setSelectedChat(null)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              <Avatar className="w-10 h-10">
                <AvatarImage src={selectedChat.avatar} />
                <AvatarFallback className="bg-white/20 text-white">
                  {selectedChat.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <h2 className="font-semibold text-white">{selectedChat.name}</h2>
                <p className="text-sm text-white/70">
                  {selectedChat.online ? 'Active now' : 'Last seen 1 hour ago'}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 p-2">
                  <Phone className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 p-2">
                  <Video className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 p-2">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 container-mobile py-4 space-y-4 overflow-y-auto">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] ${msg.isMe ? 'order-2' : 'order-1'}`}>
                <div className={`rounded-2xl px-4 py-2 ${
                  msg.isMe 
                    ? 'gradient-primary text-white' 
                    : 'bg-muted text-foreground'
                }`}>
                  <p className="text-sm">{msg.message}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1 px-2">
                  {msg.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="border-t border-border bg-background">
          <div className="container-mobile py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Input
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="pr-12"
                />
              </div>
              <Button 
                size="sm" 
                className="gradient-primary text-white p-2"
                onClick={handleSendMessage}
                disabled={!message.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Conversations List View
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-primary text-white">
        <div className="container-mobile py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="heading-lg text-white">Messages</h1>
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 p-2">
              <Plus className="w-5 h-5" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
            <Input
              placeholder="Search conversations..."
              className="pl-10 bg-white/20 border-white/30 text-white placeholder:text-white/70"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="container-mobile py-6">
        {/* Conversations */}
        <Card className="gradient-card shadow-card border-0">
          <CardContent className="p-0">
            {conversations.map((conversation, index) => (
              <div 
                key={conversation.id}
                className={`flex items-center gap-3 p-4 hover:bg-muted/50 transition-smooth cursor-pointer ${
                  index !== conversations.length - 1 ? 'border-b border-border/50' : ''
                }`}
                onClick={() => setSelectedChat(conversation)}
              >
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={conversation.avatar} />
                    <AvatarFallback className="gradient-primary text-white">
                      {conversation.isGroup ? 'SG' : conversation.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  {conversation.online && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold truncate">{conversation.name}</h3>
                    <span className="text-xs text-muted-foreground">{conversation.timestamp}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{conversation.lastMessage}</p>
                </div>
                
                {conversation.unread > 0 && (
                  <Badge className="gradient-primary text-white text-xs min-w-[1.5rem] h-6 flex items-center justify-center">
                    {conversation.unread}
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Messages;