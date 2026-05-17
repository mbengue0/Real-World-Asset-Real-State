import { CONFIG } from "../config";

const PINATA_API_BASE = "https://api.pinata.cloud";

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

/**
 * Pin an arbitrary JSON object to IPFS via Pinata. Returns the CID.
 * Caller is expected to wrap the result as `ipfs://<CID>` when storing on-chain.
 *
 * Only used by admin flows (list property). Requires VITE_PINATA_JWT.
 */
export async function pinJson(content: unknown, name: string): Promise<string> {
  if (!CONFIG.pinataJwt) {
    throw new Error("Pinata JWT not configured. Set VITE_PINATA_JWT in frontend/.env");
  }
  const res = await fetch(`${PINATA_API_BASE}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.pinataJwt}`,
    },
    body: JSON.stringify({
      pinataContent: content,
      pinataMetadata: { name },
    }),
  });
  if (!res.ok) {
    throw new Error(`Pinata pinJSONToIPFS failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as PinataResponse;
  return data.IpfsHash;
}

/**
 * Pin a binary file (image) to IPFS via Pinata. Returns the CID.
 * Used by the admin "List Property" form to upload the property image
 * before pinning the JSON metadata that references it.
 */
export async function pinFile(file: File, name: string): Promise<string> {
  if (!CONFIG.pinataJwt) {
    throw new Error("Pinata JWT not configured. Set VITE_PINATA_JWT in frontend/.env");
  }
  const form = new FormData();
  form.append("file", file);
  form.append("pinataMetadata", JSON.stringify({ name }));

  const res = await fetch(`${PINATA_API_BASE}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CONFIG.pinataJwt}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Pinata pinFileToIPFS failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as PinataResponse;
  return data.IpfsHash;
}
