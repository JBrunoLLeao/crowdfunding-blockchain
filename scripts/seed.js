/**
 * Popula a rede LOCAL com campanhas de demonstração.
 * Uso: npm run node (terminal 1) -> npm run deploy:local -> npm run seed
 */
const { ethers, network } = require("hardhat");
const { getDeployedAddress } = require("./utils");

const DAY = 24 * 60 * 60;
const eth = (v) => ethers.parseEther(String(v));

async function main() {
  if (network.name !== "localhost" && network.name !== "hardhat") {
    throw new Error("O seed só pode ser executado em redes locais.");
  }
  const cf = await ethers.getContractAt("Crowdfunding", getDeployedAddress());
  const [, creatorA, creatorB, b1, b2, b3, b4] = await ethers.getSigners();

  const demos = [
    {
      by: creatorA,
      title: "Horta comunitária no bairro",
      description: "Vamos transformar um terreno abandonado em uma horta comunitária com irrigação por gotejamento.",
      goal: 5,
      days: 30,
      pledges: [[b1, 1.5], [b2, 0.8]],
    },
    {
      by: creatorB,
      title: "Jogo indie de plataforma 2D",
      description: "Um jogo de plataforma pixel art com trilha sonora original. Falta pouco para a meta!",
      goal: 10,
      days: 45,
      pledges: [[b1, 4], [b3, 3.5], [b4, 2]],
    },
    {
      by: creatorA,
      title: "Documentário sobre manguezais",
      description: "Registro audiovisual da vida nos manguezais do Nordeste brasileiro.",
      goal: 20,
      days: 60,
      pledges: [[b2, 1]],
    },
    {
      by: creatorB,
      title: "Biblioteca móvel de bicicleta",
      description: "Uma bicicleta-biblioteca que leva livros a comunidades distantes.",
      goal: 2,
      days: 7,
      pledges: [[b3, 2.2], [b4, 0.3]],
    },
    {
      by: creatorA,
      title: "Campanha sem apoios ainda",
      description: "Seja o primeiro apoiador desta campanha!",
      goal: 3,
      days: 15,
      pledges: [],
    },
  ];

  for (const d of demos) {
    const tx = await cf.connect(d.by).createCampaign(d.title, d.description, "", eth(d.goal), d.days * DAY);
    await tx.wait();
    const id = await cf.campaignCount();
    for (const [backer, value] of d.pledges) {
      await (await cf.connect(backer).contribute(id, { value: eth(value) })).wait();
    }
    console.log(`#${id} "${d.title}" criada com ${d.pledges.length} apoio(s)`);
  }

  console.log("\n✅ Seed concluído. Dica: `npm run time-travel` avança 31 dias para testar saques e reembolsos.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
