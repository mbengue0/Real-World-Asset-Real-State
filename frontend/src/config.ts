/**
 * Runtime configuration loaded from Vite env vars (VITE_*).
 * All env vars are validated at module load so missing values fail fast in dev.
 */

function envOrEmpty(key: keyof ImportMetaEnv): string {
  const value = import.meta.env[key];
  return value ?? "";
}

function requiredAddress(key: keyof ImportMetaEnv): `0x${string}` {
  const value = envOrEmpty(key);
  if (!value || !value.startsWith("0x") || value.length !== 42) {
    console.warn(`[config] ${String(key)} is not set or is not a valid address. UI will show empty state.`);
  }
  return value as `0x${string}`;
}

export const CONFIG = {
  chainId: Number(envOrEmpty("VITE_CHAIN_ID") || 11155111),
  sepoliaRpcUrl: envOrEmpty("VITE_SEPOLIA_RPC_URL"),
  paymentToken: requiredAddress("VITE_PAYMENT_TOKEN_ADDRESS"),
  propertyFactory: requiredAddress("VITE_PROPERTY_FACTORY_ADDRESS"),
  pinataJwt: envOrEmpty("VITE_PINATA_JWT"),
  pinataGateway: envOrEmpty("VITE_PINATA_GATEWAY") || "https://gateway.pinata.cloud/ipfs/",
} as const;

export function isContractsConfigured(): boolean {
  return CONFIG.paymentToken.length === 42 && CONFIG.propertyFactory.length === 42;
}
