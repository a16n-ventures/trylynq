import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LeafletMapProps {
  userLocation: { latitude: number; longitude: number } | null;
  friendsLocations: Array<{
    id: string;
    name: string;
    latitude?: number | null;
    longitude?: number | null;
  }>;
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

export const LeafletMap = ({
  userLocation,
  friendsLocations,
  loading,
  error,
}: LeafletMapProps) => {
  const mapRef = useRef<L.Map | null>(null);

  // Lagos fallback
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

  // ✅ Force map to re-render correctly after load or resize
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const resize = () => map.invalidateSize();
    const timeout = setTimeout(resize, 1000);
    window.addEventListener('resize', resize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', resize);
    };
  }, [userLocation, friendsLocations]);

  const validFriends = friendsLocations.filter(
    (f) => typeof f.latitude === 'number' && typeof f.longitude === 'number'
  );

  return (
    <div
      style={{
        height: '400px', // ✅ ensure visible area
        width: '100%',
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        ref={(map) => {
          if (map) {
            mapRef.current = map;
            setTimeout(() => map.invalidateSize(), 800);
          }
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userLocation && (
          <>
            <MapCenter center={[userLocation.latitude, userLocation.longitude]} />
            <Marker
              position={[userLocation.latitude, userLocation.longitude]}
              icon={userIcon}
            >
              <Popup>You are here</Popup>
            </Marker>
          </>
        )}

        {validFriends.map((f) => (
          <Marker key={f.id} position={[f.latitude!, f.longitude!]} icon={friendIcon}>
            <Popup>{f.name}</Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Overlay for loading/error */}
      {(loading || error) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            color: '#fff',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          {loading ? 'Fetching your location...' : error}
        </div>
      )}
    </div>
  );
};
