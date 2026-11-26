import deployments from "../contracts/deployments.json";
import abi from "../contracts/abi.json";

export { abi };

const env = import.meta.env;
const ETH = { name: "Ether", symbol: "ETH", decimals: 18 };

/** Redes suportadas pelo app. */
export const CHAINS = {
  31337: {
    id: 31337,
    name: "Hardhat Local",
    rpcUrl: env.VITE_LOCAL_RPC_URL || "http://127.0.0.1:8545",
    currency: ETH,
    explorer: null,
  },
  11155111: {
    id: 11155111,
    name: "Sepolia (testnet)",
    rpcUrl: env.VITE_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
    currency: ETH,
    explorer: "https://sepolia.etherscan.io",
  },
};

/** Rede usada para leitura quando a carteira não está conectada. */
export const DEFAULT_CHAIN_ID = Number(env.VITE_DEFAULT_CHAIN_ID || 31337);

/** Endereço do contrato na rede informada (variável de ambiente > deployments.json). */
export function getContractAddress(chainId) {
  if (env.VITE_CONTRACT_ADDRESS && chainId === DEFAULT_CHAIN_ID) return env.VITE_CONTRACT_ADDRESS;
  return deployments[String(chainId)]?.address ?? null;
}
