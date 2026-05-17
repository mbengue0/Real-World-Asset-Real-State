import { formatEther } from "viem";
import { useIpfsMetadata } from "../hooks/useIpfsMetadata";
import { ipfsToHttpUrl } from "../lib/ipfs";
import type { OnChainProperty } from "../hooks/useProperties";

const STATUS_LABEL: Record<number, string> = {
  0: "Listed",
  1: "Sold out",
  2: "Delisted",
};

export function PropertyCard({
  property,
  onClick,
}: {
  property: OnChainProperty;
  onClick?: () => void;
}) {
  const { data: meta, isLoading: metaLoading } = useIpfsMetadata(property.metadataURI);

  const remaining = property.totalShares - property.sharesSold;
  const percentSold =
    property.totalShares > 0 ? (property.sharesSold / property.totalShares) * 100 : 0;

  return (
    <article className="property-card" onClick={onClick}>
      <div className="image-wrap">
        {meta?.imageURI ? (
          <img
            src={ipfsToHttpUrl(meta.imageURI)}
            alt={meta.name}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="image-placeholder">{metaLoading ? "…" : "No image"}</div>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title">{meta?.name ?? `Property #${property.id}`}</h3>
        <p className="location">
          {meta?.location ? `${meta.location.city}, ${meta.location.country}` : "—"}
        </p>
        <p className="price">{formatEther(property.pricePerShare)} rUSD / share</p>
        <div className="progress">
          <div className="bar" style={{ width: `${percentSold}%` }} />
        </div>
        <p className="meta">
          {remaining.toLocaleString()} of {property.totalShares.toLocaleString()} shares available
          {" · "}
          <span className={`status status-${property.status}`}>
            {STATUS_LABEL[property.status]}
          </span>
        </p>
      </div>
    </article>
  );
}
