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
  const [circularRoute, setCircularRoute] = useState(false);

  const handleUpdateStartPoint = async (address: string) => {
    if (!session) return;
    const newSession: RouteSession = {
      ...session,
      startAddress: address,
      startLat: undefined,
      startLng: undefined,
      startGeocodeStatus: 'idle'
    };
    setSession(newSession);
    await saveSessionToDB(newSession);
  };

  const handleUpdateEndPoint = async (address: string) => {
    if (!session) return;
    const newSession: RouteSession = {
      ...session,
      endAddress: address,
      endLat: undefined,
      endLng: undefined,
      endGeocodeStatus: 'idle'
    };
    setSession(newSession);
    await saveSessionToDB(newSession);
  };

  const handleGeocodeStart = async () => {
    if (!session || !session.startAddress) return;
    setLoading(true);
    const geo = await geocodeAddress(session.startAddress, 'BILBAO');
    if (geo) {
      const newSession: RouteSession = {
        ...session,
        startLat: geo.lat,
        startLng: geo.lng,
        startGeocodeStatus: 'success'
      };
      if (circularRoute) {
        newSession.endAddress = session.startAddress;
        newSession.endLat = geo.lat;
        newSession.endLng = geo.lng;
        newSession.endGeocodeStatus = 'success';
      }
      setSession(newSession);
      await saveSessionToDB(newSession);
      alert('Punto de partida geocodificado con éxito.');
    } else {
      alert('No se pudo geocodificar el punto de partida. Revisa la dirección.');
    }
    setLoading(false);
  };

  const handleGeocodeEnd = async () => {
    if (!session || !session.endAddress) return;
    setLoading(true);
    const geo = await geocodeAddress(session.endAddress, 'BILBAO');
    if (geo) {
      const newSession: RouteSession = {
        ...session,
        endLat: geo.lat,
        endLng: geo.lng,
        endGeocodeStatus: 'success'
      };
      setSession(newSession);
      await saveSessionToDB(newSession);
      alert('Punto de destino final geocodificado con éxito.');
    } else {
      alert('No se pudo geocodificar el punto de retorno. Revisa la dirección.');
    }
    setLoading(false);
  };

  const handleToggleCircularRoute = async (checked: boolean) => {
    setCircularRoute(checked);
    if (!session) return;
    
    let newSession: RouteSession = { ...session };
    if (checked) {
      newSession = {
        ...session,
        endAddress: session.startAddress,
        endLat: session.startLat,
        endLng: session.startLng,
        endGeocodeStatus: session.startGeocodeStatus
      };
    } else {
      newSession = {
        ...session,
        endAddress: '',
        endLat: undefined,
        endLng: undefined,
        endGeocodeStatus: 'idle'
      };
    }
    setSession(newSession);
    await saveSessionToDB(newSession);
  };


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
      // Pool de clientes de demostración en Bilbao para simulación de importación secuencial
      const mockStopsPool = [
        {
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
        },
        {
          id: 'mock_salesorder_124',
          customerCode: 'PED-98746',
          customerName: 'Bistro Guggenheim Bilbao',
          address: 'Avenida Abandoibarra 2',
          city: 'BILBAO',
          postalCode: '48009',
          weight: 15.5,
          boxCount: 3,
          deliveryStart: '09:00:00',
          deliveryEnd: '13:00:00'
        },
        {
          id: 'mock_salesorder_125',
          customerCode: 'PED-98747',
          customerName: 'Cafetería Gran Vía Premium',
          address: 'Gran Via 25',
          city: 'BILBAO',
          postalCode: '48001',
          weight: 8.2,
          boxCount: 2,
          deliveryStart: '08:30:00',
          deliveryEnd: '14:30:00'
        },
        {
          id: 'mock_salesorder_126',
          customerCode: 'PED-98748',
          customerName: 'Hotel Carlton Suites',
          address: 'Plaza Federico Moyúa 2',
          city: 'BILBAO',
          postalCode: '48009',
          weight: 34.0,
          boxCount: 7,
          deliveryStart: '10:00:00',
          deliveryEnd: '16:00:00'
        },
        {
          id: 'mock_salesorder_127',
          customerCode: 'PED-98749',
          customerName: 'Pescadería Ribera Logística',
          address: 'Calle Erribera s/n',
          city: 'BILBAO',
          postalCode: '48005',
          weight: 55.0,
          boxCount: 12,
          deliveryStart: '07:30:00',
          deliveryEnd: '12:00:00'
        },
        {
          id: 'mock_salesorder_128',
          customerCode: 'PED-98750',
          customerName: 'Librería Elkar Liburuak',
          address: 'Licenciado Poza 14',
          city: 'BILBAO',
          postalCode: '48008',
          weight: 12.0,
          boxCount: 4,
          deliveryStart: '09:00:00',
          deliveryEnd: '19:00:00'
        }
      ];

      // Buscar cuál de estos clientes de la demo aún no ha sido importado en la sesión actual
      let mockStop = mockStopsPool[0];
      if (session && session.stops) {
        const existingCodes = new Set(session.stops.map(s => s.customerCode));
        const available = mockStopsPool.filter(m => !existingCodes.has(m.customerCode));
        if (available.length > 0) {
          mockStop = available[0];
        } else {
          // Si todos los simulados ya existen, autogeneramos nuevos clientes únicos
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          mockStop = {
            id: `mock_salesorder_${randomSuffix}`,
            customerCode: `PED-${randomSuffix}`,
            customerName: `Café Bar Bilbao #${randomSuffix}`,
            address: `Calle Gran Vía ${Math.floor(1 + Math.random() * 85)}`,
            city: 'BILBAO',
            postalCode: '48001',
            weight: parseFloat((Math.random() * 40 + 5).toFixed(1)),
            boxCount: Math.floor(Math.random() * 8 + 1),
            deliveryStart: '08:30:00',
            deliveryEnd: '18:00:00'
          };
        }
      }
      
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

  const handleLoadDemo = async () => {
    const demoSession: RouteSession = {
       id: 'session_demo_bilbao',
       fileName: 'Ruta de Demostración - Bilbao',
       importedAt: Date.now(),
       startAddress: 'Terminal de Carga de Bilbao, Derio',
       startLat: 43.3011,
       startLng: -2.9106,
       startGeocodeStatus: 'success',
       endAddress: 'Centro de Distribución (Bilbao Centro)',
       endLat: 43.2505,
       endLng: -2.9015,
       endGeocodeStatus: 'success',
       drivers: [
          { id: '1', name: 'Conductor Principal', color: '#10B981' }
       ],
       stops: [
          {
             id: 'demo_1',
             routeGroup: 'DEMO_BILBAO',
             customerCode: 'CLI-001',
             customerName: 'Bistro Guggenheim Bilbao',
             address: 'Avenida Abandoibarra 2',
             city: 'BILBAO',
             postalCode: '48009',
             deliveryStart: '09:00:00',
             deliveryEnd: '13:00:00',
             pageNumber: 1,
             originalText: 'Demo Stop 1: Bistro Guggenheim',
             extraServiceTime: 10,
             priority: false,
             fixedFirst: false,
             fixedLast: false,
             excluded: false,
             geocodeStatus: 'success',
             lat: 43.2687,
             lng: -2.9340,
             optimizedOrder: 1,
             weight: 15.5,
             boxCount: 3,
             assignedDriverId: '1',
             status: 'pending'
          },
          {
             id: 'demo_2',
             routeGroup: 'DEMO_BILBAO',
             customerCode: 'CLI-002',
             customerName: 'Cafetería Gran Vía Premium',
             address: 'Gran Via 25',
             city: 'BILBAO',
             postalCode: '48001',
             deliveryStart: '08:30:00',
             deliveryEnd: '14:30:00',
             pageNumber: 1,
             originalText: 'Demo Stop 2: Cafetería Gran Vía',
             extraServiceTime: 5,
             priority: false,
             fixedFirst: false,
             fixedLast: false,
             excluded: false,
             geocodeStatus: 'success',
             lat: 43.2625,
             lng: -2.9315,
             optimizedOrder: 2,
             weight: 8.2,
             boxCount: 2,
             assignedDriverId: '1',
             status: 'pending'
          },
          {
             id: 'demo_3',
             routeGroup: 'DEMO_BILBAO',
             customerCode: 'CLI-003',
             customerName: 'Hotel Carlton Suites',
             address: 'Plaza Federico Moyúa 2',
             city: 'BILBAO',
             postalCode: '48009',
             deliveryStart: '10:00:00',
             deliveryEnd: '16:00:00',
             pageNumber: 1,
             originalText: 'Demo Stop 3: Hotel Carlton',
             extraServiceTime: 5,
             priority: false,
             fixedFirst: false,
             fixedLast: false,
             excluded: false,
             geocodeStatus: 'success',
             lat: 43.2629,
             lng: -2.9372,
             optimizedOrder: 3,
             weight: 34.0,
             boxCount: 7,
             assignedDriverId: '1',
             status: 'pending'
          },
          {
             id: 'demo_4',
             routeGroup: 'DEMO_BILBAO',
             customerCode: 'CLI-004',
             customerName: 'Pescadería Ribera Logística',
             address: 'Calle Erribera s/n',
             city: 'BILBAO',
             postalCode: '48005',
             deliveryStart: '07:30:00',
             deliveryEnd: '12:00:00',
             pageNumber: 1,
             originalText: 'Demo Stop 4: Mercado Ribera',
             extraServiceTime: 15,
             priority: false,
             fixedFirst: false,
             fixedLast: false,
             excluded: false,
             geocodeStatus: 'success',
             lat: 43.2568,
             lng: -2.9238,
             optimizedOrder: 4,
             weight: 55.0,
             boxCount: 12,
             assignedDriverId: '1',
             status: 'pending'
          },
          {
             id: 'demo_5',
             routeGroup: 'DEMO_BILBAO',
             customerCode: 'CLI-005',
             customerName: 'Librería Elkar Liburuak',
             address: 'Licenciado Poza 14',
             city: 'BILBAO',
             postalCode: '48008',
             deliveryStart: '09:00:00',
             deliveryEnd: '19:00:00',
             pageNumber: 1,
             originalText: 'Demo Stop 5: Librería Elkar',
             extraServiceTime: 5,
             priority: false,
             fixedFirst: false,
             fixedLast: false,
             excluded: false,
             geocodeStatus: 'success',
             lat: 43.2612,
             lng: -2.9395,
             optimizedOrder: 5,
             weight: 12.0,
             boxCount: 4,
             assignedDriverId: '1',
             status: 'pending'
          }
       ],
       status: 'optimized',
       notes: 'Ruta de demostración precargada automáticamente para evaluación del sistema.'
    };
    setSession(demoSession);
    setCircularRoute(false);
    await db.sessions.put(demoSession);
    setActiveTab('review');
    alert("¡Ruta de Demostración de Bilbao (5 clientes) cargada con éxito!");
  };

  useEffect(() => {
    // We no longer rely strictly on localStorage for the master record, 
    // but we can load the very latest session from Dexie initially.
    // If no session exists, we automatically preload our Bilbao 5-stop demo.
    const loadLast = async () => {
       let latest = await db.sessions.orderBy('importedAt').last();
       if (!latest) {
          const demoSession: RouteSession = {
             id: 'session_demo_bilbao',
             fileName: 'Ruta de Demostración - Bilbao',
             importedAt: Date.now(),
             startAddress: 'Terminal de Carga de Bilbao, Derio',
             startLat: 43.3011,
             startLng: -2.9106,
             startGeocodeStatus: 'success',
             endAddress: 'Centro de Distribución (Bilbao Centro)',
             endLat: 43.2505,
             endLng: -2.9015,
             endGeocodeStatus: 'success',
             drivers: [
                { id: '1', name: 'Conductor Principal', color: '#10B981' }
             ],
             stops: [
                {
                   id: 'demo_1',
                   routeGroup: 'DEMO_BILBAO',
                   customerCode: 'CLI-001',
                   customerName: 'Bistro Guggenheim Bilbao',
                   address: 'Avenida Abandoibarra 2',
                   city: 'BILBAO',
                   postalCode: '48009',
                   deliveryStart: '09:00:00',
                   deliveryEnd: '13:00:00',
                   pageNumber: 1,
                   originalText: 'Demo Stop 1: Bistro Guggenheim',
                   extraServiceTime: 10,
                   priority: false,
                   fixedFirst: false,
                   fixedLast: false,
                   excluded: false,
                   geocodeStatus: 'success',
                   lat: 43.2687,
                   lng: -2.9340,
                   optimizedOrder: 1,
                   weight: 15.5,
                   boxCount: 3,
                   assignedDriverId: '1',
                   status: 'pending'
                },
                {
                   id: 'demo_2',
                   routeGroup: 'DEMO_BILBAO',
                   customerCode: 'CLI-002',
                   customerName: 'Cafetería Gran Vía Premium',
                   address: 'Gran Via 25',
                   city: 'BILBAO',
                   postalCode: '48001',
                   deliveryStart: '08:30:00',
                   deliveryEnd: '14:30:00',
                   pageNumber: 1,
                   originalText: 'Demo Stop 2: Cafetería Gran Vía',
                   extraServiceTime: 5,
                   priority: false,
                   fixedFirst: false,
                   fixedLast: false,
                   excluded: false,
                   geocodeStatus: 'success',
                   lat: 43.2625,
                   lng: -2.9315,
                   optimizedOrder: 2,
                   weight: 8.2,
                   boxCount: 2,
                   assignedDriverId: '1',
                   status: 'pending'
                },
                {
                   id: 'demo_3',
                   routeGroup: 'DEMO_BILBAO',
                   customerCode: 'CLI-003',
                   customerName: 'Hotel Carlton Suites',
                   address: 'Plaza Federico Moyúa 2',
                   city: 'BILBAO',
                   postalCode: '48009',
                   deliveryStart: '10:00:00',
                   deliveryEnd: '16:00:00',
                   pageNumber: 1,
                   originalText: 'Demo Stop 3: Hotel Carlton',
                   extraServiceTime: 5,
                   priority: false,
                   fixedFirst: false,
                   fixedLast: false,
                   excluded: false,
                   geocodeStatus: 'success',
                   lat: 43.2629,
                   lng: -2.9372,
                   optimizedOrder: 3,
                   weight: 34.0,
                   boxCount: 7,
                   assignedDriverId: '1',
                   status: 'pending'
                },
                {
                   id: 'demo_4',
                   routeGroup: 'DEMO_BILBAO',
                   customerCode: 'CLI-004',
                   customerName: 'Pescadería Ribera Logística',
                   address: 'Calle Erribera s/n',
                   city: 'BILBAO',
                   postalCode: '48005',
                   deliveryStart: '07:30:00',
                   deliveryEnd: '12:00:00',
                   pageNumber: 1,
                   originalText: 'Demo Stop 4: Mercado Ribera',
                   extraServiceTime: 15,
                   priority: false,
                   fixedFirst: false,
                   fixedLast: false,
                   excluded: false,
                   geocodeStatus: 'success',
                   lat: 43.2568,
                   lng: -2.9238,
                   optimizedOrder: 4,
                   weight: 55.0,
                   boxCount: 12,
                   assignedDriverId: '1',
                   status: 'pending'
                },
                {
                   id: 'demo_5',
                   routeGroup: 'DEMO_BILBAO',
                   customerCode: 'CLI-005',
                   customerName: 'Librería Elkar Liburuak',
                   address: 'Licenciado Poza 14',
                   city: 'BILBAO',
                   postalCode: '48008',
                   deliveryStart: '09:00:00',
                   deliveryEnd: '19:00:00',
                   pageNumber: 1,
                   originalText: 'Demo Stop 5: Librería Elkar',
                   extraServiceTime: 5,
                   priority: false,
                   fixedFirst: false,
                   fixedLast: false,
                   excluded: false,
                   geocodeStatus: 'success',
                   lat: 43.2612,
                   lng: -2.9395,
                   optimizedOrder: 5,
                   weight: 12.0,
                   boxCount: 4,
                   assignedDriverId: '1',
                   status: 'pending'
                }
             ],
             status: 'optimized',
             notes: 'Ruta de demostración precargada automáticamente para evaluación del sistema.'
          };
          await db.sessions.put(demoSession);
          latest = demoSession;
       }

       if (latest) {
          setSession(latest);
          setCircularRoute(!!latest.startAddress && latest.startAddress === latest.endAddress);
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
       const startPoint = session.startLat && session.startLng
         ? { lat: session.startLat, lng: session.startLng }
         : undefined;

       const optimized = optimizeForDrivers(session.stops, session.drivers || [], startPoint);
       
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-24 md:pb-8">
      {/* PREMIUM HEADER */}
      <header className="bg-slate-900/95 backdrop-blur-md text-white px-5 py-3.5 shadow-lg border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3.5 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Navigation className="w-5 h-5 text-white animate-bounce"/>
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight flex items-center gap-2">
              Route Planner <span className="text-[9px] font-medium tracking-normal text-slate-400">v2.5</span>
            </h1>
            <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.2 rounded-md ${isExtension ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
              {isExtension ? 'Dynamics 365 Addon' : 'Cloud Standalone'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <button 
            onClick={triggerDynamicsExtraction} 
            className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-[11px] font-extrabold px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 transition-all duration-200 cursor-pointer"
            title="Importar Pedido de Venta activo de Dynamics 365"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            📥 D365 Import
          </button>
          
          {session && (
             <span className="text-[11px] font-bold bg-slate-800 border border-slate-700/60 px-3 py-2 rounded-xl text-slate-200 shadow-inner">
                {session.stops.length} Clientes ({session.stops.filter((s:any)=>s.geocodeStatus==='success').length} Geo)
             </span>
          )}
        </div>
      </header>
      
      {/* MAIN CONTAINER */}
      <main className="flex-1 overflow-y-auto w-full mx-auto md:max-w-4xl p-4 animate-fade-in">
        {loading && (
           <div className="p-4 bg-gradient-to-r from-amber-500/10 to-amber-600/5 text-amber-800 text-center text-xs font-bold rounded-2xl border border-amber-500/20 shadow-sm mb-4 flex items-center justify-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              Optimizando Secuencias y Trazados... {geocodingProgress > 0 && `${geocodingProgress}%`}
           </div>
        )}

        {activeTab === 'manager' && (
          <RouteManager onImport={handleImport} onLoadSession={handleLoadSession} onLoadDemo={handleLoadDemo} loading={loading} />
        )}

        {activeTab === 'review' && session && (
          <div className="p-0 md:p-1 space-y-5 animate-fade-in">
            
            {showScanner && (
               <OCRScanner onAddScannedStop={handleAddScannedStop} onCancel={() => setShowScanner(false)} />
            )}

            {/* PREMIUM REVIEW CONTROL BAR */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/95 backdrop-blur-md border border-slate-800 p-5 rounded-2xl shadow-lg">
               <div>
                 <h2 className="text-base font-black text-white">Revisión de Clientes</h2>
                 <p className="text-xs text-slate-400 mt-0.5">Valida las direcciones, volúmenes y prioridades del reparto</p>
               </div>
               <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                 <button onClick={() => setShowScanner(true)} className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer">
                    <Camera className="w-4 h-4" /> Escanear
                 </button>
                 <button onClick={addManualStop} className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer">
                    <Plus className="w-4 h-4" /> Añadir
                 </button>
                 <button onClick={startGeocoding} disabled={loading} className="flex-1 sm:flex-none bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer">
                    <MapIcon className="w-4 h-4" /> Geocodificar
                 </button>
                 <button onClick={handleOptimize} className="flex-1 sm:flex-none bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-extrabold shadow-lg shadow-blue-500/15 flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer">
                    <Play className="w-4 h-4 animate-pulse" /> Optimizar Ruta
                 </button>
               </div>
            </div>

            {/* CONFIGURACIÓN DE DEPÓSITO / PUNTO DE PARTIDA Y LLEGADA */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm transition hover:shadow-md">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-gradient-to-tr from-blue-500/10 to-indigo-600/10 text-blue-600 rounded-xl border border-blue-500/15">
                    <Navigation className="w-5 h-5 text-indigo-600 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm">Puntos de Origen y Retorno</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Establece la base operativa para calcular tiempos y rutas óptimas</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Origen / Inicio */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">🏠 Punto de Salida (Inicio)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej: Aeropuerto de Bilbao o Dirección..."
                      value={session.startAddress || ''}
                      onChange={(e) => handleUpdateStartPoint(e.target.value)}
                      className="flex-1 text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition shadow-sm"
                    />
                    <button
                      onClick={handleGeocodeStart}
                      disabled={loading || !session.startAddress}
                      className="px-4 py-2.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      📍 Geo
                    </button>
                  </div>
                  {session.startLat && session.startLng ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Localizado: {session.startLat.toFixed(4)}, {session.startLng.toFixed(4)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      Falta geocodificar origen
                    </span>
                  )}
                </div>

                {/* Destino / Retorno */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">🏁 Punto de Llegada (Retorno)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej: Almacén central o Dirección..."
                      value={session.endAddress || ''}
                      disabled={!!circularRoute}
                      onChange={(e) => handleUpdateEndPoint(e.target.value)}
                      className="flex-1 text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
                    />
                    <button
                      onClick={handleGeocodeEnd}
                      disabled={loading || !session.endAddress || circularRoute}
                      className="px-4 py-2.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      📍 Geo
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!circularRoute}
                        onChange={(e) => handleToggleCircularRoute(e.target.checked)}
                        className="form-checkbox w-4 h-4 text-blue-600 rounded-lg border-slate-350 focus:ring-blue-500/40 focus:ring-2"
                      />
                      Ruta Circular (Mismo punto)
                    </label>
                    {!circularRoute && (
                      session.endLat && session.endLng ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                          Listo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                          Pendiente
                        </span>
                      )
                    )}
                  </div>
                </div>
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
             <RouteMap 
               stops={session.stops} 
               onMarkerClick={navigateToStop} 
               drivers={session.drivers}
               startPoint={session.startLat && session.startLng ? { lat: session.startLat, lng: session.startLng, address: session.startAddress || '' } : null}
               endPoint={session.endLat && session.endLng ? { lat: session.endLat, lng: session.endLng, address: session.endAddress || '' } : null}
             />
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

      {/* FLOATING BOTTOM NAVIGATION DOCK */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[92%] max-w-lg bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] px-3 py-2 z-30 flex items-center justify-between gap-1">
         <button 
           onClick={() => setActiveTab('manager')} 
           className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl text-[10px] tracking-wide transition-all duration-205 cursor-pointer ${activeTab === 'manager' ? 'bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-extrabold shadow-lg shadow-blue-500/20 scale-105' : 'text-slate-400 hover:text-slate-200 font-bold'}`}
         >
            <Users className={`w-4 h-4 mb-1 ${activeTab === 'manager' ? 'animate-pulse' : ''}`} />
            <span>Inicio</span>
         </button>
         <button 
           onClick={() => setActiveTab('review')} 
           className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl text-[10px] tracking-wide transition-all duration-205 cursor-pointer ${activeTab === 'review' ? 'bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-extrabold shadow-lg shadow-blue-500/20 scale-105' : 'text-slate-400 hover:text-slate-200 font-bold'}`}
         >
            <Edit className="w-4 h-4 mb-1" />
            <span>Revisar</span>
         </button>
         <button 
           onClick={() => setActiveTab('map')} 
           className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl text-[10px] tracking-wide transition-all duration-205 cursor-pointer ${activeTab === 'map' ? 'bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-extrabold shadow-lg shadow-blue-500/20 scale-105' : 'text-slate-400 hover:text-slate-200 font-bold'}`}
         >
            <MapIcon className="w-4 h-4 mb-1" />
            <span>Mapa</span>
         </button>
         <button 
           onClick={() => setActiveTab('stats')} 
           className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl text-[10px] tracking-wide transition-all duration-205 cursor-pointer ${activeTab === 'stats' ? 'bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-extrabold shadow-lg shadow-blue-500/20 scale-105' : 'text-slate-400 hover:text-slate-200 font-bold'}`}
         >
            <BarChart className="w-4 h-4 mb-1" />
            <span>Métricas</span>
         </button>
         <button 
           onClick={() => setActiveTab('debug')} 
           className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl text-[10px] tracking-wide transition-all duration-205 cursor-pointer ${activeTab === 'debug' ? 'bg-gradient-to-tr from-rose-500 to-red-600 text-white font-extrabold shadow-lg shadow-red-500/20 scale-105' : 'text-slate-450 hover:text-rose-450 font-bold'}`}
         >
            <Bug className="w-4 h-4 mb-1" />
            <span>Logs</span>
         </button>
      </div>
    </div>
  );
}

export default App;
