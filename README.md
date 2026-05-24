# Route Planner App - Android MVP

A field-ready delivery route planner for drivers designed to parse logistics route sheets directly from PDF on Android devices without relying on complex backend processing. Built with React (TypeScript), Tailwind, Leaflet, and Capacitor.

## What is Functional Now
- **PDF Import**: Loads the PDF (`Hoja expedición.pdf`) using `pdfjs-dist` inside the context of the device browser and extracts the structured row data correctly using proximity heuristics.
- **Data Extractor**: Extracts customer names, codes, addresses, cities, and time windows while properly detecting the main components of the provided format. Discards headers, totals, signatures.
- **Review & Edit Screen**: Fully functioning UI designed for driver usage with large touch targets. Can:
   - Edit time windows, address, city, and name.
   - Set fixed first/last priorities.
   - Exclude specific stops from the route entirely.
   - Manually delete rows or fix mistakes.
- **Geocoding Tool (Nominatim Fallback)**: Geocodes addresses using OpenStreetMap's free REST API Nominatim. This allows the MVP to work offline-ish/without keys.
- **Route Optimization**: Nearest neighbor (TSP-like) heuristic optimization calculating haversine distance. Sorts stops properly considering who goes first, etc.
- **Map View & Handoff**: Displays a clean map with all markers, colored routing paths, and allows handing off directly to Google Maps using the `google.navigation:q=lat,lng` intent URI required by Android.
- **Local Persistence**: Saves all imported progress into `localStorage` so if the app is closed, you can re-open it to the same route state instantly.

## Simplifications & Pending Roadmap
- **Simplifications**:
  - The geocoder uses the free OpenStreetMap (Nominatim) instance which is rate limited. Geocoding one by one has artificial delays to avoid bans. Once an API key is introduced (e.g. Google Maps), it could be instantaneous.
  - The optimization uses a simple Nearest Neighbor algorithm which is extremely fast and effective for single routes but doesn't calculate real-world traffic or exact road distances.
- **Pending**:
  - Offline Map Tiles Support.
  - Integration with multi-vehicle logistics optimization solvers like VRP engines.
  - Picture/Signature Proof of Delivery functionalities.
  - Advanced PDF heuristics if a radically different layout is uploaded.
  
## How to Test
1. Transfer `route-planner-app.apk` to an Android device or Emulator.
2. Install and launch "Route Planner".
3. Tap "Import Route Sheet" and select the provided `Hoja expedición.pdf`.
4. Check the extracted rows. Look at the Review view to see all information.
5. Tap "Geocode" to retrieve coordinates for the addresses (takes a bit due to rate limit precautions).
6. Tap "Optimize" to arrange your route.
7. Navigate to the generated list, tap on any location, and watch it hand off to Google Maps navigation!
