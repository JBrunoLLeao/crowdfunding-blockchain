const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const ROOT = path.join(__dirname, "..");
const FRONTEND_CONTRACTS = path.join(ROOT, "frontend", "src", "contracts");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

/** Copia o ABI compilado para o frontend. */
async function exportAbi() {
  const artifact = await hre.artifacts.readArtifact("Crowdfunding");
  ensureDir(FRONTEND_CONTRACTS);
  fs.writeFileSync(path.join(FRONTEND_CONTRACTS, "abi.json"), JSON.stringify(artifact.abi, null, 2) + "\n");
  return path.join(FRONTEND_CONTRACTS, "abi.json");
}

/** Salva os dados do deploy em deployments/<rede>.json e registra o endereço no frontend. */
function saveDeployment(info) {
  const dir = path.join(ROOT, "deployments");
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, `${info.network}.json`), JSON.stringify(info, null, 2) + "\n");

  ensureDir(FRONTEND_CONTRACTS);
  const file = path.join(FRONTEND_CONTRACTS, "deployments.json");
  const all = readJson(file, {});
  all[String(info.chainId)] = {
    address: info.address,
    network: info.network,
    blockNumber: info.blockNumber,
  };
  fs.writeFileSync(file, JSON.stringify(all, null, 2) + "\n");
}

/** Endereço do contrato: variável CONTRACT_ADDRESS ou deployments/<rede>.json. */
function getDeployedAddress() {
  if (process.env.CONTRACT_ADDRESS) return process.env.CONTRACT_ADDRESS;
  const file = path.join(ROOT, "deployments", `${hre.network.name}.json`);
  const info = readJson(file, null);
  if (!info) {
    throw new Error(`Nenhum deploy encontrado para a rede "${hre.network.name}". Rode o deploy antes.`);
  }
  return info.address;
}

module.exports = { exportAbi, saveDeployment, getDeployedAddress };
