import React, { useState } from 'react';
import { Upload, Plus, Trash2, History, Play } from 'lucide-react';
import type { Driver, RouteSession } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

export const COLORS = [
  '#ef4444', '#3b82f6', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
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
    if(confirm("Are you sure you want to delete this route session?")) {
      await db.sessions.delete(id);
    }
  };

  return (
    <div className="p-4 space-y-6">
      
      {pastSessions && pastSessions.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
             <History className="w-5 h-5 text-gray-500" />
             <h2 className="text-xl font-bold text-gray-800">Recent Routes</h2>
          </div>
          <div className="space-y-3">
             {pastSessions.slice(0, 5).map(session => (
               <div key={session.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-200">
                  <div>
                    <h3 className="font-semibold text-gray-800">{new Date(session.importedAt).toLocaleDateString()} {new Date(session.importedAt).toLocaleTimeString()}</h3>
                    <p className="text-xs text-gray-500">{session.stops.length} stops • Status: {session.status}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onLoadSession(session)} className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-md font-semibold hover:bg-blue-200 text-sm">
                      <Play className="w-4 h-4"/> Load
                    </button>
                    <button onClick={() => handleDeleteSession(session.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md">
                      <Trash2 className="w-5 h-5"/>
                    </button>
                  </div>
               </div>
             ))}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">New Route Setup</h2>
          <button 
            onClick={addDriver}
            className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-md font-semibold hover:bg-green-200 text-sm"
          >
            <Plus className="w-4 h-4" /> Add Driver
          </button>
        </div>
        
        <div className="space-y-3">
          {drivers.map((driver, index) => (
            <div key={driver.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div 
                className="w-8 h-8 rounded-full border-2 border-white shadow-sm flex-shrink-0 flex items-center justify-center font-bold text-white text-xs"
                style={{ backgroundColor: driver.color }}
              >
                {index + 1}
              </div>
              <input 
                type="text"
                value={driver.name}
                onChange={(e) => updateDriver(driver.id, e.target.value)}
                className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="Driver Name"
              />
              <input 
                type="color"
                value={driver.color}
                onChange={(e) => updateDriverColor(driver.id, e.target.value)}
                className="w-10 h-10 p-1 border border-gray-300 rounded cursor-pointer"
                title="Choose driver color"
              />
              <button 
                onClick={() => removeDriver(driver.id)}
                disabled={drivers.length <= 1}
                className="p-2 text-red-500 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg border-2 border-dashed border-gray-300 shadow">
        <Upload className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-lg font-bold text-gray-700 mb-2">Import Route Sheets</h2>
        <p className="text-gray-500 text-center mb-6 text-sm">
          Upload PDF(s) containing delivery stops.
        </p>
        <label className={`bg-blue-600 text-white px-6 py-3 rounded-md font-semibold cursor-pointer hover:bg-blue-700 transition shadow-lg w-full text-center ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
           {loading ? 'Processing...' : 'Select PDF Files'}
           <input type="file" multiple accept="application/pdf" className="hidden" onChange={handleFileUpload} disabled={loading} />
        </label>
      </div>
    </div>
  );
};
