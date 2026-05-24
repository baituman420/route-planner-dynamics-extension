import React from 'react';
import type { RouteSession } from '../types';
import { BarChart2, Clock, Truck, MapPin, Package, Layers, Sparkles, Navigation } from 'lucide-react';

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
    <div className="p-4 space-y-6 h-full overflow-y-auto pb-20 animate-fade-in">
      {/* OVERALL STATS HEADER */}
      <div className="premium-card p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-5">
          <Sparkles className="w-40 h-40 text-blue-600" />
        </div>
        
        <h2 className="text-lg font-black flex items-center gap-2 text-gray-800 mb-6 pb-3 border-b border-gray-100">
          <BarChart2 className="w-5 h-5 text-blue-600" />
          Métricas Globales de Ruta
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1 */}
          <div className="p-4 bg-gradient-to-br from-blue-50/60 to-blue-50/10 rounded-2xl border border-blue-100 flex items-start gap-4 hover:shadow-sm transition">
            <div className="p-2.5 bg-blue-500 text-white rounded-xl shadow-md shadow-blue-500/10">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Paradas Activas</p>
              <p className="text-2xl font-black text-gray-850">{activeStops}</p>
              <p className="text-[10px] text-gray-500 font-semibold mt-1">
                {geocodedStops} geocodificados correctamente <br/>
                <span className="text-[9px] text-gray-400">({totalStops} en total, {excludedStops} excluidas)</span>
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-4 bg-gradient-to-br from-emerald-50/60 to-emerald-50/10 rounded-2xl border border-emerald-100 flex items-start gap-4 hover:shadow-sm transition">
            <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-md shadow-emerald-500/10">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Jornada Estimada</p>
              <p className="text-2xl font-black text-gray-850">{isOptimized ? formatTime(totalRouteTime) : '-'}</p>
              <p className="text-[10px] text-gray-500 font-semibold mt-1">
                {isOptimized ? 'Tiempo de trayecto + servicio' : 'Precisa optimizar previamente'}
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-4 bg-gradient-to-br from-purple-50/60 to-purple-50/10 rounded-2xl border border-purple-100 flex items-start gap-4 hover:shadow-sm transition">
            <div className="p-2.5 bg-purple-500 text-white rounded-xl shadow-md shadow-purple-500/10">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Distancia de Tránsito</p>
              <p className="text-2xl font-black text-gray-850">{isOptimized ? `${totalTravelDistance.toFixed(1)} km` : '-'}</p>
              <p className="text-[10px] text-gray-500 font-semibold mt-1">
                {isOptimized ? `Tiempo conduciendo: ${formatTime(totalTravelDuration)}` : 'Precisa optimizar previamente'}
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="p-4 bg-gradient-to-br from-amber-50/60 to-amber-50/10 rounded-2xl border border-amber-100 flex items-start gap-4 hover:shadow-sm transition">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-500/10">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Tiempo de Descarga</p>
              <p className="text-2xl font-black text-gray-850">{formatTime(totalDeliveryTime)}</p>
              <p className="text-[10px] text-gray-500 font-semibold mt-1">
                Media asignada: {activeStops > 0 ? `${Math.round(totalDeliveryTime / activeStops)} min / cliente` : '0 min'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* DRIVER BREAKDOWN */}
      {drivers && drivers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-150 pb-2">
            <Layers className="w-5 h-5 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-850">Desglose por Chofer</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
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
                <div key={driver.id} className="premium-card p-5 border-l-4" style={{ borderLeftColor: driver.color }}>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-extrabold text-sm flex items-center gap-2" style={{ color: driver.color }}>
                      <Navigation className="w-4 h-4" /> {driver.name}
                    </h4>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {driverActiveStops} paradas asignadas
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-150 text-center">
                      <p className="text-[9px] text-gray-400 font-extrabold uppercase">Paradas</p>
                      <p className="text-base font-black text-gray-800 mt-0.5">{driverActiveStops}</p>
                    </div>
                    <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-150 text-center">
                      <p className="text-[9px] text-gray-400 font-extrabold uppercase">Jornada</p>
                      <p className="text-base font-black text-gray-800 mt-0.5">{driverOptimized ? formatTime(routeTime) : '-'}</p>
                    </div>
                    <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-150 text-center">
                      <p className="text-[9px] text-gray-400 font-extrabold uppercase">Kilómetros</p>
                      <p className="text-base font-black text-gray-800 mt-0.5">{driverOptimized ? `${travelDistance.toFixed(1)} km` : '-'}</p>
                    </div>
                    <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-150 text-center">
                      <p className="text-[9px] text-gray-400 font-extrabold uppercase">Descarga</p>
                      <p className="text-base font-black text-gray-800 mt-0.5">{formatTime(deliveryTime)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
