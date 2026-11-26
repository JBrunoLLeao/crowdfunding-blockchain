const { ethers, network, run } = require("hardhat");
const { exportAbi, saveDeployment } = require("./utils");

async function main() {
  const feeBps = BigInt(process.env.FEE_BPS ?? 250); // 250 = 2,5%
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();

  console.log(`Rede:     ${network.name} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Taxa:     ${Number(feeBps) / 100}%`);

  const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
  const crowdfunding = await Crowdfunding.deploy(feeBps);
  const isLocal = network.name === "hardhat" || network.name === "localhost";
  // Redes locais geram 1 bloco por transação; em redes públicas esperamos 5 confirmações
  const receipt = await crowdfunding.deploymentTransaction().wait(isLocal ? 1 : 5);
  const address = await crowdfunding.getAddress();

  console.log(`\n✅ Crowdfunding implantado em: ${address}`);

  // Redes efêmeras (testes) não precisam persistir nada
  if (network.name === "hardhat") return;

  saveDeployment({
    network: network.name,
    chainId: Number(chainId),
    address,
    feeBps: Number(feeBps),
    deployer: deployer.address,
    blockNumber: receipt.blockNumber,
    deployedAt: new Date().toISOString(),
  });
  const abiPath = await exportAbi();
  console.log(`📄 Deploy salvo em deployments/${network.name}.json`);
  console.log(`📄 ABI e endereço exportados para o frontend (${abiPath})`);

  // Verificação automática no Etherscan (apenas redes públicas)
  if (network.name !== "localhost" && process.env.ETHERSCAN_API_KEY) {
    try {
      console.log("\nVerificando no Etherscan...");
      await run("verify:verify", { address, constructorArguments: [feeBps] });
    } catch (e) {
      console.log("Falha na verificação (você pode tentar novamente depois):", e.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
