import { useEffect } from "react";
import { formatEther } from "viem";
import { useProperties } from "../hooks/useProperties";
import { useIpfsMetadata } from "../hooks/useIpfsMetadata";
import { ipfsToHttpUrl } from "../lib/ipfs";
import { BuyForm } from "../components/BuyForm";

const STATUS_LABEL: Record<number, string> = {
  0: "Listed",
  1: "Sold out",
  2: "Delisted",
};

export function PropertyDetail({
  propertyId,
  onBack,
}: {
  propertyId: number;
  onBack: () => void;
}) {
  const { properties, isLoading, refetch } = useProperties();
  const property = properties.find((p) => p.id === propertyId);
  const { data: meta } = useIpfsMetadata(property?.metadataURI);

  useEffect(() => {
    refetch();
  }, []);

  if (isLoading || !property) return <p className="state">Loading…</p>;

  const remaining = property.totalShares - property.sharesSold;
  const percentSold =
    property.totalShares > 0 ? (property.sharesSold / property.totalShares) * 100 : 0;

  return (
    <article className="property-detail">
      <button className="back-btn" onClick={onBack}>
        ← Back to catalogue
      </button>

      <div className="detail-hero">
        {meta?.imageURI ? (
          <img src={ipfsToHttpUrl(meta.imageURI)} alt={meta.name} />
        ) : (
          <div className="image-placeholder">No image</div>
        )}
      </div>

      <header className="detail-header">
        <div>
          <h1>{meta?.name ?? `Property #${property.id}`}</h1>
          <p className="muted">
            {meta?.location ? `${meta.location.city}, ${meta.location.country}` : property.metadataURI}
            {" · "}
            <span className={`status status-${property.status}`}>
              {STATUS_LABEL[property.status]}
            </span>
          </p>
        </div>
        <div className="price-big">
          {formatEther(property.pricePerShare)} <span>rUSD/share</span>
        </div>
      </header>

      {meta?.description && <p className="description">{meta.description}</p>}

      <div className="stats-grid">
        <Stat label="Total shares" value={property.totalShares.toLocaleString()} />
        <Stat label="Sold" value={property.sharesSold.toLocaleString()} />
        <Stat label="Available" value={remaining.toLocaleString()} />
        <Stat label="Year built" value={meta?.yearBuilt ? String(meta.yearBuilt) : "—"} />
        <Stat label="Area" value={meta?.areaSqM ? `${meta.areaSqM} m²` : "—"} />
        <Stat label="Type" value={meta?.type ?? "—"} />
      </div>

      <div className="progress detail-progress">
        <div className="bar" style={{ width: `${percentSold}%` }} />
      </div>

      <BuyForm property={property} onSuccess={refetch} />
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
    </div>
  );
}
