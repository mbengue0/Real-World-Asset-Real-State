import { useProperties } from "../hooks/useProperties";
import { PropertyCard } from "../components/PropertyCard";
import { isContractsConfigured } from "../config";

interface CatalogueProps {
  onSelectProperty?: (id: number) => void;
}

export function Catalogue({ onSelectProperty }: CatalogueProps) {
  const { properties, isLoading, error } = useProperties();

  if (!isContractsConfigured()) {
    return (
      <div className="state">
        <h2>Contracts not configured</h2>
        <p>
          Set <code>VITE_PAYMENT_TOKEN_ADDRESS</code> and{" "}
          <code>VITE_PROPERTY_FACTORY_ADDRESS</code> in <code>frontend/.env</code> to view the
          catalogue.
        </p>
      </div>
    );
  }

  if (isLoading) return <p className="state">Loading properties…</p>;
  if (error) return <p className="state error">Failed to load: {error.message}</p>;
  if (properties.length === 0) {
    return (
      <div className="state">
        <h2>No properties listed yet</h2>
        <p>The factory owner has not listed any properties. Check back soon.</p>
      </div>
    );
  }

  return (
    <section>
      <h1>Available Properties</h1>
      <div className="grid">
        {properties.map((p) => (
          <PropertyCard
            key={p.id}
            property={p}
            onClick={onSelectProperty ? () => onSelectProperty(p.id) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
