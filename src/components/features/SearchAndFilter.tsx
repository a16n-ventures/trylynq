import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Filter, MapPin, Users, X, SlidersHorizontal } from 'lucide-react';

interface SearchFilters {
  query: string;
  location: string;
  interests: string[];
  department: string;
  distance: number[];
  status: string;
  age: string;
}

const SearchAndFilter = () => {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    location: '',
    interests: [],
    department: '',
    distance: [5],
    status: 'all',
    age: 'all'
  });

  const interests = [
    'Technology', 'Sports', 'Music', 'Art', 'Gaming', 'Food', 'Travel', 'Books',
    'Movies', 'Fitness', 'Photography', 'Dance', 'Hiking', 'Cooking'
  ];

  const departments = [
    'Computer Science', 'Engineering', 'Business', 'Psychology', 'Biology',
    'Chemistry', 'Physics', 'Mathematics', 'English', 'History', 'Art'
  ];

  // Mock search results
  const searchResults = [
    {
      id: 1,
      name: 'Alex Chen',
      avatar: '',
      department: 'Computer Science',
      interests: ['Technology', 'Gaming', 'Music'],
      location: 'Campus',
      distance: '0.8 miles',
      status: 'online',
      mutualFriends: 3
    },
    {
      id: 2,
      name: 'Sarah Johnson',
      avatar: '',
      department: 'Psychology',
      interests: ['Books', 'Coffee', 'Hiking'],
      location: 'Downtown',
      distance: '1.2 miles',
      status: 'away',
      mutualFriends: 5
    }
  ];

  const handleInterestToggle = (interest: string) => {
    setFilters(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      location: '',
      interests: [],
      department: '',
      distance: [5],
      status: 'all',
      age: 'all'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge className="status-online text-xs">Online</Badge>;
      case 'away':
        return <Badge className="status-away text-xs">Away</Badge>;
      default:
        return <Badge className="status-offline text-xs">Offline</Badge>;
    }
  };

  const ResultCard = ({ person }) => (
    <Card className="gradient-card shadow-card border-0">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12">
            <AvatarImage src={person.avatar} />
            <AvatarFallback className="gradient-primary text-white">
              {person.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{person.name}</h3>
              {getStatusBadge(person.status)}
            </div>
            <p className="text-sm text-muted-foreground">{person.department}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span>{person.location} • {person.distance}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Users className="w-3 h-3" />
              <span>{person.mutualFriends} mutual friends</span>
            </div>
          </div>
          
          <Button size="sm" className="gradient-primary text-white">
            Connect
          </Button>
        </div>
        
        {/* Interests */}
        <div className="mt-3 flex flex-wrap gap-1">
          {person.interests.slice(0, 3).map((interest, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {interest}
            </Badge>
          ))}
          {person.interests.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{person.interests.length - 3} more
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Search */}
      <div className="gradient-primary text-white">
        <div className="container-mobile py-4">
          <h1 className="heading-lg text-white mb-4">Search & Discover</h1>
          
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
              <Input
                placeholder="Search people, interests, departments..."
                className="pl-10 bg-white/20 border-white/30 text-white placeholder:text-white/70"
                value={filters.query}
                onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Filters
              </Button>
              
              {(filters.interests.length > 0 || filters.department || filters.status !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  onClick={clearFilters}
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container-mobile py-6 space-y-6">
        {/* Advanced Filters */}
        {showFilters && (
          <Card className="gradient-card shadow-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Advanced Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Location */}
              <div>
                <Label>Location</Label>
                <Select onValueChange={(value) => setFilters(prev => ({ ...prev, location: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="campus">Campus</SelectItem>
                    <SelectItem value="downtown">Downtown</SelectItem>
                    <SelectItem value="university-district">University District</SelectItem>
                    <SelectItem value="midtown">Midtown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Department */}
              <div>
                <Label>Department/Major</Label>
                <Select onValueChange={(value) => setFilters(prev => ({ ...prev, department: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept.toLowerCase().replace(' ', '-')}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Distance */}
              <div>
                <Label>Distance: {filters.distance[0]} miles</Label>
                <Slider
                  value={filters.distance}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, distance: value }))}
                  max={25}
                  min={1}
                  step={1}
                  className="mt-2"
                />
              </div>

              {/* Status */}
              <div>
                <Label>Online Status</Label>
                <Select onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any status</SelectItem>
                    <SelectItem value="online">Online now</SelectItem>
                    <SelectItem value="away">Away</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Interests */}
              <div>
                <Label>Interests</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {interests.map((interest) => (
                    <Badge
                      key={interest}
                      variant={filters.interests.includes(interest) ? "default" : "outline"}
                      className="cursor-pointer text-center justify-center py-2"
                      onClick={() => handleInterestToggle(interest)}
                    >
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Filters */}
        {(filters.interests.length > 0 || filters.department || filters.status !== 'all') && (
          <div className="flex flex-wrap gap-2">
            {filters.interests.map((interest) => (
              <Badge key={interest} variant="secondary" className="cursor-pointer">
                {interest}
                <X
                  className="w-3 h-3 ml-1"
                  onClick={() => handleInterestToggle(interest)}
                />
              </Badge>
            ))}
            {filters.department && (
              <Badge variant="secondary" className="cursor-pointer">
                {departments.find(d => d.toLowerCase().replace(' ', '-') === filters.department)}
                <X
                  className="w-3 h-3 ml-1"
                  onClick={() => setFilters(prev => ({ ...prev, department: '' }))}
                />
              </Badge>
            )}
            {filters.status !== 'all' && (
              <Badge variant="secondary" className="cursor-pointer">
                {filters.status}
                <X
                  className="w-3 h-3 ml-1"
                  onClick={() => setFilters(prev => ({ ...prev, status: 'all' }))}
                />
              </Badge>
            )}
          </div>
        )}

        {/* Search Results */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="heading-md">Search Results</h2>
            <p className="text-sm text-muted-foreground">{searchResults.length} people found</p>
          </div>
          
          {searchResults.map((person) => (
            <ResultCard key={person.id} person={person} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchAndFilter;