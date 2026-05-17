import { CONFIG } from "../config";

/**
 * Resolve any IPFS reference (ipfs://, bare CID, gateway URL) to an HTTPS
 * gateway URL the browser can fetch. The gateway is configurable via
 * VITE_PINATA_GATEWAY; default falls back to the public Pinata gateway.
 *
 * IPFS-as-protocol is gateway-agnostic per [COURSE — Lecture_2.md:351-359] —
 * the same CID resolves through any gateway, so this function is purely
 * a UX adapter for the browser fetch API.
 */
export function ipfsToHttpUrl(uri: string | undefined | null): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return CONFIG.pinataGateway + uri.slice("ipfs://".length);
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  // Bare CID
  return CONFIG.pinataGateway + uri;
}
