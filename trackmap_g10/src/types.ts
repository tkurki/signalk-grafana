import { TileLayerProps } from 'react-leaflet';

export interface TrackMapOptions {
  trackColor: string;
  pointColor: string;
  layers: TileLayerProps[];
}

// export const defaults: TrackMapOptions = {
//   trackColor: '#0000ff',
//   pointColor: '#ff0000',
//   layers: [
//     {
//       url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
//       minZoom: 0,
//       maxNativeZoom: 20,
//       maxZoom: 20,
//       subdomains: ['a', 'b', 'c'],
//     },
//     {
//       url: 'http://{s}.google.com/vt/lyrs=s&x: x}&y: y}&z: z}',
//       minZoom: 1,
//       maxNativeZoom: 20,
//       maxZoom: 21,
//       subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
//     },
//     {
//       url: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
//       minZoom: 16,
//       maxZoom: 21,
//       maxNativeZoom: 18,
//       subdomains: [],
//     },
//   ],
// };

