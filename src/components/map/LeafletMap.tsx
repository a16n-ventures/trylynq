'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

interface FriendLocation {
  user_id: string;
  latitude: string | number | null;
  longitude: string | number | null;
  profiles?: {
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

interface LeafletMapProps {
  userLocation: { latitude: number; longitude: number } | null;
  friendsLocations: FriendLocation[];
  loading?: boolean;
  error?: string | null;
}

// Helper to safely convert to number
const toNumber = (val: string | number | null | undefined): number | null => {
  if (val === null || val === undefined) return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return Number.isFinite(num) ? num : null;
};

export default function LeafletMap({
  userLocation,
  friendsLocations,
  loading,
  error,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Ensure we're on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isClient || !mapContainerRef.current || mapRef.current) return;

    const initMap = async () => {
      try {
        // Dynamic import of Leaflet
        const L = (await import('leaflet')).default;

        // Fix default marker icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        const fallback: [number, number] = [6.5244, 3.3792];
        const center: [number, number] = userLocation
          ? [userLocation.latitude, userLocation.longitude]
          : fallback;

        // Create map
        const map = L.map(mapContainerRef.current, {
          center: center,
          zoom: 13,
          zoomControl: true,
        });

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        mapRef.current = map;
        setMapReady(true);

        // Force resize after a short delay
        setTimeout(() => {
          map.invalidateSize();
        }, 100);

      } catch (err) {
        console.error('Failed to initialize map:', err);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, [isClient, userLocation]);

  // Update markers when data changes
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const updateMarkers = async () => {
      try {
        const L = (await import('leaflet')).default;
        const map = mapRef.current;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        const userIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        });

        const friendIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        });

        const allPoints: [number, number][] = [];

        // Add user marker
        if (userLocation) {
          const userMarker = L.marker(
            [userLocation.latitude, userLocation.longitude],
            { icon: userIcon }
          ).addTo(map);
          userMarker.bindPopup('You are here');
          markersRef.current.push(userMarker);
          allPoints.push([userLocation.latitude, userLocation.longitude]);
        }

        // Add friend markers
        const validFriends = friendsLocations
          .map((f) => {
            const lat = toNumber(f.latitude);
            const lng = toNumber(f.longitude);
            return {
              id: f.user_id,
              name: f.profiles?.display_name || 'Friend',
              latitude: lat,
              longitude: lng,
            };
          })
          .filter((f) => f.latitude !== null && f.longitude !== null);

        validFriends.forEach((friend) => {
          const marker = L.marker(
            [friend.latitude!, friend.longitude!],
            { icon: friendIcon }
          ).addTo(map);
          marker.bindPopup(friend.name);
          markersRef.current.push(marker);
          allPoints.push([friend.latitude!, friend.longitude!]);
        });

        // Fit bounds or center on user
        if (allPoints.length > 1) {
          const bounds = L.latLngBounds(allPoints);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        } else if (allPoints.length === 1) {
          map.setView(allPoints[0], 13);
        } else if (userLocation) {
          map.setView([userLocation.latitude, userLocation.longitude], 13);
        }

        // Final resize
        setTimeout(() => map.invalidateSize(), 200);

      } catch (err) {
        console.error('Failed to update markers:', err);
      }
    };

    updateMarkers();
  }, [mapReady, userLocation, friendsLocations]);

  // Handle window resize
  useEffect(() => {
    if (!mapRef.current) return;

    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mapReady]);

  if (!isClient) {
    return (
      <div style={{ height: '60vh', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
        <p>Loading map...</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '60vh', minHeight: '400px', width: '100%' }}>
      <div
        ref={mapContainerRef}
        style={{
          height: '100%',
          width: '100%',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#f3f4f6',
        }}
      />

      {/* Status overlay */}
      {(loading || error) && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '12px 16px',
            fontSize: '14px',
            textAlign: 'center',
            zIndex: 1000,
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
          }}
        >
          {loading && 'Fetching your location...'}
          {error && !loading && error}
        </div>
      )}

      {!mapReady && !loading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '14px',
            color: '#666',
          }}
        >
          Initializing map...
        </div>
      )}
    </div>
  );
}
