"""
Walking Isochrone Generator using OSMnx

This module provides functionality to generate walking isochrone polygons
from a given point using OpenStreetMap data.
"""

import osmnx as ox
import geopandas as gpd
import networkx as nx
from shapely.geometry import Point, MultiPoint
from shapely.ops import unary_union
import pandas as pd


def get_walking_isochrones(lat: float, lon: float, intervals: list = None) -> gpd.GeoDataFrame:
    """
    Generate walking isochrone polygons for specified time intervals.
    
    This function creates polygons representing areas reachable by walking
    from a given point within specified time intervals.
    
    Parameters
    ----------
    lat : float
        Latitude of the center point
    lon : float
        Longitude of the center point
    intervals : list, optional
        Time intervals in minutes. Default is [5, 10, 15]
    
    Returns
    -------
    gpd.GeoDataFrame
        GeoDataFrame with isochrone polygons containing columns:
        - geometry: Polygon geometry
        - minutes: Walking time interval
        - area_km2: Area of the isochrone polygon in square kilometers
    
    Raises
    ------
    Exception
        If unable to fetch or process the street network
    
    Examples
    --------
    >>> isochrones = get_walking_isochrones(40.7128, -74.0060, [5, 10, 15])
    >>> print(isochrones)
    >>> isochrones.plot()
    """
    
    if intervals is None:
        intervals = [5, 10, 15]
    
    # Configuration constants
    WALKING_SPEED_MS = 1.25  # meters per second
    CENTER_LAT = lat
    CENTER_LON = lon
    
    try:
        print(f"Fetching walking network for point ({lat}, {lon})...")
        
        # Step 1: Fetch the street network for walking
        # This downloads OSM data within a radius and creates a MultiDiGraph
        # The 'walk' network type excludes motorways and highways unsuitable for pedestrians
        G = ox.graph_from_point(
            center_point=(lat, lon),
            dist=2000,  # 2km search radius
            network_type='walk',
            simplify=True,
            retain_all=False,
            truncate_by_edge=True
        )
        
        print(f"Network loaded: {len(G.nodes)} nodes, {len(G.edges)} edges")
        
        # Step 2: Add travel time to each edge
        # Travel time is calculated as: time (seconds) = distance (meters) / speed (meters/second)
        print("Calculating travel times for edges...")
        for u, v, k, data in G.edges(keys=True, data=True):
            # Get edge length in meters (OSM data is in meters)
            length = data.get('length', 0)
            
            # Calculate travel time in seconds: time = distance / speed
            # time_sec = length (meters) / WALKING_SPEED_MS (meters/second)
            travel_time_sec = length / WALKING_SPEED_MS
            
            # Convert to minutes for easier interpretation
            travel_time_min = travel_time_sec / 60
            
            # Store travel time in the edge data
            data['travel_time_sec'] = travel_time_sec
            data['travel_time_min'] = travel_time_min
        
        # Step 3: Find the closest node to the center point
        # This will be our origin for isochrone calculation
        center_point = Point(lon, lat)
        center_node = ox.distance.nearest_nodes(G, lon, lat)
        
        print(f"Origin node: {center_node}")
        
        # Step 4: Generate isochrones for each time interval
        isochrone_features = []
        
        for interval_min in intervals:
            interval_sec = interval_min * 60  # Convert minutes to seconds
            
            print(f"\nGenerating {interval_min}-minute isochrone...")
            
            # CRITICAL: Use ego_graph to extract a subgraph
            # ego_graph(G, node, radius, distance='travel_time_sec') creates a subgraph
            # that includes all nodes reachable from the center_node within the specified
            # travel time (radius). The 'distance' parameter specifies which edge attribute
            # to use for calculating distances (in this case, 'travel_time_sec').
            #
            # This essentially filters the network to only nodes/edges that can be reached
            # within the time constraint, effectively computing the reachable area.
            # The radius parameter is in the same units as the distance attribute (seconds).
            subgraph = ox.graph_core.ego_graph(
                G,
                center_node,
                radius=interval_sec,  # Radius is in seconds (travel time)
                distance='travel_time_sec'  # Use travel time as the distance metric
            )
            
            print(f"  Reachable nodes within {interval_min} min: {len(subgraph.nodes)}")
            
            # Step 5: Convert reachable nodes to geometry
            # Extract coordinates of all reachable nodes
            node_coords = []
            for node, data in subgraph.nodes(data=True):
                try:
                    y = data.get('y')
                    x = data.get('x')
                    if x is not None and y is not None:
                        node_coords.append((x, y))
                except Exception as e:
                    print(f"  Warning: Could not extract coordinates for node {node}: {e}")
                    continue
            
            if len(node_coords) < 3:
                print(f"  Warning: Not enough points ({len(node_coords)}) for polygon generation")
                continue
            
            # Step 6: Create polygon from reachable nodes
            # Use concave hull (alpha shape) for a more realistic isochrone boundary
            # Falls back to convex hull if concave hull fails
            try:
                multipoint = MultiPoint(node_coords)
                
                # Try to create a concave hull for a more realistic boundary
                # The concave hull better represents walkable areas than convex hull
                try:
                    # Concave hull with ratio parameter (0.0 = convex, 1.0 = concave)
                    polygon = multipoint.concave_hull(ratio=0.5)
                except:
                    # Fallback to convex hull if concave hull is not available
                    polygon = multipoint.convex_hull
                
                # Calculate area in square kilometers
                # The polygon is in lat/lon, so we need to convert to an appropriate projection
                polygon_gdf = gpd.GeoDataFrame(
                    [{'geometry': polygon}],
                    crs='EPSG:4326'
                )
                polygon_gdf_projected = polygon_gdf.to_crs('EPSG:3857')  # Web Mercator
                area_m2 = polygon_gdf_projected.geometry.area[0]
                area_km2 = area_m2 / 1_000_000
                
                # Create feature dictionary
                feature = {
                    'geometry': polygon,
                    'minutes': interval_min,
                    'area_km2': round(area_km2, 3),
                    'num_nodes': len(subgraph.nodes),
                    'num_edges': len(subgraph.edges)
                }
                
                isochrone_features.append(feature)
                print(f"  Isochrone created: Area={area_km2:.3f} km², Nodes={len(subgraph.nodes)}")
                
            except Exception as e:
                print(f"  Error creating polygon for {interval_min} minute isochrone: {e}")
                continue
        
        # Step 7: Create and return GeoDataFrame
        if not isochrone_features:
            raise ValueError("No valid isochrones could be generated")
        
        gdf = gpd.GeoDataFrame(isochrone_features, crs='EPSG:4326')
        
        print(f"\nIsochrone generation complete!")
        print(f"Generated {len(gdf)} isochrone polygons")
        
        return gdf
    
    except Exception as e:
        print(f"Error in get_walking_isochrones: {e}")
        raise


