import { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, isAddress } from "viem";
import { propertyFactoryAbi } from "../abi/PropertyFactory";
import { pinFile, pinJson } from "../lib/pinata";
import { CONFIG } from "../config";
import { formatTxError } from "../lib/errors";

interface FormState {
  name: string;
  description: string;
  city: string;
  country: string;
  address: string;
  yearBuilt: string;
  type: "residential" | "commercial";
  areaSqM: string;
  totalShares: string;
  pricePerShare: string;
  seller: string;
  image: File | null;
}

const initial: FormState = {
  name: "",
  description: "",
  city: "",
  country: "",
  address: "",
  yearBuilt: "",
  type: "residential",
  areaSqM: "",
  totalShares: "100",
  pricePerShare: "10",
  seller: "",
  image: null,
};

type Step = "idle" | "pinning-image" | "pinning-json" | "submitting" | "done";

/**
 * End-to-end admin flow:
 *   1. Upload property image → Pinata → image CID
 *   2. Build metadata JSON referencing image CID → Pinata → metadata CID
 *   3. Call PropertyFactory.listProperty(seller, totalShares, pricePerShare, ipfs://metadataCID)
 * Each step shows progress; errors at any step pause the flow with a retry path.
 */
export function ListPropertyForm() {
  const { address } = useAccount();
  const [form, setForm] = useState<FormState>(initial);
  const [step, setStep] = useState<Step>("idle");
  const [pinError, setPinError] = useState<string | null>(null);
  const [metadataURI, setMetadataURI] = useState<string | null>(null);

  useEffect(() => {
    if (address && !form.seller) setForm((f) => ({ ...f, seller: address }));
  }, [address]);

  const listTx = useWriteContract();
  const listReceipt = useWaitForTransactionReceipt({ hash: listTx.data });

  useEffect(() => {
    if (listReceipt.isSuccess) setStep("done");
  }, [listReceipt.isSuccess]);

  const isBusy = step !== "idle" && step !== "done";

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): string | null {
    if (!form.name.trim()) return "Name is required.";
    if (!form.city.trim() || !form.country.trim()) return "City and country are required.";
    if (!form.image) return "Property image is required.";
    if (!form.seller || !isAddress(form.seller)) return "Valid seller address required.";
    if (!form.totalShares || Number(form.totalShares) <= 0) return "Total shares must be > 0.";
    if (!form.pricePerShare || Number(form.pricePerShare) <= 0) return "Price per share must be > 0.";
    if (!CONFIG.pinataJwt) return "VITE_PINATA_JWT not configured in frontend/.env.";
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) {
      setPinError(err);
      return;
    }
    setPinError(null);
    try {
      setStep("pinning-image");
      const imageCid = await pinFile(form.image!, `${form.name}-image`);

      const metadata = {
        name: form.name,
        description: form.description,
        location: { address: form.address, city: form.city, country: form.country },
        imageURI: `ipfs://${imageCid}`,
        ...(form.yearBuilt ? { yearBuilt: Number(form.yearBuilt) } : {}),
        type: form.type,
        ...(form.areaSqM ? { areaSqM: Number(form.areaSqM) } : {}),
      };

      setStep("pinning-json");
      const jsonCid = await pinJson(metadata, `${form.name}-metadata`);
      const uri = `ipfs://${jsonCid}`;
      setMetadataURI(uri);

      setStep("submitting");
      listTx.writeContract({
        address: CONFIG.propertyFactory,
        abi: propertyFactoryAbi,
        functionName: "listProperty",
        args: [
          form.seller as `0x${string}`,
          Number(form.totalShares),
          parseEther(form.pricePerShare),
          uri,
        ],
      });
    } catch (e) {
      setPinError(e instanceof Error ? e.message : String(e));
      setStep("idle");
    }
  }

  function reset() {
    setForm({ ...initial, seller: address ?? "" });
    setStep("idle");
    setMetadataURI(null);
    setPinError(null);
  }

  const buttonLabel = () => {
    switch (step) {
      case "idle":
        return "List property";
      case "pinning-image":
        return "Pinning image to IPFS…";
      case "pinning-json":
        return "Pinning metadata to IPFS…";
      case "submitting":
        return listTx.isPending ? "Confirm in wallet…" : "Submitting transaction…";
      case "done":
        return "Listed";
    }
  };

  return (
    <div className="form">
      <h3>List a new property</h3>
      <label>
        Property image
        <input
          type="file"
          accept="image/*"
          onChange={(e) => set("image", e.target.files?.[0] ?? null)}
          disabled={isBusy}
        />
      </label>
      <div className="form-row">
        <label>
          Name
          <input value={form.name} onChange={(e) => set("name", e.target.value)} disabled={isBusy} />
        </label>
        <label>
          Type
          <select
            value={form.type}
            onChange={(e) => set("type", e.target.value as "residential" | "commercial")}
            disabled={isBusy}
          >
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </select>
        </label>
      </div>
      <label>
        Description
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          disabled={isBusy}
        />
      </label>
      <div className="form-row">
        <label>
          City
          <input value={form.city} onChange={(e) => set("city", e.target.value)} disabled={isBusy} />
        </label>
        <label>
          Country
          <input value={form.country} onChange={(e) => set("country", e.target.value)} disabled={isBusy} />
        </label>
      </div>
      <label>
        Street address (optional)
        <input value={form.address} onChange={(e) => set("address", e.target.value)} disabled={isBusy} />
      </label>
      <div className="form-row">
        <label>
          Year built (optional)
          <input
            type="number"
            value={form.yearBuilt}
            onChange={(e) => set("yearBuilt", e.target.value)}
            disabled={isBusy}
          />
        </label>
        <label>
          Area m² (optional)
          <input
            type="number"
            value={form.areaSqM}
            onChange={(e) => set("areaSqM", e.target.value)}
            disabled={isBusy}
          />
        </label>
      </div>
      <hr className="form-divider" />
      <div className="form-row">
        <label>
          Total shares
          <input
            type="number"
            value={form.totalShares}
            onChange={(e) => set("totalShares", e.target.value)}
            disabled={isBusy}
          />
        </label>
        <label>
          Price per share (rUSD)
          <input
            type="number"
            step="0.01"
            value={form.pricePerShare}
            onChange={(e) => set("pricePerShare", e.target.value)}
            disabled={isBusy}
          />
        </label>
      </div>
      <label>
        Seller address (receives payment)
        <input
          value={form.seller}
          onChange={(e) => set("seller", e.target.value)}
          disabled={isBusy}
          placeholder="0x..."
        />
      </label>

      <button
        className="wallet-btn primary form-submit"
        onClick={step === "done" ? reset : handleSubmit}
        disabled={isBusy}
      >
        {step === "done" ? "List another" : buttonLabel()}
      </button>

      {pinError && <p className="form-msg error">{pinError}</p>}
      {listTx.error && <p className="form-msg error">{formatTxError(listTx.error)}</p>}
      {step === "done" && metadataURI && (
        <p className="form-msg success">
          Property listed. Metadata URI: <code>{metadataURI}</code>
        </p>
      )}
    </div>
  );
}
