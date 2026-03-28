import { POILayerState } from '../components/MapPOILayers';

export interface POIMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  type: 'fuel' | 'camera' | 'accommodation' | 'restaurant' | 'parking';
}

// Fetch POI data from Overpass API (OpenStreetMap)
export async function fetchPOIData(
  bounds: { north: number; south: number; east: number; west: number },
  poiLayers: POILayerState
): Promise<POIMarker[]> {
  try {
    const pois: POIMarker[] = [];
    const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;

    console.log('Fetching POIs for bounds:', bbox);

    // Build individual queries for each POI type to avoid timeouts
    const typeQueries = [];

    if (poiLayers.fuelStations) {
      typeQueries.push({ name: 'fuel', query: `node["amenity"="fuel"](${bbox});` });
    }
    if (poiLayers.speedCameras) {
      typeQueries.push({ name: 'camera', query: `(node["highway"="speed_camera"](${bbox});way["highway"="speed_camera"](${bbox}););` });
    }
    if (poiLayers.accommodations) {
      typeQueries.push({ name: 'accommodation', query: `node["tourism"="hotel"](${bbox});` });
    }
    if (poiLayers.restaurants) {
      typeQueries.push({ name: 'restaurant', query: `node["amenity"="restaurant"](${bbox});` });
    }
    if (poiLayers.parkingAreas) {
      typeQueries.push({ name: 'parking', query: `node["amenity"="parking"](${bbox});` });
    }

    if (typeQueries.length === 0) {
      return pois;
    }

    // Fetch each type separately for better reliability
    for (const { name, query } of typeQueries) {
      try {
        const overpassQuery = `
          [out:json][timeout:8];
          (
            ${query}
          );
          out center;
        `;

        console.log(`Fetching ${name}...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: overpassQuery,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`Overpass API error for ${name}:`, response.status);
          continue;
        }

        const data = await response.json();

        if (!data.elements || data.elements.length === 0) {
          console.log(`No ${name} found`);
          continue;
        }

        console.log(`Found ${data.elements.length} ${name}s`);

        // Parse elements
        data.elements.forEach((element: any) => {
          const lat = element.center?.lat || element.lat;
          const lon = element.center?.lon || element.lon;

          if (!lat || !lon) return;

          const tags = element.tags || {};
          let displayName = tags.name || `${name} ${pois.length}`;

          pois.push({
            id: `${name}-${pois.length}`,
            lat,
            lng: lon,
            name: displayName,
            type: name as 'fuel' | 'camera' | 'accommodation' | 'restaurant' | 'parking',
          });
        });
      } catch (error) {
        console.warn(`Failed to fetch ${name}:`, error instanceof Error ? error.message : error);
        continue;
      }
    }

    console.log(`Total POIs fetched: ${pois.length}`);
    return pois;
  } catch (error) {
    console.error('Failed to fetch POI data:', error);
    return [];
  }
}

const TYPE_FILTERS: Record<POIMarker['type'], string> = {
  fuel: 'node["amenity"="fuel"]',
  camera: 'node["highway"="speed_camera"]',
  accommodation: 'node["tourism"="hotel"]',
  restaurant: 'node["amenity"="restaurant"]',
  parking: 'node["amenity"="parking"]',
};

const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

let serverRotation = 0;

// Compute route bbox string
export function getRouteBbox(routeCoordinates: [number, number][]): string {
  let south = 90, north = -90, west = 180, east = -180;
  for (const [lat, lng] of routeCoordinates) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
  }
  const pad = 0.02;
  return `${south - pad},${west - pad},${north + pad},${east + pad}`;
}

// Fetch from a specific Overpass server, returns null on failure
async function queryOverpass(
  query: string,
  serverIndex: number,
  signal?: AbortSignal
): Promise<any[] | null> {
  if (signal?.aborted) return null;
  const server = OVERPASS_SERVERS[serverIndex % OVERPASS_SERVERS.length];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  if (signal && !signal.aborted) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(server, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 429) {
      console.warn(`Overpass 429 from ${server.split('//')[1].split('/')[0]}`);
      return { __rateLimit: true } as any;
    }
    if (!response.ok) {
      console.warn(`Overpass ${response.status} from ${server.split('//')[1].split('/')[0]}`);
      return null;
    }

    const data = await response.json();
    return data.elements || [];
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    console.warn(`Overpass fetch error from ${server.split('//')[1].split('/')[0]}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

// Determine POI type from OSM tags
function typeFromTags(tags: Record<string, string>): POIMarker['type'] | null {
  if (tags.amenity === 'fuel') return 'fuel';
  if (tags.highway === 'speed_camera') return 'camera';
  if (tags.tourism === 'hotel') return 'accommodation';
  if (tags.amenity === 'restaurant') return 'restaurant';
  if (tags.amenity === 'parking') return 'parking';
  return null;
}

// Fetch multiple POI types in a SINGLE Overpass query — minimises requests to avoid 429s
export async function fetchPOITypes(
  types: POIMarker['type'][],
  bbox: string,
  signal?: AbortSignal
): Promise<POIMarker[]> {
  if (types.length === 0) return [];
  const [south, west, north, east] = bbox.split(',').map(Number);

  // Split bbox into chunks of ~2° latitude for reliability
  const bboxParts: string[] = [];
  const latSpan = north - south;
  if (latSpan > 2) {
    const numParts = Math.ceil(latSpan / 2);
    const step = latSpan / numParts;
    for (let i = 0; i < numParts; i++) {
      bboxParts.push(`${south + i * step},${west},${south + (i + 1) * step},${east}`);
    }
  } else {
    bboxParts.push(bbox);
  }

  const allPois: POIMarker[] = [];
  const seenIds = new Set<string>();

  for (let p = 0; p < bboxParts.length; p++) {
    if (signal?.aborted) return allPois;

    const filterLines = types.map(t => `${TYPE_FILTERS[t]}(${bboxParts[p]});`).join('\n');
    const query = `[out:json][timeout:25];(\n${filterLines}\n);out;`;

    // Try servers with failover
    let elements: any[] | null = null;
    for (let s = 0; s < OVERPASS_SERVERS.length; s++) {
      if (signal?.aborted) return allPois;
      const result = await queryOverpass(query, serverRotation + s, signal).catch(() => null);
      if (result && (result as any).__rateLimit) {
        if (s < OVERPASS_SERVERS.length - 1) {
          await new Promise(r => setTimeout(r, 5000));
        }
        continue;
      }
      if (result !== null) {
        elements = result;
        serverRotation = (serverRotation + s) % OVERPASS_SERVERS.length;
        break;
      }
      if (s < OVERPASS_SERVERS.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (elements) {
      for (const el of elements) {
        if (!el.lat || !el.lon || !el.tags) continue;
        const type = typeFromTags(el.tags);
        if (!type || !types.includes(type)) continue;
        const id = `${type}-${el.id}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        allPois.push({
          id,
          lat: el.lat,
          lng: el.lon,
          name: el.tags.name || type,
          type,
        });
      }
    }

    // Delay between bbox parts
    if (p < bboxParts.length - 1 && !signal?.aborted) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  const counts = types.map(t => `${t}: ${allPois.filter(p => p.type === t).length}`).join(', ');
  console.log(`POIs fetched — ${counts}`);
  return allPois;
}
