'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

function MapCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13, { animate: true });
  }, [center, map]);
  return null;
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
  const mapRef = useRef<L.Map | null>(null);
  const fallback: [number, number] = [6.5244, 3.3792];

  const center: [number, number] = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : fallback;

  const userIcon = new L.Icon({
    iconUrl:
      'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  const friendIcon = new L.Icon({
    iconUrl:
      'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  // Process and validate friend locations
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

  // Auto-fit bounds when friends change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const timer = setTimeout(() => {
      map.invalidateSize();

      // Fit bounds to include all markers
      if (validFriends.length > 0) {
        const allPoints: [number, number][] = validFriends.map((f) => [
          f.latitude!,
          f.longitude!,
        ]);

        // Include user location if available
        if (userLocation) {
          allPoints.push([userLocation.latitude, userLocation.longitude]);
        }

        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      } else if (userLocation) {
        map.setView([userLocation.latitude, userLocation.longitude], 13);
      } else {
        map.setView(center, 13);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [validFriends.length, userLocation, center]);

  // Handle window resize
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      style={{
        height: '60vh',
        minHeight: '400px',
        width: '100%',
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        ref={(mapInstance) => {
          if (mapInstance) {
            mapRef.current = mapInstance;
          }
        }}
        whenReady={(map) => {
          setTimeout(() => {
            map.target.invalidateSize();
          }, 200);
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userLocation && (
          <>
            <MapCenter
              center={[userLocation.latitude, userLocation.longitude]}
            />
            <Marker
              position={[userLocation.latitude, userLocation.longitude]}
              icon={userIcon}
            >
              <Popup>You are here</Popup>
            </Marker>
          </>
        )}

        {validFriends.map((f) => (
          <Marker
            key={f.id}
            position={[f.latitude!, f.longitude!]}
            icon={friendIcon}
          >
            <Popup>{f.name}</Popup>
          </Marker>
        ))}
      </MapContainer>

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
            fontSize: 14,
            textAlign: 'center',
            zIndex: 1000,
          }}
        >
          {loading && 'Fetching your location...'}
          {error && !loading && error}
        </div>
      )}
    </div>
  );
}