def get_walking_network_stats(lat: float, lon: float) -> dict:
    """
    Get statistics about the walking network around a point.
    
    Parameters
    ----------
    lat : float
        Latitude of the center point
    lon : float
        Longitude of the center point
    
    Returns
    -------
    dict
        Dictionary containing network statistics
    """
    try:
        G = ox.graph_from_point(
            center_point=(lat, lon),
            dist=2000,
            network_type='walk',
            simplify=True
        )
        
        stats = {
            'num_nodes': len(G.nodes),
            'num_edges': len(G.edges),
            'connected': nx.is_strongly_connected(G),
            'average_degree': sum(dict(G.degree()).values()) / len(G.nodes),
        }
        
        return stats
    
    except Exception as e:
        print(f"Error calculating network stats: {e}")
        return {}


# Example usage
if __name__ == '__main__':
    # Example: Generate isochrones for Manhattan, New York
    # Coordinates: 40.7128, -74.0060
    
    print("=" * 60)
    print("Walking Isochrone Generator Example")
    print("=" * 60)
    
    try:
        # Generate isochrones
        iso_gdf = get_walking_isochrones(
            lat=40.7580,  # Times Square area
            lon=-73.9855,
            intervals=[5, 10, 15]
        )
        
        # Display results
        print("\n" + "=" * 60)
        print("Results:")
        print("=" * 60)
        print(iso_gdf)
        
        # Get network statistics
        stats = get_walking_network_stats(40.7580, -73.9855)
        print("\nNetwork Statistics:")
        for key, value in stats.items():
            print(f"  {key}: {value}")
        
    except ImportError as e:
        print(f"\nMissing dependency: {e}")
        print("Install required packages with:")
        print("  pip install osmnx geopandas shapely networkx")
    except Exception as e:
        print(f"Error: {e}")
