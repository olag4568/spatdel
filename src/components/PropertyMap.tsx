"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";

export type MappedProperty = {
  id: string;
  title: string;
  price: string;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  image?: string | null;
};

const IJEGUN_CENTER: [number, number] = [6.5244, 3.2696];

const houseIcon = L.divIcon({
  className: "",
  html: '<div style="width:30px;height:30px;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#f05a00;box-shadow:0 2px 8px #102f4666;display:flex;align-items:center;justify-content:center"><span style="color:white;font-size:13px;transform:rotate(45deg)">⌂</span></div>',
  iconSize: [30, 36],
  iconAnchor: [15, 36],
});

type LeafletContainerElement = HTMLElement & { _leaflet_id?: number };

/**
 * Leaflet stores an internal ID on its map element. If a route transition or
 * React development remount interrupts map teardown, clear that stale marker
 * when this map wrapper unmounts so a later MapContainer can initialize.
 */
function useLeafletContainerCleanup() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;

    return () => {
      const containers = wrapper?.querySelectorAll(".leaflet-container");
      containers?.forEach((element) => {
        const container = element as LeafletContainerElement;
        if (container._leaflet_id !== undefined) {
          delete container._leaflet_id;
        }
      });
    };
  }, []);

  return wrapperRef;
}

function PinClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

export function PropertyLocationPicker({
  latitude,
  longitude,
  onPick,
}: {
  latitude: number | null;
  longitude: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const selectedPosition: [number, number] | null =
    latitude !== null && longitude !== null ? [latitude, longitude] : null;
  const wrapperRef = useLeafletContainerCleanup();

  return (
    <div ref={wrapperRef} className="relative z-0 isolate overflow-hidden rounded-xl border border-[#d5dde2]">
      <MapContainer center={selectedPosition ?? IJEGUN_CENTER} zoom={15} scrollWheelZoom className="relative z-0 h-[300px] w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <PinClickHandler onPick={onPick} />
        {selectedPosition && <Marker position={selectedPosition} icon={houseIcon}><Popup>Property pin location</Popup></Marker>}
      </MapContainer>
      <p className="bg-[#f8f7f2] px-3 py-2 text-xs text-[#52636d]">Tap the map at the exact house location to place its pin.</p>
    </div>
  );
}

export default function PropertyMap({ properties }: { properties: MappedProperty[] }) {
  const wrapperRef = useLeafletContainerCleanup();
  const mappedProperties = useMemo(
    () => properties.filter((property) =>
      typeof property.latitude === "number" &&
      typeof property.longitude === "number" &&
      Number.isFinite(property.latitude) &&
      Number.isFinite(property.longitude)
    ),
    [properties]
  );

  return (
    <div ref={wrapperRef} className="relative z-0 isolate overflow-hidden rounded-2xl border border-[#102f46]/10 shadow-2xl">
      <MapContainer center={IJEGUN_CENTER} zoom={14} scrollWheelZoom className="relative z-0 h-[430px] w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mappedProperties.map((property) => (
          <Marker
            key={property.id}
            position={[property.latitude as number, property.longitude as number]}
            icon={houseIcon}
          >
            <Popup>
              <div style={{ minWidth: 170, maxWidth: 220 }}>
                {property.image && <img src={property.image} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 6, marginBottom: 8 }} />}
                <strong>{property.title}</strong>
                <p style={{ margin: "5px 0", fontWeight: 700, color: "#087b62" }}>{property.price}</p>
                <p style={{ margin: 0, fontSize: 12 }}>{property.location}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="flex items-center justify-between gap-3 border-t border-[#102f46]/10 bg-white px-4 py-3">
        <span className="text-xs font-bold text-[#102f46]">Ijegun Community Road, Lagos</span>
        <span className="text-[10px] text-[#71808a]">{mappedProperties.length} mapped {mappedProperties.length === 1 ? "property" : "properties"}</span>
      </div>
      {mappedProperties.length === 0 && (
        <p className="bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          No approved listings have map pins yet. Agents and landlords must pin each house location when submitting a property.
        </p>
      )}
    </div>
  );
}
