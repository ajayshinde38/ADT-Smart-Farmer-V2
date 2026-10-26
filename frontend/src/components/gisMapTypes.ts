export interface InteractiveGISMapProps {
  overlayVisible?: boolean;
  coordinates: number[][];
  geojson?: any;
  farmerName: string;
  farmId?: string;
  areaAcres?: number;
  latitude?: number;
  longitude?: number;
  activeIndex: string;
  indexValue?: number | null;
  captureDate?: string | null;
  language?: 'en' | 'mr';
  rasterInfo?: {
    is_available: boolean;
    scene_id?: string;
    acquisition_date?: string;
    resolution_meters?: number;
    bounds?: number[][];
    overlay_urls?: Record<string,string>;
  } | null;
  mode?: 'A' | 'B';
  mapHeight?: number;
  onToggleMode?: (mode:'A'|'B')=>void;
  access?:'farmer'|'admin';
  authorizationToken?:string;
}

export const hasRasterForIndex = ({rasterInfo,activeIndex}: Pick<InteractiveGISMapProps,'rasterInfo'|'activeIndex'>) => {
  const bounds=rasterInfo?.bounds;
  return Boolean(rasterInfo?.is_available && rasterInfo.acquisition_date &&
    bounds?.length===2 && bounds.every(point=>point.length===2&&point.every(Number.isFinite)) &&
    bounds[0][0]<bounds[1][0] && bounds[0][1]<bounds[1][1] && rasterInfo.overlay_urls?.[activeIndex.toLowerCase()]);
};
