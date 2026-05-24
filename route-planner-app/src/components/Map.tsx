import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import type { DeliveryStop, Driver } from '../types';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
  popupAnchor: [0, -41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  stops: DeliveryStop[];
  onMarkerClick: (stop: DeliveryStop) => void;
  drivers?: Driver[];
}

export const RouteMap: React.FC<MapProps> = ({ stops, onMarkerClick, drivers }) => {
  const validStops = stops.filter(s => s.geocodeStatus === 'success' && s.lat && s.lng);
  const center = validStops.length > 0
    ? [validStops[0].lat!, validStops[0].lng!] as [number, number]
    : [43.2627, -2.9253] as [number, number]; // Bilbao default
    
    // Sort stops by optimized order if available
  const orderedStops = [...validStops].sort((a, b) => (a.optimizedOrder || 0) - (b.optimizedOrder || 0));

  const getMarkerIcon = (stop: DeliveryStop) => {
    if (drivers && stop.assignedDriverId) {
      const driver = drivers.find(d => d.id === stop.assignedDriverId);
      if (driver) {
        const markerHtml = `
          <div style="background-color: ${driver.color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            ${stop.optimizedOrder || ''}
          </div>
        `;
        return L.divIcon({ html: markerHtml, className: 'custom-div-icon', iconSize: [24, 24], iconAnchor: [12, 12] });
      }
    }
    return DefaultIcon;
  };

  return (
    <div className="h-64 w-full sm:h-96 relative z-0">
      <MapContainer center={center} zoom={13} className="h-full w-full rounded-md shadow-md outline-none">
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {orderedStops.map((stop) => (
          <Marker 
            key={stop.id} 
            position={[stop.lat!, stop.lng!]}
            icon={getMarkerIcon(stop)}
            eventHandlers={{
              click: () => onMarkerClick(stop),
            }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{stop.optimizedOrder ? `#${stop.optimizedOrder} ` : ''}{stop.customerName}</strong><br />
                {stop.address}<br />
                {drivers && stop.assignedDriverId && drivers.find(d => d.id === stop.assignedDriverId)?.name && (
                   <span className="text-gray-500 font-semibold text-xs">Driver: {drivers.find(d => d.id === stop.assignedDriverId)?.name}<br /></span>
                )}
                {stop.deliveryStart !== '0:00:00' && (
                   <span className="text-blue-600 font-semibold">{stop.deliveryStart} - {stop.deliveryEnd}</span>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Render polylines grouping by driver if present, otherwise single polyline */}
        {drivers && drivers.length > 0 ? (
          drivers.map(driver => {
            const driverStops = orderedStops.filter(s => s.assignedDriverId === driver.id);
            if (driverStops.length > 1) {
              const driverPositions: [number, number][] = driverStops.map(s => [s.lat!, s.lng!]);
              return <Polyline key={driver.id} positions={driverPositions} color={driver.color} weight={4} opacity={0.6} />;
            }
            return null;
          })
        ) : (
          orderedStops.length > 1 && (
            <Polyline positions={orderedStops.map(s => [s.lat!, s.lng!])} color="blue" weight={4} opacity={0.6} />
          )
        )}
      </MapContainer>
    </div>
  );
};
