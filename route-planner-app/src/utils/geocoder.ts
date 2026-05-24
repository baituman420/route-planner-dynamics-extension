export async function geocodeAddress(address: string, city: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // Simple fallback using Nominatim (OpenStreetMap) if no Google Maps API is provided
    const q = `${encodeURIComponent(address)}, ${encodeURIComponent(city)}`;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`, {
      headers: {
        'Accept-Language': 'es'
      }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.warn('Geocoding failed for', address, city, error);
    return null;
  }
}

// Haversine distance in km
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

// Simple nearest neighbor optimization
import type { DeliveryStop, Driver } from '../types';

// Simple kmeans clustering for geographic grouping
export function kMeansClustering(stops: DeliveryStop[], numClusters: number): Map<number, DeliveryStop[]> {
  const validStops = stops.filter(s => s.lat && s.lng);
  if (numClusters <= 1) {
    const map = new Map<number, DeliveryStop[]>();
    map.set(0, stops); // all in cluster 0
    return map;
  }
  if (validStops.length <= numClusters) {
    const map = new Map<number, DeliveryStop[]>();
    // If we have few valid stops, distribute them somewhat evenly
    for (let i = 0; i < stops.length; i++) {
       const clusterIdx = stops[i].lat ? (i % numClusters) : 0;
       if (!map.has(clusterIdx)) map.set(clusterIdx, []);
       map.get(clusterIdx)!.push(stops[i]);
    }
    for (let i = 0; i < numClusters; i++) {
        if (!map.has(i)) map.set(i, []);
    }
    return map;
  }
  
  // Initialize centroids using K-means++
  let centroids: {lat: number, lng: number}[] = [];
  centroids.push({ lat: validStops[0].lat!, lng: validStops[0].lng! });
  
  for(let i=1; i<numClusters; i++) {
    let maxDist = -1;
    let furthest = validStops[0];
    for(const stop of validStops) {
      let minDistToCentroids = Infinity;
      for(const c of centroids) {
        const d = getDistance(stop.lat!, stop.lng!, c.lat, c.lng);
        if(d < minDistToCentroids) minDistToCentroids = d;
      }
      if(minDistToCentroids > maxDist) {
        maxDist = minDistToCentroids;
        furthest = stop;
      }
    }
    centroids.push({ lat: furthest.lat!, lng: furthest.lng! });
  }
  
  let clusters = new Map<number, DeliveryStop[]>();
  let hasChanged = true;
  let iterations = 0;
  
  while(hasChanged && iterations < 50) {
    hasChanged = false;
    clusters.clear();
    for(let i=0; i<numClusters; i++) clusters.set(i, []);
    
    // Assign stops
    for(const stop of stops) {
      if(!stop.lat || !stop.lng) {
        // Find cluster that has the least amount of stops to balance out
        let minCluster = 0;
        let minStops = Infinity;
        for(let i=0; i<numClusters; i++) {
           let count = clusters.get(i)?.length || 0;
           if(count < minStops) { minStops = count; minCluster = i; }
        }
        clusters.get(minCluster)?.push(stop);
        continue;
      }
      let minDist = Infinity;
      let closestCentroid = 0;
      for(let i=0; i<numClusters; i++) {
        const d = getDistance(stop.lat, stop.lng, centroids[i].lat, centroids[i].lng);
        if(d < minDist) {
          minDist = d;
          closestCentroid = i;
        }
      }
      clusters.get(closestCentroid)?.push(stop);
    }
    
    // Update centroids
    for(let i=0; i<numClusters; i++) {
      const clusterStops = clusters.get(i) || [];
      if(clusterStops.length > 0) {
        const sumLat = clusterStops.reduce((acc, s) => acc + (s.lat || 0), 0);
        const sumLng = clusterStops.reduce((acc, s) => acc + (s.lng || 0), 0);
        const newLat = sumLat / clusterStops.length;
        const newLng = sumLng / clusterStops.length;
        if(Math.abs(centroids[i].lat - newLat) > 0.0001 || Math.abs(centroids[i].lng - newLng) > 0.0001) {
          hasChanged = true;
          centroids[i] = { lat: newLat, lng: newLng };
        }
      }
    }
    iterations++;
  }
  return clusters;
}


export function optimizeRoute(stops: DeliveryStop[], startPoint?: { lat: number, lng: number }): DeliveryStop[] {
  const unvisited = stops.filter(s => s.geocodeStatus === 'success' && !s.excluded && s.lat && s.lng);
  const optimized: DeliveryStop[] = [];
  
  if (unvisited.length === 0) return [];

  // Handle fixed first stop
  let currentPos = startPoint || { lat: unvisited[0].lat!, lng: unvisited[0].lng! };
  const fixedFirstIndex = unvisited.findIndex(s => s.fixedFirst);
  
  if (fixedFirstIndex > -1) {
    const first = unvisited.splice(fixedFirstIndex, 1)[0];
    optimized.push(first);
    currentPos = { lat: first.lat!, lng: first.lng! };
  } else if (!startPoint) {
    const first = unvisited.shift()!;
    optimized.push(first);
    currentPos = { lat: first.lat!, lng: first.lng! };
  }

  while (unvisited.length > 0) {
    // Only looking at normal stops, save fixedLast for end
    const available = unvisited.filter(s => !s.fixedLast);
    const pool = available.length > 0 ? available : unvisited; // if only fixedLast remaining
    
    let nearestIdx = 0;
    let minDist = Infinity;
    
    for (let i = 0; i < pool.length; i++) {
      const dist = getDistance(currentPos.lat, currentPos.lng, pool[i].lat!, pool[i].lng!);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }
    
    // Find index in original unvisited array
    const actualIdx = unvisited.findIndex(s => s.id === pool[nearestIdx].id);
    const stop = unvisited.splice(actualIdx, 1)[0];
    
    stop.distanceFromPrevious = minDist;
    // rough estimate: 30 km/h in city -> 0.5 km/min
    stop.durationFromPrevious = minDist / 0.5; 
    
    optimized.push(stop);
    currentPos = { lat: stop.lat!, lng: stop.lng! };
  }
  
  return optimized.map((s, idx) => ({ ...s, optimizedOrder: idx + 1 }));
}

export function optimizeForDrivers(stops: DeliveryStop[], drivers: Driver[]): DeliveryStop[] {
  if (!drivers || drivers.length <= 1) {
    const optimized = optimizeRoute(stops);
    if(drivers && drivers.length === 1) {
       return optimized.map(s => ({...s, assignedDriverId: drivers[0].id}));
    }
    return optimized;
  }
  
  const clusters = kMeansClustering(stops, drivers.length);
  const result: DeliveryStop[] = [];
  
  for(let i = 0; i < drivers.length; i++) {
    const clusterStops = clusters.get(i) || [];
    const optimizedCluster = optimizeRoute(clusterStops);
    // assign driver id
    optimizedCluster.forEach(s => {
      s.assignedDriverId = drivers[i].id;
      result.push(s);
    });
  }
  
  return result;
}
