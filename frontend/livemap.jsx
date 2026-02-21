import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function LiveMap({ userLocation }) {
  return (
    <MapContainer 
      center={[userLocation.lat, userLocation.lng]} 
      zoom={13} 
      style={{ height: "400px", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <Marker position={[userLocation.lat, userLocation.lng]}>
        <Popup>You are here</Popup>
      </Marker>
    </MapContainer>
  );
}