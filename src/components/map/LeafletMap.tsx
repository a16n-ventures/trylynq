import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LeafletMapProps {
  userLocation: { latitude: number; longitude: number } | null;
  friendsLocations: Array<{
    id: string;
    name: string;
    latitude?: number | null;
    longitude?: number | null;
  }>;
}

function MapCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 400);
    return () => clearTimeout(timeout);
  }, [map]);
  return null;
}

export const LeafletMap = ({ userLocation, friendsLocations }: LeafletMapProps) => {
  const center: [number, number] = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : [40.7128, -74.006];

  const userIcon = new L.Icon({
    iconUrl:
      'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  const friendIcon = new L.Icon({
    iconUrl:
      'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  const validFriends = friendsLocations.filter(
    (f) => typeof f.latitude === 'number' && typeof f.longitude === 'number'
  );

  return (
    <MapContainer
      center={center}
      zoom={13}
      className="h-80 rounded-lg z-0"
      style={{ height: '320px', width: '100%', zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapResizer />
      {userLocation && <MapCenter center={[userLocation.latitude, userLocation.longitude]} />}
      {userLocation && (
        <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon}>
          <Popup><div className="font-semibold">You are here</div></Popup>
        </Marker>
      )}
      {validFriends.map((friend) => (
        <Marker
          key={friend.id}
          position={[friend.latitude!, friend.longitude!]}
          icon={friendIcon}
        >
          <Popup><div className="font-semibold">{friend.name}</div></Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};
            
