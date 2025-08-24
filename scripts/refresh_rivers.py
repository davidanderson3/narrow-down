import os
import json
import geopandas as gpd
import requests

BASE_DIR = os.path.join(os.path.dirname(__file__), '..', 'geolayers-game', 'public', 'data')
RIVERS50_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson'
RIVERS10_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson'

geojson50_path = os.path.join(os.path.dirname(__file__), 'ne_50m_rivers_lake_centerlines.geojson')
if not os.path.exists(geojson50_path):
    r = requests.get(RIVERS50_URL)
    r.raise_for_status()
    with open(geojson50_path, 'wb') as f:
        f.write(r.content)

rivers50 = gpd.read_file(geojson50_path).to_crs(4326)

for country in os.listdir(BASE_DIR):
    country_dir = os.path.join(BASE_DIR, country)
    outline_path = os.path.join(country_dir, 'outline.geojson')
    rivers_path = os.path.join(country_dir, 'rivers.geojson')
    if not os.path.isfile(outline_path) or not os.path.isdir(country_dir):
        continue
    outline = gpd.read_file(outline_path).to_crs(4326)
    clipped = gpd.clip(rivers50, outline)
    if len(clipped) == 0:
        continue
    clipped.to_file(rivers_path, driver='GeoJSON')

# ensure South Korea has higher resolution rivers if empty
kor_dir = os.path.join(BASE_DIR, 'KOR')
kor_rivers = os.path.join(kor_dir, 'rivers.geojson')
if os.path.isdir(kor_dir) and os.path.isfile(kor_rivers):
    data = json.load(open(kor_rivers))
    if len(data.get('features', [])) == 0:
        geojson10_path = os.path.join(os.path.dirname(__file__), 'ne_10m_rivers_lake_centerlines.geojson')
        if not os.path.exists(geojson10_path):
            r = requests.get(RIVERS10_URL)
            r.raise_for_status()
            with open(geojson10_path, 'wb') as f:
                f.write(r.content)
        rivers10 = gpd.read_file(geojson10_path).to_crs(4326)
        outline = gpd.read_file(os.path.join(kor_dir, 'outline.geojson')).to_crs(4326)
        clipped = gpd.clip(rivers10, outline)
        if len(clipped) > 0:
            clipped.to_file(kor_rivers, driver='GeoJSON')
