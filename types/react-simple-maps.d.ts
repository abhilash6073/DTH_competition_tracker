declare module "react-simple-maps" {
  import * as React from "react";

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: {
      center?: [number, number];
      scale?: number;
      rotate?: [number, number, number];
      parallels?: [number, number];
    };
    width?: number;
    height?: number;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }

  export const ComposableMap: React.FC<ComposableMapProps>;

  export interface GeographiesProps {
    geography: unknown;
    children: (props: { geographies: GeoFeature[] }) => React.ReactNode;
  }

  export interface GeoFeature {
    rsmKey: string;
    properties: Record<string, string>;
    geometry: unknown;
  }

  export const Geographies: React.FC<GeographiesProps>;

  export interface GeographyProps {
    geography: GeoFeature;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: {
      default?: React.CSSProperties;
      hover?: React.CSSProperties;
      pressed?: React.CSSProperties;
    };
    className?: string;
    onMouseEnter?: (evt: React.MouseEvent) => void;
    onMouseMove?: (evt: React.MouseEvent) => void;
    onMouseLeave?: (evt: React.MouseEvent) => void;
    onClick?: (evt: React.MouseEvent) => void;
  }

  export const Geography: React.FC<GeographyProps>;

  export interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    children?: React.ReactNode;
  }

  export const ZoomableGroup: React.FC<ZoomableGroupProps>;
}
