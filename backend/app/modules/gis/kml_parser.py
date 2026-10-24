import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any

def parse_kml_coordinates(kml_content: str) -> Optional[List[List[float]]]:
    """
    Extract [longitude, latitude] coordinate pairs from a KML file string.
    Returns list of [lon, lat] rings for a GeoJSON Polygon.
    """
    try:
        # Match <coordinates>...</coordinates>
        match = re.search(r"<coordinates>(.*?)</coordinates>", kml_content, re.DOTALL)
        if not match:
            return None
            
        coord_text = match.group(1).strip()
        points = []
        for token in coord_text.split():
            parts = token.strip().split(",")
            if len(parts) >= 2:
                lon = float(parts[0])
                lat = float(parts[1])
                points.append([lon, lat])
                
        # Polygon ring must be closed
        if points and points[0] != points[-1]:
            points.append(points[0])
            
        return points
    except Exception:
        return None

def parse_kml_file(file_path: Path | str) -> Optional[Dict[str, Any]]:
    path = Path(file_path)
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
        
    ring = parse_kml_coordinates(content)
    if not ring:
        return None
        
    return {
        "type": "Polygon",
        "coordinates": [ring]
    }
