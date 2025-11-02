import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Heart, MessageCircle, Share, MapPin, Calendar, Users, Plus, Image, Video } from 'lucide-react';

const SocialFeed = () => {
  const [postText, setPostText] = useState('');

  // Mock data for feed posts
  const feedPosts = [
    {
      id: 1,
      author: {
        name: 'Sarah Chen',
        avatar: '',
        location: 'University District'
      },
      type: 'event',
      content: 'Just created a study group for CS 101! Who wants to join? 📚',
      timestamp: '2 hours ago',
      likes: 12,
      comments: 3,
      shares: 1,
      event: {
        title: 'CS 101 Study Group',
        date: 'Tomorrow 6:00 PM',
        location: 'Library Room 204'
      }
    },
    {
      id: 2,
      author: {
        name: 'Alex Johnson',
        avatar: '',
        location: 'Downtown'
      },
      type: 'location',
      content: 'Anyone up for coffee? I\'m at Starbucks downtown ☕',
      timestamp: '4 hours ago',
      likes: 8,
      comments: 5,
      shares: 0,
      location: 'Starbucks - 5th Ave'
    },
    {
      id: 3,
      author: {
        name: 'Mike Rodriguez',
        avatar: '',
        location: 'Campus'
      },
      type: 'status',
      content: 'Beautiful sunset from the campus quad! Perfect evening for a walk 🌅',
      timestamp: '1 day ago',
      likes: 24,
      comments: 7,
      shares: 3,
      image: true
    }
  ];

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'event':
        return <Calendar className="w-4 h-4" />;
      case 'location':
        return <MapPin className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const PostCard = ({ post }) => (
    <Card className="gradient-card shadow-card border-0">
      <CardContent className="p-4">
        {/* Post Header */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={post.author.avatar} />
            <AvatarFallback className="gradient-primary text-white text-sm">
              {post.author.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{post.author.name}</h3>
              {post.type !== 'status' && (
                <Badge variant="secondary" className="text-xs">
                  {getPostTypeIcon(post.type)}
                  <span className="ml-1 capitalize">{post.type}</span>
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span>{post.author.location} • {post.timestamp}</span>
            </div>
          </div>
        </div>

        {/* Post Content */}
        <div className="mb-3">
          <p className="text-sm">{post.content}</p>
          
          {/* Event Details */}
          {post.event && (
            <div className="mt-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">{post.event.title}</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{post.event.date}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>{post.event.location}</span>
                </div>
              </div>
            </div>
          )}

          {/* Location Details */}
          {post.location && (
            <div className="mt-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">{post.location}</span>
                <Badge variant="secondary" className="text-xs">Live</Badge>
              </div>
            </div>
          )}

          {/* Image placeholder */}
          {post.image && (
            <div className="mt-3 h-48 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center">
              <span className="text-muted-foreground">📸 Image</span>
            </div>
          )}
        </div>

        {/* Post Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <Button variant="ghost" size="sm" className="flex-1">
            <Heart className="w-4 h-4 mr-1" />
            {post.likes}
          </Button>
          <Button variant="ghost" size="sm" className="flex-1">
            <MessageCircle className="w-4 h-4 mr-1" />
            {post.comments}
          </Button>
          <Button variant="ghost" size="sm" className="flex-1">
            <Share className="w-4 h-4 mr-1" />
            {post.shares}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-primary text-white">
        <div className="container-mobile py-4">
          <h1 className="heading-lg text-white">Social Feed</h1>
          <p className="opacity-90">What's happening around you</p>
        </div>
      </div>
      <div className="container-mobile py-6 space-y-6">
        {/* Create Post */}
        <Card className="gradient-card shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="gradient-primary text-white">U</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3">
                <Textarea
                  placeholder="What's on your mind?"
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Image className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Video className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <MapPin className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button size="sm" className="gradient-primary text-white">
                    Post
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feed Posts */}
        <div className="space-y-4">
          {feedPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>

        {/* Load More */}
        <div className="text-center">
          <Button variant="outline" className="w-full">
            Load More Posts
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SocialFeed;
