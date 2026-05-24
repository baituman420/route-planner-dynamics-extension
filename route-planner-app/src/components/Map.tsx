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
  startPoint?: { lat: number; lng: number; address: string } | null;
  endPoint?: { lat: number; lng: number; address: string } | null;
}

export const RouteMap: React.FC<MapProps> = ({ stops, onMarkerClick, drivers, startPoint, endPoint }) => {
  const validStops = stops.filter(s => s.geocodeStatus === 'success' && s.lat && s.lng);
  
  // Center on start point if available, otherwise first stop, otherwise Bilbao central
  const center = startPoint && startPoint.lat && startPoint.lng
    ? [startPoint.lat, startPoint.lng] as [number, number]
    : (validStops.length > 0
        ? [validStops[0].lat!, validStops[0].lng!] as [number, number]
        : [43.2627, -2.9253] as [number, number]); // Bilbao default
    
  // Sort stops by optimized order if available
  const orderedStops = [...validStops].sort((a, b) => (a.optimizedOrder || 0) - (b.optimizedOrder || 0));

  const getMarkerIcon = (stop: DeliveryStop) => {
    if (drivers && stop.assignedDriverId) {
      const driver = drivers.find(d => d.id === stop.assignedDriverId);
      if (driver) {
        const markerHtml = `
          <div style="background: linear-gradient(135deg, ${driver.color}, ${driver.color}dd); width: 28px; height: 28px; border-radius: 50%; border: 2.5px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold; box-shadow: 0 3px 6px rgba(0,0,0,0.3); transition: transform 0.2s hover:scale-110;">
            ${stop.optimizedOrder || ''}
          </div>
        `;
        return L.divIcon({ html: markerHtml, className: 'custom-div-icon', iconSize: [28, 28], iconAnchor: [14, 14] });
      }
    }
    return DefaultIcon;
  };

  const startIcon = L.divIcon({
    html: `
      <div class="animate-bounce" style="background: linear-gradient(135deg, #10b981, #059669); width: 34px; height: 34px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 15px; box-shadow: 0 4px 10px rgba(16,185,129,0.4); z-index: 1000;">
        🏠
      </div>
    `,
    className: 'start-marker-icon',
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });

  const endIcon = L.divIcon({
    html: `
      <div style="background: linear-gradient(135deg, #ef4444, #dc2626); width: 34px; height: 34px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 15px; box-shadow: 0 4px 10px rgba(239,68,68,0.4); z-index: 1000;">
        🏁
      </div>
    `,
    className: 'end-marker-icon',
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });

  return (
    <div className="h-64 w-full sm:h-96 relative z-0 overflow-hidden rounded-2xl border border-gray-150 shadow-md">
      <MapContainer center={center} zoom={13} className="h-full w-full outline-none">
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Render Start Point */}
        {startPoint && startPoint.lat && startPoint.lng && (
          <Marker position={[startPoint.lat, startPoint.lng]} icon={startIcon}>
            <Popup>
              <div className="p-1">
                <div className="font-bold text-green-600 text-xs uppercase tracking-wider mb-1">🏠 Punto de Partida</div>
                <div className="text-gray-800 text-sm font-semibold">{startPoint.address}</div>
                <div className="text-xs text-gray-500 mt-1">Coordenadas: {startPoint.lat.toFixed(5)}, {startPoint.lng.toFixed(5)}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Render End Point */}
        {endPoint && endPoint.lat && endPoint.lng && (
          <Marker position={[endPoint.lat, endPoint.lng]} icon={endIcon}>
            <Popup>
              <div className="p-1">
                <div className="font-bold text-red-600 text-xs uppercase tracking-wider mb-1">🏁 Retorno / Llegada</div>
                <div className="text-gray-800 text-sm font-semibold">{endPoint.address}</div>
                <div className="text-xs text-gray-500 mt-1">Coordenadas: {endPoint.lat.toFixed(5)}, {endPoint.lng.toFixed(5)}</div>
              </div>
            </Popup>
          </Marker>
        )}
        
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
              <div className="text-sm p-1">
                <strong className="text-gray-900 font-bold block mb-1">{stop.optimizedOrder ? `#${stop.optimizedOrder} ` : ''}{stop.customerName}</strong>
                <span className="text-gray-600 text-xs block mb-2">{stop.address}</span>
                {drivers && stop.assignedDriverId && (
                  <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-gray-100">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: drivers.find(d => d.id === stop.assignedDriverId)?.color }}></span>
                    <span className="text-gray-700 font-medium text-xs">Conductor: {drivers.find(d => d.id === stop.assignedDriverId)?.name}</span>
                  </div>
                )}
                {stop.deliveryStart !== '0:00:00' && (
                  <span className="inline-block bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded text-[10px] mt-2">
                    ⏱️ {stop.deliveryStart.substring(0,5)} - {stop.deliveryEnd.substring(0,5)}
                  </span>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Render polylines grouping by driver if present, otherwise single polyline */}
        {drivers && drivers.length > 0 ? (
          drivers.map(driver => {
            const driverStops = orderedStops.filter(s => s.assignedDriverId === driver.id);
            const driverPositions: [number, number][] = [];
            
            // Start of route
            if (startPoint && startPoint.lat && startPoint.lng) {
              driverPositions.push([startPoint.lat, startPoint.lng]);
            }
            
            // Midpoints (Stops)
            driverStops.forEach(s => {
              driverPositions.push([s.lat!, s.lng!]);
            });
            
            // End of route
            if (endPoint && endPoint.lat && endPoint.lng) {
              driverPositions.push([endPoint.lat, endPoint.lng]);
            } else if (startPoint && startPoint.lat && startPoint.lng && driverStops.length > 0) {
              // fallback circular route to starting point
              driverPositions.push([startPoint.lat, startPoint.lng]);
            }
            
            if (driverPositions.length > 1) {
              return <Polyline key={driver.id} positions={driverPositions} color={driver.color} weight={5} opacity={0.75} lineCap="round" lineJoin="round" />;
            }
            return null;
          })
        ) : (
          orderedStops.length > 0 && (
            (() => {
              const positions: [number, number][] = [];
              if (startPoint && startPoint.lat && startPoint.lng) {
                positions.push([startPoint.lat, startPoint.lng]);
              }
              orderedStops.forEach(s => positions.push([s.lat!, s.lng!]));
              if (endPoint && endPoint.lat && endPoint.lng) {
                positions.push([endPoint.lat, endPoint.lng]);
              } else if (startPoint && startPoint.lat && startPoint.lng) {
                positions.push([startPoint.lat, startPoint.lng]);
              }
              return positions.length > 1 ? (
                <Polyline positions={positions} color="#3B82F6" weight={5} opacity={0.75} lineCap="round" lineJoin="round" />
              ) : null;
            })()
          )
        )}
      </MapContainer>
    </div>
  );
};
