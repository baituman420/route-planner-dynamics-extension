import React from 'react';
import type { RouteSession } from '../types';
import { BarChart, Clock, Truck, MapPin, Package } from 'lucide-react';

interface RouteStatsProps {
  session: RouteSession;
}

export const RouteStats: React.FC<RouteStatsProps> = ({ session }) => {
  const { stops, drivers } = session;
  
  const totalStops = stops.length;
  const excludedStops = stops.filter(s => s.excluded).length;
  const activeStops = totalStops - excludedStops;
  const geocodedStops = stops.filter(s => s.geocodeStatus === 'success' && !s.excluded).length;
  
  const optimizedStops = stops.filter(s => s.optimizedOrder);
  const isOptimized = optimizedStops.length > 0;
  
  const totalDeliveryTime = stops
    .filter(s => !s.excluded)
    .reduce((acc, stop) => acc + (Number(stop.extraServiceTime) || 0), 0);
    
  // durationFromPrevious is in minutes, distanceFromPrevious is in km
  const totalTravelDuration = stops
    .filter(s => !s.excluded)
    .reduce((acc, stop) => acc + (stop.durationFromPrevious || 0), 0);
    
  const totalTravelDistance = stops
    .filter(s => !s.excluded)
    .reduce((acc, stop) => acc + (stop.distanceFromPrevious || 0), 0);
    
  const totalRouteTime = totalDeliveryTime + totalTravelDuration;
  
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
  };

  return (
    <div className="p-4 space-y-6 h-full overflow-y-auto pb-20">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800 mb-6">
          <BarChart className="w-6 h-6 text-blue-600" />
          Route Statistics
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-4">
            <Package className="w-8 h-8 text-blue-500 mt-1" />
            <div>
              <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Total Stops</p>
              <p className="text-3xl font-bold text-gray-800">{activeStops}</p>
              <p className="text-sm text-gray-500 mt-1">
                {geocodedStops} geocoded <br/>
                <span className="text-xs text-gray-400">({totalStops} total, {excludedStops} excluded)</span>
              </p>
            </div>
          </div>

          <div className="p-4 bg-green-50 rounded-lg border border-green-100 flex items-start gap-4">
            <Clock className="w-8 h-8 text-green-500 mt-1" />
            <div>
              <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Est. Total Time</p>
              <p className="text-3xl font-bold text-gray-800">{isOptimized ? formatTime(totalRouteTime) : '-'}</p>
              <p className="text-sm text-gray-500 mt-1">{isOptimized ? 'Driving + Delivery' : 'Requires optimization'}</p>
            </div>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 flex items-start gap-4">
            <Truck className="w-8 h-8 text-purple-500 mt-1" />
            <div>
              <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Driving Distance</p>
              <p className="text-3xl font-bold text-gray-800">{isOptimized ? `${totalTravelDistance.toFixed(1)} km` : '-'}</p>
              <p className="text-sm text-gray-500 mt-1">{isOptimized ? formatTime(totalTravelDuration) : 'Requires optimization'}</p>
            </div>
          </div>

          <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 flex items-start gap-4">
            <MapPin className="w-8 h-8 text-orange-500 mt-1" />
            <div>
              <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Service Time</p>
              <p className="text-3xl font-bold text-gray-800">{formatTime(totalDeliveryTime)}</p>
              <p className="text-sm text-gray-500 mt-1">Time spent at stops</p>
            </div>
          </div>
        </div>
      </div>

      {drivers && drivers.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Driver Breakdown</h3>
          {drivers.map(driver => {
            const dStops = stops.filter(s => s.assignedDriverId === driver.id && !s.excluded);
            if (dStops.length === 0) return null;
            
            const driverActiveStops = dStops.length;
            const driverOptimized = dStops.some(s => s.optimizedOrder);
            
            const deliveryTime = dStops.reduce((acc, stop) => acc + (Number(stop.extraServiceTime) || 0), 0);
            const travelDuration = dStops.reduce((acc, stop) => acc + (stop.durationFromPrevious || 0), 0);
            const travelDistance = dStops.reduce((acc, stop) => acc + (stop.distanceFromPrevious || 0), 0);
            const routeTime = deliveryTime + travelDuration;
            
            return (
              <div key={driver.id} className="bg-white p-4 rounded-lg shadow-sm border-l-4" style={{ borderLeftColor: driver.color }}>
                 <h4 className="font-bold text-md mb-4 flex items-center gap-2" style={{ color: driver.color }}>
                   <Truck className="w-5 h-5" /> {driver.name}
                 </h4>
                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                   <div className="bg-gray-50 p-3 rounded border border-gray-200">
                     <p className="text-xs text-gray-500 font-semibold uppercase">Stops</p>
                     <p className="text-lg font-bold text-gray-800">{driverActiveStops}</p>
                   </div>
                   <div className="bg-gray-50 p-3 rounded border border-gray-200">
                     <p className="text-xs text-gray-500 font-semibold uppercase">Total Time</p>
                     <p className="text-lg font-bold text-gray-800">{driverOptimized ? formatTime(routeTime) : '-'}</p>
                   </div>
                   <div className="bg-gray-50 p-3 rounded border border-gray-200">
                     <p className="text-xs text-gray-500 font-semibold uppercase">Distance</p>
                     <p className="text-lg font-bold text-gray-800">{driverOptimized ? `${travelDistance.toFixed(1)} km` : '-'}</p>
                   </div>
                   <div className="bg-gray-50 p-3 rounded border border-gray-200">
                     <p className="text-xs text-gray-500 font-semibold uppercase">Service</p>
                     <p className="text-lg font-bold text-gray-800">{formatTime(deliveryTime)}</p>
                   </div>
                 </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
