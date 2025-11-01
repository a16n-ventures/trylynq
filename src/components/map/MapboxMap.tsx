import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin } from 'lucide-react';

interface MapboxMapProps {
  userLocation: { latitude: number; longitude: number } | null;
  friendsLocations: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  }>;
}

export const MapboxMap = ({ userLocation, friendsLocations }: MapboxMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [tokenSaved, setTokenSaved] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !tokenSaved) return;
    if (map.current) return; // Initialize map only once

    try {
      mapboxgl.accessToken = mapboxToken;

      const initialCenter: [number, number] = userLocation 
        ? [userLocation.longitude, userLocation.latitude]
        : [-74.006, 40.7128];

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: initialCenter,
        zoom: 13,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add user location marker
      if (userLocation) {
        const el = document.createElement('div');
        el.className = 'w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg';
        
        new mapboxgl.Marker(el)
          .setLngLat([userLocation.longitude, userLocation.latitude])
          .setPopup(new mapboxgl.Popup().setHTML('<p class="font-semibold">You are here</p>'))
          .addTo(map.current);
      }

      // Add friend markers
      friendsLocations.forEach(friend => {
        const el = document.createElement('div');
        el.className = 'w-3 h-3 bg-secondary rounded-full border-2 border-white shadow-lg';
        
        new mapboxgl.Marker(el)
          .setLngLat([friend.longitude, friend.latitude])
          .setPopup(new mapboxgl.Popup().setHTML(`<p class="font-semibold">${friend.name}</p>`))
          .addTo(map.current!);
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, tokenSaved, userLocation, friendsLocations]);

  if (!tokenSaved) {
    return (
      <div className="h-80 flex items-center justify-center bg-muted/50 rounded-lg p-6">
        <div className="max-w-md w-full space-y-4">
          <Alert>
            <MapPin className="h-4 w-4" />
            <AlertDescription>
              To display the map, please enter your Mapbox public token. Get one free at{' '}
              <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="underline">
                mapbox.com
              </a>
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Label htmlFor="mapbox-token">Mapbox Public Token</Label>
            <Input
              id="mapbox-token"
              type="text"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
              placeholder="pk.eyJ1..."
            />
            <button
              onClick={() => setTokenSaved(true)}
              disabled={!mapboxToken}
              className="w-full px-4 py-2 bg-primary text-white rounded-md disabled:opacity-50"
            >
              Save Token
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <div ref={mapContainer} className="h-80 rounded-lg" />;
};
