import { useState, useEffect } from 'react';
import { parsePdfToStops } from './utils/pdfParser';
import { geocodeAddress, optimizeForDrivers } from './utils/geocoder';
import type { DeliveryStop, RouteSession, Driver } from './types';
import { RouteMap } from './components/Map';
import { StopEditor } from './components/StopEditor';
import { RouteStats } from './components/RouteStats';
import { RouteManager } from './components/RouteManager';
import { OCRScanner } from './components/OCRScanner';
import { db } from './db/db';
import { Users, Map as MapIcon, Edit, Bug, Navigation, Play, BarChart, Plus, Camera, AlertTriangle, Package, Scale, CheckCircle } from 'lucide-react';

declare const chrome: any;

function App() {
  const [session, setSession] = useState<RouteSession | null>(null);
  const [activeTab, setActiveTab] = useState<'manager' | 'review' | 'map' | 'stats' | 'debug'>('manager');
  const [loading, setLoading] = useState(false);
  const [rawRows, setRawRows] = useState<string[]>([]);
  const [geocodingProgress, setGeocodingProgress] = useState(0);
  const [ showScanner, setShowScanner ] = useState(false);
  const [activeExpandedStop, setActiveExpandedStop] = useState<string | null>(null);
  const [isExtension, setIsExtension] = useState(false);

  useEffect(() => {
    const isExt = typeof chrome !== 'undefined' && !!chrome.runtime;
    setIsExtension(isExt);
  }, []);

  useEffect(() => {
    // Escuchar mensajes provenientes del Content Script en la pestaña de Dynamics 365
    const handleMessage = async (message: any) => {
      if (message.type === 'D365_DATA_EXTRACTED') {
        const d365Stop = message.stop;
        
        const newStop: DeliveryStop = {
          id: `d365_${d365Stop.id || Date.now()}`,
          routeGroup: 'DYNAMICS',
          customerCode: d365Stop.customerCode || 'D365',
          customerName: d365Stop.customerName || 'Cliente Dynamics',
          address: d365Stop.address || '',
          city: d365Stop.city || 'BILBAO',
          postalCode: d365Stop.postalCode || '',
          deliveryStart: d365Stop.deliveryStart || '08:00:00',
          deliveryEnd: d365Stop.deliveryEnd || '18:00:00',
          pageNumber: 1,
          originalText: `Importado desde Dynamics 365 Sales Order\nPeso: ${d365Stop.weight} kg | Cajas: ${d365Stop.boxCount}`,
          extraServiceTime: 5,
          priority: false,
          fixedFirst: false,
          fixedLast: false,
          excluded: false,
          geocodeStatus: 'pending',
          weight: d365Stop.weight || 0,
          boxCount: d365Stop.boxCount || 1,
          status: 'pending'
        };

        setSession(prev => {
          let updatedSession: RouteSession;
          if (!prev) {
            // Si no hay sesión activa, creamos una nueva
            updatedSession = {
              id: `session_d365_${Date.now()}`,
              fileName: 'Dynamics 365 Live Import',
              importedAt: Date.now(),
              drivers: [
                { id: '1', name: 'Conductor 1', color: '#3B82F6' }
              ],
              stops: [newStop],
              status: 'imported',
              notes: 'Importado directamente desde Dynamics 365'
            };
          } else {
            // Evitar duplicados por código de cliente
            const exists = prev.stops.some(s => s.customerCode === newStop.customerCode);
            if (exists) {
              alert(`El pedido ${newStop.customerCode} ya está en la lista de paradas.`);
              return prev;
            }
            updatedSession = {
              ...prev,
              stops: [newStop, ...prev.stops]
            };
          }
          saveSessionToDB(updatedSession);
          return updatedSession;
        });

        setActiveTab('review');
        alert(`¡Pedido ${newStop.customerCode} (${newStop.customerName}) importado correctamente!`);
      } else if (message.type === 'D365_EXTRACTION_ERROR') {
        alert(`Error al extraer: ${message.message}`);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => {
        chrome.runtime.onMessage.removeListener(handleMessage);
      };
    }
  }, [session]);

  const triggerDynamicsExtraction = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.id) {
          chrome.tabs.sendMessage(activeTab.id, { type: 'TRIGGER_EXTRACTION' });
        } else {
          alert('No se detectó pestaña de Dynamics 365 activa.');
        }
      });
    } else {
      // Mock de prueba para cuando no corre como extensión
      const mockStop = {
        id: 'mock_salesorder_123',
        customerCode: 'PED-98745',
        customerName: 'Supermercados Ercoreca S.L.',
        address: 'Gran Via 45',
        city: 'BILBAO',
        postalCode: '48011',
        weight: 42.5,
        boxCount: 8,
        deliveryStart: '10:00:00',
        deliveryEnd: '14:00:00'
      };
      
      const eventMessage = {
        type: 'D365_DATA_EXTRACTED',
        stop: mockStop
      };
      
      // Simular la llegada del mensaje
      setTimeout(() => {
        window.postMessage(eventMessage, '*');
      }, 500);
      
      // Añadir event listener para pruebas locales de simulación
      const localSim = (e: MessageEvent) => {
        if (e.data && e.data.type === 'D365_DATA_EXTRACTED') {
          handleMessage(e.data);
          window.removeEventListener('message', localSim);
        }
      };
      const handleMessage = (msg: any) => {
        const d365Stop = msg.stop;
        const newStop: DeliveryStop = {
          id: `d365_${d365Stop.id || Date.now()}`,
          routeGroup: 'DYNAMICS',
          customerCode: d365Stop.customerCode || 'D365',
          customerName: d365Stop.customerName || 'Cliente Dynamics',
          address: d365Stop.address || '',
          city: d365Stop.city || 'BILBAO',
          postalCode: d365Stop.postalCode || '',
          deliveryStart: d365Stop.deliveryStart || '08:00:00',
          deliveryEnd: d365Stop.deliveryEnd || '18:00:00',
          pageNumber: 1,
          originalText: `Importado desde Dynamics 365 Sales Order\nPeso: ${d365Stop.weight} kg | Cajas: ${d365Stop.boxCount}`,
          extraServiceTime: 5,
          priority: false,
          fixedFirst: false,
          fixedLast: false,
          excluded: false,
          geocodeStatus: 'pending',
          weight: d365Stop.weight || 0,
          boxCount: d365Stop.boxCount || 1,
          status: 'pending'
        };

        setSession(prev => {
          let updatedSession: RouteSession;
          if (!prev) {
            updatedSession = {
              id: `session_d365_${Date.now()}`,
              fileName: 'Dynamics 365 Live Import',
              importedAt: Date.now(),
              drivers: [
                { id: '1', name: 'Conductor 1', color: '#3B82F6' }
              ],
              stops: [newStop],
              status: 'imported',
              notes: 'Importado directamente desde Dynamics 365'
            };
          } else {
            const exists = prev.stops.some(s => s.customerCode === newStop.customerCode);
            if (exists) {
              alert(`El pedido ${newStop.customerCode} ya está en la lista de paradas.`);
              return prev;
            }
            updatedSession = {
              ...prev,
              stops: [newStop, ...prev.stops]
            };
          }
          saveSessionToDB(updatedSession);
          return updatedSession;
        });

        setActiveTab('review');
        alert(`[SIMULACIÓN] Pedido ${newStop.customerCode} importado con éxito.`);
      };
      
      window.addEventListener('message', localSim);
      alert('Simulación de Importación iniciada. Recibirás un cliente ficticio en 0.5s.');
    }
  };

  useEffect(() => {
    // We no longer rely strictly on localStorage for the master record, 
    // but we can load the very latest session from Dexie initially
    const loadLast = async () => {
       const latest = await db.sessions.orderBy('importedAt').last();
       if (latest) {
          setSession(latest);
          if (latest.status === 'imported') setActiveTab('review');
          else if (latest.status === 'optimized') setActiveTab('map');
       }
    };
    loadLast();
  }, []);


  const saveSessionToDB = async (sess: RouteSession) => {
    try {
       await db.sessions.put(sess);
    } catch (e) {
       console.error("Failed to save session to DB", e);
    }
  };

  const saveCustomerIndex = async (stop: DeliveryStop) => {
    if (stop.customerCode && stop.customerCode.trim() !== '') {
       await db.customers.put({
          customerCode: stop.customerCode,
          customerName: stop.customerName,
          address: stop.address,
          city: stop.city,
          postalCode: stop.postalCode,
          lat: stop.lat,
          lng: stop.lng,
          geocodeStatus: stop.geocodeStatus,
          extraServiceTime: stop.extraServiceTime,
          lastSeenAt: Date.now()
       });
    }
  };

  const handleImport = async (files: File[], drivers: Driver[]) => {
    setLoading(true);
    try {
      const { stops, rawText } = await parsePdfToStops(files);
      setRawRows(rawText);
      
      const newSession: RouteSession = {
        id: Date.now().toString(),
        fileName: files.map(f => f.name).join(', '),
        importedAt: Date.now(),
        drivers: drivers,
        stops,
        status: 'imported',
        notes: ''
      };
      setSession(newSession);
      await saveSessionToDB(newSession);
      setActiveTab('review');
    } catch (error) {
       alert("Error parsing PDFs.");
       console.error(error);
    } finally {
       setLoading(false);
    }
  };

  const handleLoadSession = (loadedSession: RouteSession) => {
     setSession(loadedSession);
     setActiveTab(loadedSession.status === 'optimized' ? 'map' : 'review');
  };

  const startGeocoding = async () => {
    if(!session) return;
    setLoading(true);
    let updatedStops = [...session.stops];
    let processed = 0;
    
    for (let i = 0; i < updatedStops.length; i++) {
       const stop = updatedStops[i];
       if (stop.excluded) continue;
       if (stop.geocodeStatus === 'success') {
          processed++;
          setGeocodingProgress(Math.floor((processed / updatedStops.length) * 100));
          continue;
       }
       
       const geo = await geocodeAddress(stop.address, stop.city);
       if (geo) {
          updatedStops[i] = { ...stop, lat: geo.lat, lng: geo.lng, geocodeStatus: 'success' };
          await saveCustomerIndex(updatedStops[i]); // Save to registry
       } else {
          updatedStops[i] = { ...stop, geocodeStatus: 'failed' };
       }
       processed++;
       setGeocodingProgress(Math.floor((processed / updatedStops.length) * 100));
       
       await new Promise(r => setTimeout(r, 1000));
    }
    
    const newSession = { ...session, stops: updatedStops };
    setSession(newSession);
    await saveSessionToDB(newSession);
    setLoading(false);
    setGeocodingProgress(0);
    alert('Geocoding finished. Check failed stops or proceed to optimize.');
  };

  const handleOptimize = () => {
    if(!session) return;
    try {
       const optimized = optimizeForDrivers(session.stops, session.drivers || []);
       
       const unoptimized = session.stops.filter(s => 
           !optimized.find(op => op.id === s.id)
       ).map(s => ({ ...s, optimizedOrder: undefined }));
       
       const newSession: RouteSession = {
         ...session,
         stops: [...optimized, ...unoptimized],
         status: 'optimized'
       };
       setSession(newSession);
       saveSessionToDB(newSession);
       setActiveTab('map');
    } catch (e) {
       alert('Optimization error. Make sure stops are geocoded.');
    }
  };

  const handleUpdateStop = async (updated: DeliveryStop) => {
    if (!session) return;
    const newStops = session.stops.map(s => s.id === updated.id ? updated : s);
    const newSession = { ...session, stops: newStops };
    setSession(newSession);
    await saveSessionToDB(newSession);
    
    // Si el usuario cambia manualmente una direccón o coordenada, actualizar registry
    await saveCustomerIndex(updated);
  };
  
  const handleDeleteStop = async (id: string) => {
    if (!session) return;
    const newStops = session.stops.filter(s => s.id !== id);
    const newSession = { ...session, stops: newStops };
    setSession(newSession);
    await saveSessionToDB(newSession);
  };

  const addManualStop = () => {
    if(!session) return;
    const newStop: DeliveryStop = {
        id: `manual_${Date.now()}`,
        routeGroup: 'MANUAL',
        customerCode: `M-${Math.floor(Math.random()*10000)}`,
        customerName: 'New Client',
        address: '',
        city: 'BILBAO',
        postalCode: '',
        deliveryStart: '0:00:00',
        deliveryEnd: '0:00:00',
        pageNumber: 0,
        originalText: 'Manual Entry',
        extraServiceTime: 5,
        priority: false,
        fixedFirst: false,
        fixedLast: false,
        excluded: false,
        geocodeStatus: 'pending'
    };
    const newStops = [newStop, ...session.stops];
    const newSession = { ...session, stops: newStops };
    setSession(newSession);
    saveSessionToDB(newSession);
  };

  const handleAddScannedStop = (scannedStop: DeliveryStop) => {
    if(!session) return;
    const newStops = [scannedStop, ...session.stops];
    const newSession = { ...session, stops: newStops };
    setSession(newSession);
    saveSessionToDB(newSession);
    setShowScanner(false);
    alert('Scanned stop added to the top of the list! Please review it.');
  };

  const navigateToStop = (stop: DeliveryStop) => {
    if(!stop.lat || !stop.lng) {
      alert("Missing coordinates");
      return;
    }
    window.location.href = `google.navigation:q=${stop.lat},${stop.lng}`;
  };

  const handleReorder = async (draggedId: string, targetId: string) => {
    if (!session) return;
    const draggedStop = session.stops.find(s => s.id === draggedId);
    const targetStop = session.stops.find(s => s.id === targetId);
    if (!draggedStop || !targetStop || draggedStop.assignedDriverId !== targetStop.assignedDriverId) return;

    const filteredStops = session.stops
      .filter((s: any) => s.assignedDriverId === draggedStop.assignedDriverId && s.optimizedOrder)
      .sort((a: any, b: any) => a.optimizedOrder - b.optimizedOrder);
    
    const draggedIndex = filteredStops.findIndex(s => s.id === draggedId);
    const targetIndex = filteredStops.findIndex(s => s.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    filteredStops.splice(draggedIndex, 1);
    filteredStops.splice(targetIndex, 0, draggedStop);
    
    const newStops = [...session.stops];
    filteredStops.forEach((stop, index) => {
        const globalIndex = newStops.findIndex(s => s.id === stop.id);
        if (globalIndex > -1) {
             newStops[globalIndex] = { ...newStops[globalIndex], optimizedOrder: index + 1 };
        }
    });
    
    const newSession = { ...session, stops: newStops };
    setSession(newSession);
    await saveSessionToDB(newSession);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-blue-600 text-white p-4 shadow-md flex flex-col sm:flex-row justify-between items-center gap-3 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Navigation className="w-5 h-5"/> Route Planner
          </h1>
          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold shadow-sm ${isExtension ? 'bg-green-500 text-white' : 'bg-blue-800 text-blue-200'}`}>
            {isExtension ? 'Edge Extension' : 'Web/App Mode'}
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button 
            onClick={triggerDynamicsExtraction} 
            className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1.5 shadow transition active:scale-95 cursor-pointer"
            title="Importar Pedido de Venta activo de Dynamics 365"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            📥 D365 Import
          </button>
          {session && (
             <span className="text-xs font-semibold bg-blue-700 px-2 py-1.5 rounded shadow-sm">
                {session.stops.length} Stops ({session.stops.filter((s:any)=>s.geocodeStatus==='success').length} Geo)
             </span>
          )}
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto w-full mx-auto md:max-w-4xl p-0 md:p-4 pb-24 md:pb-8">
        {loading && (
           <div className="m-4 md:m-0 p-4 bg-yellow-100 text-yellow-800 text-center text-sm font-semibold rounded shadow-sm mb-4">
              Processing... {geocodingProgress > 0 && `${geocodingProgress}%`}
           </div>
        )}

        {activeTab === 'manager' && (
          <RouteManager onImport={handleImport} onLoadSession={handleLoadSession} loading={loading} />
        )}

        {activeTab === 'review' && session && (
          <div className="p-4 space-y-4">
            
            {showScanner && (
               <OCRScanner onAddScannedStop={handleAddScannedStop} onCancel={() => setShowScanner(false)} />
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
               <h2 className="text-lg font-bold text-gray-800">Review Data</h2>
               <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                 <button onClick={() => setShowScanner(true)} className="flex-1 sm:flex-none bg-indigo-600 text-white px-3 py-2 rounded text-sm font-semibold shadow-sm flex items-center justify-center gap-1 hover:bg-indigo-700">
                    <Camera className="w-4 h-4" /> Scan
                 </button>
                 <button onClick={addManualStop} className="flex-1 sm:flex-none bg-gray-600 text-white px-3 py-2 rounded text-sm font-semibold shadow-sm flex items-center justify-center gap-1 hover:bg-gray-700">
                    <Plus className="w-4 h-4" /> Add
                 </button>
                 <button onClick={startGeocoding} disabled={loading} className="flex-1 sm:flex-none bg-green-600 text-white px-3 py-2 rounded text-sm font-semibold shadow-sm flex items-center justify-center gap-1 hover:bg-green-700">
                    <MapIcon className="w-4 h-4" /> Geo
                 </button>
                 <button onClick={handleOptimize} className="flex-1 sm:flex-none bg-blue-600 text-white px-3 py-2 rounded text-sm font-semibold shadow-sm flex items-center justify-center gap-1 hover:bg-blue-700">
                    <Play className="w-4 h-4" /> Opt
                 </button>
               </div>
            </div>
            
            {session.stops.length === 0 ? (
               <div className="text-center p-8 text-gray-500 bg-white rounded shadow-sm">No valid stops found. Load a route or insert manually.</div>
            ) : (
               <div className="space-y-3">
                 {session.stops.map(stop => (
                   <StopEditor key={stop.id} stop={stop} onUpdate={handleUpdateStop} onDelete={handleDeleteStop} />
                 ))}
               </div>
            )}
          </div>
        )}

        {/* MAP TAB */}
        {activeTab === 'map' && session && (
          <div className="h-full bg-white md:rounded-lg shadow flex flex-col pt-4">
             <div className="p-4 pt-0">
                <h2 className="text-lg font-bold text-gray-800 mb-2">Optimized Route Map</h2>
             </div>
             <RouteMap stops={session.stops} onMarkerClick={navigateToStop} drivers={session.drivers} />
             <div className="p-4 space-y-2 mt-4 bg-gray-100 flex-1 overflow-y-auto">
               <h3 className="font-bold text-gray-600 uppercase text-xs">Route Sequence</h3>
               {session.drivers ? (
                 session.drivers.map(driver => {
                   const driverStops = session.stops.filter((s:any) => s.assignedDriverId === driver.id && s.optimizedOrder);
                   if (driverStops.length === 0) return null;
                   return (
                     <div key={driver.id} className="mb-4">
                       <h4 className="font-bold text-sm mb-2" style={{ color: driver.color }}>{driver.name}</h4>
                       {driverStops.sort((a:any, b:any) => a.optimizedOrder - b.optimizedOrder).map((stop:any, idx:number) => (
                          <div key={stop.id} 
                               draggable
                               onDragStart={(e) => { e.dataTransfer.setData('text/plain', stop.id); }}
                               onDragOver={(e) => e.preventDefault()}
                               onDrop={(e) => {
                                 e.preventDefault();
                                 const draggedId = e.dataTransfer.getData('text/plain');
                                 if (draggedId && draggedId !== stop.id) handleReorder(draggedId, stop.id);
                               }}
                               className="p-3 bg-white rounded shadow-sm border-l-4 mb-2 flex flex-col hover:bg-gray-50 transition cursor-grab active:cursor-grabbing" 
                               style={{ borderLeftColor: driver.color }}>
                             <div className="flex justify-between items-center w-full" onClick={() => setActiveExpandedStop(activeExpandedStop === stop.id ? null : stop.id)}>
                               <div>
                                 <div className="flex items-center gap-1">
                                    <span className="font-bold text-lg mr-2" style={{ color: driver.color }}>{idx + 1}.</span>
                                    <span className={`font-semibold ${stop.status === 'delivered' ? 'text-green-700 line-through' : 'text-gray-800'}`}>{stop.customerName}</span>
                                    {stop.status === 'delivered' && <CheckCircle className="w-4 h-4 text-green-600 inline ml-1" />}
                                 </div>
                                 <p className="text-xs text-gray-500 mt-1">{stop.address}, {stop.city}</p>
                                 <div className="flex gap-2 mt-1">
                                    {!!stop.userNotesActive && <span title="Observaciones"><AlertTriangle className="w-4 h-4 text-yellow-500" /></span>}
                                    {(stop.boxCount && stop.boxCount > 6) ? <span title="Volumen Alto (>6 cajas)"><Package className="w-4 h-4 text-blue-500" /></span> : null}
                                    {(stop.weight && stop.weight > 30) ? <span title="Peso Alto (>30kg)"><Scale className="w-4 h-4 text-red-500" /></span> : null}
                                    {!!stop.hasIncidents && <span title="Incidencias"><AlertTriangle className="w-4 h-4 text-red-600" /></span>}
                                 </div>
                               </div>
                               <button onClick={(e) => { e.stopPropagation(); navigateToStop(stop); }} className="p-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 shadow">
                                  <Navigation className="w-5 h-5"/>
                               </button>
                             </div>
                             {activeExpandedStop === stop.id && (
                                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600 cursor-auto" onClick={(e) => e.stopPropagation()}>
                                   <div className="flex flex-col gap-2 mb-3 bg-blue-50 p-2 rounded">
                                      <label className="flex items-center gap-2 font-bold text-sm text-blue-900">
                                         <input type="checkbox" checked={stop.status === 'delivered'} onChange={(e) => handleUpdateStop({...stop, status: e.target.checked ? 'delivered' : 'pending'})} className="form-checkbox w-4 h-4 text-blue-600 rounded" />
                                         Entregado
                                      </label>
                                      {stop.status === 'delivered' && (
                                        <div className="flex flex-col gap-2 pl-6 mt-1 border-l-2 border-blue-200">
                                           <div className="flex gap-4">
                                              <label className="flex items-center gap-1 font-semibold text-gray-700">
                                                 <input type="radio" name={`payment_${stop.id}`} checked={stop.paymentMethod === 'efectivo'} onChange={() => handleUpdateStop({...stop, paymentMethod: 'efectivo'})} />
                                                 Efectivo
                                              </label>
                                              <label className="flex items-center gap-1 font-semibold text-gray-700">
                                                 <input type="radio" name={`payment_${stop.id}`} checked={stop.paymentMethod === 'firma'} onChange={() => handleUpdateStop({...stop, paymentMethod: 'firma'})} />
                                                 Firma
                                              </label>
                                           </div>
                                           <label className="flex items-center gap-2 font-semibold text-red-700 mt-2">
                                              <input type="checkbox" checked={!!stop.hasIncidents} onChange={(e) => handleUpdateStop({...stop, hasIncidents: e.target.checked, incidents: e.target.checked ? stop.incidents : ''})} className="form-checkbox" />
                                              Con Incidencias
                                              </label>
                                           {stop.hasIncidents && (
                                              <textarea value={stop.incidents || ''} onChange={(e) => handleUpdateStop({...stop, incidents: e.target.value})} placeholder="Detalles de la incidencia..." className="w-full text-xs p-2 border rounded shadow-sm outline-none mt-1 h-16"></textarea>
                                           )}
                                        </div>
                                      )}
                                   </div>

                                   <div className="flex justify-between items-center mb-2">
                                      <label className="flex items-center gap-2 font-bold text-gray-700">
                                         <input type="checkbox" checked={!!stop.userNotesActive} onChange={(e) => handleUpdateStop({...stop, userNotesActive: e.target.checked, userNotes: e.target.checked ? stop.userNotes : ''})} className="form-checkbox" />
                                         Añadir Observaciones
                                      </label>
                                   </div>
                                   {stop.userNotesActive && (
                                      <textarea value={stop.userNotes || ''} onChange={(e) => handleUpdateStop({...stop, userNotes: e.target.value})} placeholder="Escribe tus observaciones aquí..." className="w-full text-xs p-2 border rounded shadow-sm outline-none mb-3 h-16"></textarea>
                                   )}

                                   <div className="grid grid-cols-2 gap-2 mb-2 text-gray-800">
                                      <p><strong>Código:</strong> {stop.customerCode}</p>
                                      <p><strong>Horario:</strong> {stop.deliveryStart} - {stop.deliveryEnd}</p>
                                      <p><strong>Cajas:</strong> {stop.boxCount || 0}</p>
                                      <p><strong>Peso:</strong> {stop.weight || 0} kg</p>
                                   </div>
                                   
                                   <p className="mt-2 text-gray-800 font-bold">Datos Originales / Productos:</p>
                                   <div className="mt-1 text-[10px] bg-gray-100 p-2 rounded whitespace-pre-wrap overflow-auto max-h-32 font-mono">
                                     {stop.originalText || 'Sin datos extra.'}
                                   </div>
                                </div>
                             )}
                          </div>
                       ))}
                     </div>
                   );
                 })
               ) : (
                 session.stops.filter((s:any) => s.optimizedOrder).sort((a:any, b:any) => a.optimizedOrder - b.optimizedOrder).map((stop:any, idx:number) => (
                    <div key={stop.id} 
                         draggable
                         onDragStart={(e) => { e.dataTransfer.setData('text/plain', stop.id); }}
                         onDragOver={(e) => e.preventDefault()}
                         onDrop={(e) => {
                           e.preventDefault();
                           const draggedId = e.dataTransfer.getData('text/plain');
                           if (draggedId && draggedId !== stop.id) handleReorder(draggedId, stop.id);
                         }}
                         className="p-3 bg-white rounded shadow-sm border border-gray-200 flex flex-col mb-2 hover:bg-gray-50 transition cursor-grab active:cursor-grabbing">
                       <div className="flex justify-between items-center w-full" onClick={() => setActiveExpandedStop(activeExpandedStop === stop.id ? null : stop.id)}>
                         <div>
                           <div className="flex items-center gap-1">
                              <span className="font-bold text-lg text-blue-600 mr-2">{idx + 1}.</span>
                              <span className={`font-semibold ${stop.status === 'delivered' ? 'text-green-700 line-through' : 'text-gray-800'}`}>{stop.customerName}</span>
                              {stop.status === 'delivered' && <CheckCircle className="w-4 h-4 text-green-600 inline ml-1" />}
                           </div>
                           <p className="text-xs text-gray-500 mt-1">{stop.address}, {stop.city}</p>
                           <div className="flex gap-2 mt-1">
                              {!!stop.userNotesActive && <span title="Observaciones"><AlertTriangle className="w-4 h-4 text-yellow-500" /></span>}
                              {(stop.boxCount && stop.boxCount > 6) ? <span title="Volumen Alto (>6 cajas)"><Package className="w-4 h-4 text-blue-500" /></span> : null}
                              {(stop.weight && stop.weight > 30) ? <span title="Peso Alto (>30kg)"><Scale className="w-4 h-4 text-red-500" /></span> : null}
                              {!!stop.hasIncidents && <span title="Incidencias"><AlertTriangle className="w-4 h-4 text-red-600" /></span>}
                           </div>
                         </div>
                         <button onClick={(e) => { e.stopPropagation(); navigateToStop(stop); }} className="p-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 shadow">
                            <Navigation className="w-5 h-5"/>
                         </button>
                       </div>
                       {activeExpandedStop === stop.id && (
                          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600 cursor-auto" onClick={(e) => e.stopPropagation()}>
                             <div className="flex flex-col gap-2 mb-3 bg-blue-50 p-2 rounded">
                                <label className="flex items-center gap-2 font-bold text-sm text-blue-900">
                                   <input type="checkbox" checked={stop.status === 'delivered'} onChange={(e) => handleUpdateStop({...stop, status: e.target.checked ? 'delivered' : 'pending'})} className="form-checkbox w-4 h-4 text-blue-600 rounded" />
                                   Entregado
                                </label>
                                {stop.status === 'delivered' && (
                                  <div className="flex flex-col gap-2 pl-6 mt-1 border-l-2 border-blue-200">
                                     <div className="flex gap-4">
                                        <label className="flex items-center gap-1 font-semibold text-gray-700">
                                           <input type="radio" name={`payment2_${stop.id}`} checked={stop.paymentMethod === 'efectivo'} onChange={() => handleUpdateStop({...stop, paymentMethod: 'efectivo'})} />
                                           Efectivo
                                        </label>
                                        <label className="flex items-center gap-1 font-semibold text-gray-700">
                                           <input type="radio" name={`payment2_${stop.id}`} checked={stop.paymentMethod === 'firma'} onChange={() => handleUpdateStop({...stop, paymentMethod: 'firma'})} />
                                           Firma
                                        </label>
                                     </div>
                                     <label className="flex items-center gap-2 font-semibold text-red-700 mt-2">
                                        <input type="checkbox" checked={!!stop.hasIncidents} onChange={(e) => handleUpdateStop({...stop, hasIncidents: e.target.checked, incidents: e.target.checked ? stop.incidents : ''})} className="form-checkbox" />
                                        Con Incidencias
                                        </label>
                                     {stop.hasIncidents && (
                                        <textarea value={stop.incidents || ''} onChange={(e) => handleUpdateStop({...stop, incidents: e.target.value})} placeholder="Detalles de la incidencia..." className="w-full text-xs p-2 border rounded shadow-sm outline-none mt-1 h-16"></textarea>
                                     )}
                                  </div>
                                )}
                             </div>

                             <div className="flex justify-between items-center mb-2">
                                <label className="flex items-center gap-2 font-bold text-gray-700">
                                   <input type="checkbox" checked={!!stop.userNotesActive} onChange={(e) => handleUpdateStop({...stop, userNotesActive: e.target.checked, userNotes: e.target.checked ? stop.userNotes : ''})} className="form-checkbox" />
                                   Añadir Observaciones
                                </label>
                             </div>
                             {stop.userNotesActive && (
                                <textarea value={stop.userNotes || ''} onChange={(e) => handleUpdateStop({...stop, userNotes: e.target.value})} placeholder="Escribe tus observaciones aquí..." className="w-full text-xs p-2 border rounded shadow-sm outline-none mb-3 h-16"></textarea>
                             )}

                             <div className="grid grid-cols-2 gap-2 mb-2 text-gray-800">
                                <p><strong>Código:</strong> {stop.customerCode}</p>
                                <p><strong>Horario:</strong> {stop.deliveryStart} - {stop.deliveryEnd}</p>
                                <p><strong>Cajas:</strong> {stop.boxCount || 0}</p>
                                <p><strong>Peso:</strong> {stop.weight || 0} kg</p>
                             </div>
                             
                             <p className="mt-2 text-gray-800 font-bold">Datos Originales / Productos:</p>
                             <div className="mt-1 text-[10px] bg-gray-100 p-2 rounded whitespace-pre-wrap overflow-auto max-h-32 font-mono">
                               {stop.originalText || 'Sin datos extra.'}
                             </div>
                          </div>
                       )}
                    </div>
                 ))
               )}
             </div>
           </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && session && (
          <RouteStats session={session} />
        )}

        {/* DEBUG TAB */}
        {activeTab === 'debug' && (
          <div className="p-4 bg-white m-4 rounded shadow font-mono text-xs overflow-x-auto pb-20">
             <h3 className="font-bold mb-4 text-base bg-red-100 text-red-800 p-2 inline-block rounded">Raw Extraction Log</h3>
             {rawRows.length > 0 ? (
                rawRows.map((row, i) => <div key={i} className="mb-1 border-b border-gray-100 pb-1">{row}</div>)
             ) : (
                <div>No raw rows available.</div>
             )}
          </div>
        )}

      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex md:relative md:shadow-none z-20">
         <button onClick={() => setActiveTab('manager')} className={`flex-1 flex flex-col items-center py-3 text-xs ${activeTab === 'manager' ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-500 font-medium'}`}>
            <Users className="w-5 h-5 mb-1" /> Manager
         </button>
         <button onClick={() => setActiveTab('review')} className={`flex-1 flex flex-col items-center py-3 text-xs border-l border-gray-200 ${activeTab === 'review' ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-500 font-medium'}`}>
            <Edit className="w-5 h-5 mb-1" /> Review
         </button>
         <button onClick={() => setActiveTab('map')} className={`flex-1 flex flex-col items-center py-3 text-xs border-l border-gray-200 ${activeTab === 'map' ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-500 font-medium'}`}>
            <MapIcon className="w-5 h-5 mb-1" /> Map
         </button>
         <button onClick={() => setActiveTab('stats')} className={`flex-1 flex flex-col items-center py-3 text-xs border-l border-gray-200 ${activeTab === 'stats' ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-500 font-medium'}`}>
            <BarChart className="w-5 h-5 mb-1" /> Stats
         </button>
         <button onClick={() => setActiveTab('debug')} className={`flex-1 flex flex-col items-center py-3 text-xs border-l border-gray-200 ${activeTab === 'debug' ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-500 font-medium'}`}>
            <Bug className="w-5 h-5 mb-1" /> Debug
         </button>
      </nav>
    </div>
  );
}

export default App;
