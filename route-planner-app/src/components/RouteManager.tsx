import React, { useState } from 'react';
import { Upload, Plus, Trash2, History, Play, Users, MapPin, Layers, Sparkles } from 'lucide-react';
import type { Driver, RouteSession } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

export const COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
  '#ec4899', '#14b8a6', '#f97316', '#ef4444'
];

interface RouteManagerProps {
  onImport: (files: File[], drivers: Driver[]) => void;
  onLoadSession: (session: RouteSession) => void;
  loading: boolean;
}

export const RouteManager: React.FC<RouteManagerProps> = ({ onImport, onLoadSession, loading }) => {
  const [drivers, setDrivers] = useState<Driver[]>([
    { id: '1', name: 'Driver 1', color: COLORS[0] }
  ]);

  const pastSessions = useLiveQuery(() => db.sessions.orderBy('importedAt').reverse().toArray());

  const addDriver = () => {
    const newId = Date.now().toString();
    const nextColor = COLORS[drivers.length % COLORS.length];
    setDrivers([...drivers, { id: newId, name: `Driver ${drivers.length + 1}`, color: nextColor }]);
  };

  const removeDriver = (id: string) => {
    if (drivers.length <= 1) return;
    setDrivers(drivers.filter(d => d.id !== id));
  };

  const updateDriver = (id: string, name: string) => {
    setDrivers(drivers.map(d => d.id === id ? { ...d, name } : d));
  };

  const updateDriverColor = (id: string, color: string) => {
    setDrivers(drivers.map(d => d.id === id ? { ...d, color } : d));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    onImport(files, drivers);
  };

  const handleDeleteSession = async (id: string) => {
    if (confirm("Are you sure you want to delete this route session?")) {
      await db.sessions.delete(id);
    }
  };

  return (
    <div className="p-4 space-y-6 animate-fade-in">
      {/* HEADER HERO */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 opacity-15">
          <Sparkles className="w-64 h-64" />
        </div>
        <div className="relative z-10 space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/20 backdrop-blur-md">
            🚀 Dynamics 365 Connected
          </span>
          <h2 className="text-2xl font-black tracking-tight">Ecosistema de Reparto Inteligente</h2>
          <p className="text-white/80 text-xs max-w-md leading-relaxed font-medium">
            Planifica rutas óptimas de reparto multipunto, asigna pedidos automáticamente a tus transportistas y monitoriza el progreso en tiempo real.
          </p>
        </div>
      </div>

      {/* RECENT ROUTES */}
      {pastSessions && pastSessions.length > 0 && (
        <div className="premium-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gray-50 text-gray-600 rounded-xl border border-gray-100 shadow-sm">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Historial de Planificaciones</h3>
                <p className="text-xs text-gray-400">Rutas guardadas en tu base de datos local</p>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              {pastSessions.length} Registradas
            </span>
          </div>

          <div className="space-y-3">
            {pastSessions.slice(0, 5).map(session => (
              <div key={session.id} className="group flex justify-between items-center p-3 bg-gray-50/50 hover:bg-white border border-gray-150 rounded-2xl transition duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 text-xs">
                      {new Date(session.importedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} • {new Date(session.importedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400 font-semibold flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {session.stops.length} Clientes
                      </span>
                      <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded-md font-extrabold ${session.status === 'optimized' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                        {session.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => onLoadSession(session)} 
                    className="flex items-center gap-1 bg-blue-600 text-white px-3.5 py-1.5 rounded-xl font-bold hover:bg-blue-700 hover:shadow-lg transition text-xs active:scale-95 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> Cargar
                  </button>
                  <button 
                    onClick={() => handleDeleteSession(session.id)} 
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                    title="Eliminar de historial"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NEW ROUTE SETUP / DRIVERS CONFIG */}
      <div className="premium-card p-6">
        <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Configuración de Transportistas</h3>
              <p className="text-xs text-gray-400">Introduce el nombre y asocia un color identificativo a cada conductor</p>
            </div>
          </div>
          <button 
            onClick={addDriver}
            className="flex items-center gap-1 bg-blue-50 text-blue-600 px-3.5 py-1.5 rounded-xl font-bold hover:bg-blue-100 border border-blue-100 text-xs transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Añadir
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {drivers.map((driver, index) => (
            <div key={driver.id} className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-2xl border border-gray-150 transition hover:bg-white hover:shadow-sm">
              <div 
                className="w-8 h-8 rounded-xl border border-white shadow-sm flex-shrink-0 flex items-center justify-center font-bold text-white text-xs"
                style={{ backgroundColor: driver.color }}
              >
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <input 
                  type="text"
                  value={driver.name}
                  onChange={(e) => updateDriver(driver.id, e.target.value)}
                  className="w-full text-xs font-semibold px-2 py-1.5 bg-transparent border border-transparent rounded-lg focus:bg-white focus:border-gray-200 outline-none transition"
                  placeholder="Nombre de Chofer"
                />
              </div>
              <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 cursor-pointer flex-shrink-0">
                <input 
                  type="color"
                  value={driver.color}
                  onChange={(e) => updateDriverColor(driver.id, e.target.value)}
                  className="absolute inset-0 w-full h-full scale-150 cursor-pointer"
                  title="Elegir color de trazado"
                />
              </div>
              <button 
                onClick={() => removeDriver(driver.id)}
                disabled={drivers.length <= 1}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                title="Eliminar chofer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* IMPORT AREA */}
      <div className="relative group flex flex-col items-center justify-center p-8 bg-white rounded-3xl border-2 border-dashed border-gray-250 hover:border-blue-500 transition shadow-sm hover:shadow-md text-center">
        <div className="p-4 bg-blue-50 text-blue-600 rounded-full mb-3 group-hover:scale-110 transition duration-300">
          <Upload className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-gray-800 text-sm mb-1">Importar Hojas de Reparto</h3>
        <p className="text-gray-400 text-xs max-w-xs mb-6">
          Sube tus archivos PDF de venta activa. Extraeremos automáticamente los clientes y sus ubicaciones.
        </p>
        <label className={`relative overflow-hidden bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-3 rounded-xl cursor-pointer hover:shadow-lg transition active:scale-95 text-center w-full max-w-xs ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
           {loading ? (
             <span className="flex items-center justify-center gap-2">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
               </span>
               Procesando documento...
             </span>
           ) : 'Seleccionar Archivos PDF'}
           <input type="file" multiple accept="application/pdf" className="hidden" onChange={handleFileUpload} disabled={loading} />
        </label>
      </div>
    </div>
  );
};
