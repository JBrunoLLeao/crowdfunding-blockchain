/**
 * Avança o relógio da rede LOCAL para testar o fim das campanhas.
 * Uso: DAYS=31 npm run time-travel   (padrão: 31 dias)
 */
const { network } = require("hardhat");

async function main() {
  if (network.name !== "localhost" && network.name !== "hardhat") {
    throw new Error("Time travel só funciona em redes locais.");
  }
  const days = Number(process.env.DAYS ?? 31);
  await network.provider.send("evm_increaseTime", [days * 24 * 60 * 60]);
  await network.provider.send("evm_mine");
  console.log(`⏩ Relógio da blockchain avançado em ${days} dia(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
