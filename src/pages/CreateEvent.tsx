import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar, MapPin, Users, Clock, DollarSign, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CreateEvent = () => {
  const navigate = useNavigate();
  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    capacity: '',
    price: '',
    category: '',
    isPrivate: false,
    requireApproval: false
  });

  const categories = [
    'Study Group',
    'Social Hangout',
    'Sports & Fitness',
    'Food & Dining',
    'Entertainment',
    'Networking',
    'Other'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to create an event');
        return;
      }

      const { error } = await supabase
        .from('events')
        .insert({
          title: eventData.title,
          description: eventData.description,
          category: eventData.category,
          location: eventData.location,
          start_date: `${eventData.date} ${eventData.time}`,
          end_date: null,
          max_attendees: eventData.capacity ? parseInt(eventData.capacity) : null,
          ticket_price: eventData.price ? parseFloat(eventData.price) : 0,
          is_public: !eventData.isPrivate,
          creator_id: user.id
        });

      if (error) throw error;

      toast.success('Event created successfully!');
      navigate('/app');
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-primary text-white">
        <div className="container-mobile py-4">
          <div className="flex items-center gap-3 mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/20 p-2"
              onClick={() => navigate('/app')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="heading-lg text-white">Create Event</h1>
          </div>
        </div>
      </div>

      <div className="container-mobile py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card className="gradient-card shadow-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="heading-lg">Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Event Title</Label>
                <Input
                  id="title"
                  placeholder="What's your event about?"
                  value={eventData.title}
                  onChange={(e) => setEventData({...eventData, title: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Tell people more about your event..."
                  value={eventData.description}
                  onChange={(e) => setEventData({...eventData, description: e.target.value})}
                  className="min-h-[100px]"
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select onValueChange={(value) => setEventData({...eventData, category: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Date & Time */}
          <Card className="gradient-card shadow-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                When
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={eventData.date}
                    onChange={(e) => setEventData({...eventData, date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={eventData.time}
                    onChange={(e) => setEventData({...eventData, time: e.target.value})}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card className="gradient-card shadow-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Where
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="Where will your event take place?"
                  value={eventData.location}
                  onChange={(e) => setEventData({...eventData, location: e.target.value})}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Capacity & Pricing */}
          <Card className="gradient-card shadow-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Tickets & Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="capacity">Max Attendees</Label>
                  <Input
                    id="capacity"
                    type="number"
                    placeholder="50"
                    value={eventData.capacity}
                    onChange={(e) => setEventData({...eventData, capacity: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="price">Ticket Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    value={eventData.price}
                    onChange={(e) => setEventData({...eventData, price: e.target.value})}
                  />
                </div>
              </div>
              
              {parseFloat(eventData.price) > 0 && (
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h4 className="font-semibold text-sm">Ticket Sales Information</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Platform fee: 2% of ticket sales</p>
                    <p>• Payments processed securely via Flutterwave</p>
                    <p>• Earnings transferred within 2 business days</p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Ticket price: ${eventData.price}</span>
                    <span className="font-semibold">You earn: ${(parseFloat(eventData.price || '0') * 0.98).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Privacy Settings */}
          <Card className="gradient-card shadow-card border-0">
            <CardHeader className="pb-3">
              <CardTitle>Privacy Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="private">Private Event</Label>
                  <p className="text-sm text-muted-foreground">Only invited friends can see this event</p>
                </div>
                <Switch
                  id="private"
                  checked={eventData.isPrivate}
                  onCheckedChange={(checked) => setEventData({...eventData, isPrivate: checked})}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="approval">Require Approval</Label>
                  <p className="text-sm text-muted-foreground">You approve each person who wants to join</p>
                </div>
                <Switch
                  id="approval"
                  checked={eventData.requireApproval}
                  onCheckedChange={(checked) => setEventData({...eventData, requireApproval: checked})}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="grid grid-cols-2 gap-4">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => navigate('/app')}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="gradient-primary text-white"
            >
              Create Event
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEvent;