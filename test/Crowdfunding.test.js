const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const DAY = 24 * 60 * 60;
const GOAL = ethers.parseEther("10");
const FEE_BPS = 250n; // 2,5%
const feeOf = (amount, bps = FEE_BPS) => (amount * bps) / 10_000n;
const Status = { Active: 0n, Successful: 1n, Failed: 2n, Cancelled: 3n, Completed: 4n };

describe("Crowdfunding", function () {
  // ------------------------------------------------------------------ fixtures
  async function deployFixture() {
    const [owner, creator, alice, bob, stranger] = await ethers.getSigners();
    const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
    const cf = await Crowdfunding.deploy(FEE_BPS);
    return { cf, owner, creator, alice, bob, stranger };
  }

  async function campaignFixture() {
    const base = await deployFixture();
    await base.cf
      .connect(base.creator)
      .createCampaign("Meu projeto", "Descrição", "https://img/capa.png", GOAL, 30 * DAY);
    return { ...base, id: 1n };
  }

  /** Campanha com meta atingida e prazo encerrado. */
  async function successfulFixture() {
    const base = await campaignFixture();
    await base.cf.connect(base.alice).contribute(base.id, { value: ethers.parseEther("6") });
    await base.cf.connect(base.bob).contribute(base.id, { value: ethers.parseEther("4") });
    await time.increase(31 * DAY);
    return base;
  }

  /** Campanha com meta NÃO atingida e prazo encerrado. */
  async function failedFixture() {
    const base = await campaignFixture();
    await base.cf.connect(base.alice).contribute(base.id, { value: ethers.parseEther("2") });
    await base.cf.connect(base.bob).contribute(base.id, { value: ethers.parseEther("1") });
    await time.increase(31 * DAY);
    return base;
  }

  // ---------------------------------------------------------------- deployment
  describe("deploy", function () {
    it("define owner e taxa iniciais", async function () {
      const { cf, owner } = await loadFixture(deployFixture);
      expect(await cf.owner()).to.equal(owner.address);
      expect(await cf.feeBps()).to.equal(FEE_BPS);
      expect(await cf.campaignCount()).to.equal(0n);
    });

    it("rejeita taxa acima do teto", async function () {
      const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
      await expect(Crowdfunding.deploy(501)).to.be.revertedWithCustomError(Crowdfunding, "FeeTooHigh");
    });

    it("rejeita ETH enviado diretamente ao contrato", async function () {
      const { cf, alice } = await loadFixture(deployFixture);
      await expect(alice.sendTransaction({ to: await cf.getAddress(), value: 1 })).to.be.reverted;
    });
  });

  // ------------------------------------------------------------ createCampaign
  describe("createCampaign", function () {
    it("cria campanha, emite evento e congela a taxa", async function () {
      const { cf, creator } = await loadFixture(deployFixture);
      await expect(cf.connect(creator).createCampaign("Titulo", "desc", "", GOAL, 7 * DAY)).to.emit(
        cf,
        "CampaignCreated"
      );
      const c = await cf.getCampaign(1);
      expect(c.id).to.equal(1n);
      expect(c.creator).to.equal(creator.address);
      expect(c.title).to.equal("Titulo");
      expect(c.goal).to.equal(GOAL);
      expect(c.feeBps).to.equal(FEE_BPS);
      expect(c.status).to.equal(Status.Active);
      expect(await cf.campaignCount()).to.equal(1n);
    });

    it("rejeita parâmetros inválidos", async function () {
      const { cf } = await loadFixture(deployFixture);
      await expect(cf.createCampaign("", "d", "", GOAL, 7 * DAY)).to.be.revertedWithCustomError(cf, "EmptyTitle");
      await expect(cf.createCampaign("x".repeat(101), "d", "", GOAL, 7 * DAY)).to.be.revertedWithCustomError(
        cf,
        "TitleTooLong"
      );
      await expect(cf.createCampaign("t", "x".repeat(2001), "", GOAL, 7 * DAY)).to.be.revertedWithCustomError(
        cf,
        "DescriptionTooLong"
      );
      await expect(cf.createCampaign("t", "d", "x".repeat(301), GOAL, 7 * DAY)).to.be.revertedWithCustomError(
        cf,
        "ImageUrlTooLong"
      );
      await expect(cf.createCampaign("t", "d", "", 0, 7 * DAY)).to.be.revertedWithCustomError(cf, "InvalidGoal");
      await expect(cf.createCampaign("t", "d", "", GOAL, DAY - 1)).to.be.revertedWithCustomError(
        cf,
        "InvalidDuration"
      );
      await expect(cf.createCampaign("t", "d", "", GOAL, 91 * DAY)).to.be.revertedWithCustomError(
        cf,
        "InvalidDuration"
      );
    });

    it("aceita os limites exatos de duração", async function () {
      const { cf } = await loadFixture(deployFixture);
      await cf.createCampaign("min", "", "", GOAL, DAY);
      await cf.createCampaign("max", "", "", GOAL, 90 * DAY);
      expect(await cf.campaignCount()).to.equal(2n);
    });

    it("bloqueia criação quando pausado", async function () {
      const { cf, owner } = await loadFixture(deployFixture);
      await cf.connect(owner).pause();
      await expect(cf.createCampaign("t", "", "", GOAL, 7 * DAY)).to.be.revertedWithCustomError(cf, "EnforcedPause");
    });
  });

  // ---------------------------------------------------------------- contribute
  describe("contribute", function () {
    it("registra e acumula contribuições", async function () {
      const { cf, alice, id } = await loadFixture(campaignFixture);
      await expect(cf.connect(alice).contribute(id, { value: ethers.parseEther("1") }))
        .to.emit(cf, "Contributed")
        .withArgs(id, alice.address, ethers.parseEther("1"));
      await cf.connect(alice).contribute(id, { value: ethers.parseEther("2") });

      expect(await cf.contributions(id, alice.address)).to.equal(ethers.parseEther("3"));
      expect((await cf.getCampaign(id)).totalRaised).to.equal(ethers.parseEther("3"));
    });

    it("rejeita valor zero e campanha inexistente", async function () {
      const { cf, alice, id } = await loadFixture(campaignFixture);
      await expect(cf.connect(alice).contribute(id, { value: 0 })).to.be.revertedWithCustomError(
        cf,
        "ZeroContribution"
      );
      await expect(cf.connect(alice).contribute(0, { value: 1 })).to.be.revertedWithCustomError(
        cf,
        "CampaignNotFound"
      );
      await expect(cf.connect(alice).contribute(99, { value: 1 })).to.be.revertedWithCustomError(
        cf,
        "CampaignNotFound"
      );
    });

    it("rejeita contribuição após o prazo", async function () {
      const { cf, alice, id } = await loadFixture(campaignFixture);
      await time.increase(31 * DAY);
      await expect(cf.connect(alice).contribute(id, { value: 1 })).to.be.revertedWithCustomError(
        cf,
        "CampaignEnded"
      );
    });

    it("rejeita contribuição em campanha cancelada", async function () {
      const { cf, creator, alice, id } = await loadFixture(campaignFixture);
      await cf.connect(creator).cancelCampaign(id);
      await expect(cf.connect(alice).contribute(id, { value: 1 })).to.be.revertedWithCustomError(
        cf,
        "CampaignIsCancelled"
      );
    });

    it("bloqueia contribuição quando pausado", async function () {
      const { cf, owner, alice, id } = await loadFixture(campaignFixture);
      await cf.connect(owner).pause();
      await expect(cf.connect(alice).contribute(id, { value: 1 })).to.be.revertedWithCustomError(
        cf,
        "EnforcedPause"
      );
    });
  });

  // ------------------------------------------------------------------ withdraw
  describe("withdraw (meta atingida)", function () {
    it("criador saca o valor menos a taxa", async function () {
      const { cf, creator, id } = await loadFixture(successfulFixture);
      const fee = feeOf(GOAL);
      expect((await cf.getCampaign(id)).status).to.equal(Status.Successful);

      await expect(cf.connect(creator).withdraw(id))
        .to.emit(cf, "Withdrawn")
        .withArgs(id, creator.address, GOAL - fee, fee);

      expect(await cf.accruedFees()).to.equal(fee);
      expect((await cf.getCampaign(id)).status).to.equal(Status.Completed);
    });

    it("movimenta os saldos corretamente", async function () {
      const { cf, creator, id } = await loadFixture(successfulFixture);
      const fee = feeOf(GOAL);
      await expect(cf.connect(creator).withdraw(id)).to.changeEtherBalances(
        [creator, cf],
        [GOAL - fee, -(GOAL - fee)]
      );
    });

    it("repassa o valor integral quando a campanha é superfinanciada", async function () {
      const { cf, creator, alice, id } = await loadFixture(campaignFixture);
      const raised = ethers.parseEther("25");
      await cf.connect(alice).contribute(id, { value: raised });
      await time.increase(31 * DAY);
      await expect(cf.connect(creator).withdraw(id)).to.changeEtherBalance(creator, raised - feeOf(raised));
    });

    it("usa a taxa congelada na criação, mesmo se o owner mudar depois", async function () {
      const { cf, owner, creator, alice, id } = await loadFixture(campaignFixture);
      await cf.connect(alice).contribute(id, { value: GOAL });
      await cf.connect(owner).setFeeBps(500);
      await time.increase(31 * DAY);
      await cf.connect(creator).withdraw(id);
      expect(await cf.accruedFees()).to.equal(feeOf(GOAL, FEE_BPS));
    });

    it("funciona com taxa zero", async function () {
      const [, creator, alice] = await ethers.getSigners();
      const cf = await (await ethers.getContractFactory("Crowdfunding")).deploy(0);
      await cf.connect(creator).createCampaign("Sem taxa", "", "", GOAL, 7 * DAY);
      await cf.connect(alice).contribute(1, { value: GOAL });
      await time.increase(8 * DAY);
      await expect(cf.connect(creator).withdraw(1)).to.changeEtherBalance(creator, GOAL);
      expect(await cf.accruedFees()).to.equal(0n);
    });

    it("continua funcionando com o contrato pausado", async function () {
      const { cf, owner, creator, id } = await loadFixture(successfulFixture);
      await cf.connect(owner).pause();
      await expect(cf.connect(creator).withdraw(id)).to.not.be.reverted;
    });

    it("bloqueia saques indevidos", async function () {
      const { cf, creator, alice, id } = await loadFixture(campaignFixture);
      await cf.connect(alice).contribute(id, { value: GOAL });

      await expect(cf.connect(alice).withdraw(id)).to.be.revertedWithCustomError(cf, "NotCreator");
      await expect(cf.connect(creator).withdraw(id)).to.be.revertedWithCustomError(cf, "CampaignStillActive");

      await time.increase(31 * DAY);
      await cf.connect(creator).withdraw(id);
      await expect(cf.connect(creator).withdraw(id)).to.be.revertedWithCustomError(cf, "AlreadyWithdrawn");
    });

    it("não permite saque se a meta não foi atingida", async function () {
      const { cf, creator, id } = await loadFixture(failedFixture);
      await expect(cf.connect(creator).withdraw(id)).to.be.revertedWithCustomError(cf, "GoalNotReached");
    });

    it("não permite saque em campanha cancelada", async function () {
      const { cf, creator, alice, id } = await loadFixture(campaignFixture);
      await cf.connect(alice).contribute(id, { value: GOAL });
      await cf.connect(creator).cancelCampaign(id);
      await time.increase(31 * DAY);
      await expect(cf.connect(creator).withdraw(id)).to.be.revertedWithCustomError(cf, "CampaignIsCancelled");
    });

    it("reverte com TransferFailed se o criador rejeitar ETH", async function () {
      const { cf, alice } = await loadFixture(deployFixture);
      const Rejecting = await ethers.getContractFactory("RejectingCreator");
      const rejecting = await Rejecting.deploy(await cf.getAddress());
      await rejecting.create(GOAL, 7 * DAY);
      await cf.connect(alice).contribute(1, { value: GOAL });
      await time.increase(8 * DAY);
      await expect(rejecting.withdraw(1)).to.be.revertedWithCustomError(cf, "TransferFailed");
    });
  });

  // -------------------------------------------------------------------- refund
  describe("refund", function () {
    it("apoiador recupera o valor quando a meta falha", async function () {
      const { cf, alice, id } = await loadFixture(failedFixture);
      const amount = ethers.parseEther("2");
      expect((await cf.getCampaign(id)).status).to.equal(Status.Failed);

      await expect(cf.connect(alice).refund(id)).to.emit(cf, "Refunded").withArgs(id, alice.address, amount);
      expect(await cf.contributions(id, alice.address)).to.equal(0n);
    });

    it("movimenta os saldos corretamente", async function () {
      const { cf, alice, id } = await loadFixture(failedFixture);
      const amount = ethers.parseEther("2");
      await expect(cf.connect(alice).refund(id)).to.changeEtherBalances([alice, cf], [amount, -amount]);
    });

    it("não permite reembolso duplo", async function () {
      const { cf, alice, id } = await loadFixture(failedFixture);
      await cf.connect(alice).refund(id);
      await expect(cf.connect(alice).refund(id)).to.be.revertedWithCustomError(cf, "NothingToRefund");
    });

    it("quem não contribuiu não recebe nada", async function () {
      const { cf, stranger, id } = await loadFixture(failedFixture);
      await expect(cf.connect(stranger).refund(id)).to.be.revertedWithCustomError(cf, "NothingToRefund");
    });

    it("bloqueia reembolso durante o prazo", async function () {
      const { cf, alice, id } = await loadFixture(campaignFixture);
      await cf.connect(alice).contribute(id, { value: 1 });
      await expect(cf.connect(alice).refund(id)).to.be.revertedWithCustomError(cf, "CampaignStillActive");
    });

    it("bloqueia reembolso se a meta foi atingida (antes e depois do saque)", async function () {
      const { cf, creator, alice, id } = await loadFixture(successfulFixture);
      await expect(cf.connect(alice).refund(id)).to.be.revertedWithCustomError(cf, "GoalReached");
      await cf.connect(creator).withdraw(id);
      await expect(cf.connect(alice).refund(id)).to.be.revertedWithCustomError(cf, "GoalReached");
    });

    it("continua funcionando com o contrato pausado", async function () {
      const { cf, owner, alice, id } = await loadFixture(failedFixture);
      await cf.connect(owner).pause();
      await expect(cf.connect(alice).refund(id)).to.not.be.reverted;
    });

    it("resiste a ataque de reentrância", async function () {
      const { cf, alice, id } = await loadFixture(campaignFixture);
      const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
      const attacker = await Attacker.deploy(await cf.getAddress());

      const stake = ethers.parseEther("1");
      await attacker.contribute(id, { value: stake });
      await cf.connect(alice).contribute(id, { value: ethers.parseEther("3") }); // fundos de terceiros
      await time.increase(31 * DAY);

      const cfAddress = await cf.getAddress();
      await expect(attacker.attackRefund(id)).to.changeEtherBalances(
        [await attacker.getAddress(), cfAddress],
        [stake, -stake]
      );

      expect(await attacker.reentryAttempted()).to.equal(true);
      expect(await attacker.reentrySucceeded()).to.equal(false);
      // o dinheiro da Alice continua intacto
      expect(await ethers.provider.getBalance(cfAddress)).to.equal(ethers.parseEther("3"));
    });
  });

  // -------------------------------------------------------------------- cancel
  describe("cancelCampaign", function () {
    it("criador cancela e apoiadores são reembolsados na hora, mesmo com meta atingida", async function () {
      const { cf, creator, alice, id } = await loadFixture(campaignFixture);
      await cf.connect(alice).contribute(id, { value: GOAL });

      await expect(cf.connect(creator).cancelCampaign(id)).to.emit(cf, "CampaignCancelled").withArgs(id, creator.address);
      expect((await cf.getCampaign(id)).status).to.equal(Status.Cancelled);

      await expect(cf.connect(alice).refund(id)).to.changeEtherBalance(alice, GOAL);
    });

    it("só o criador pode cancelar", async function () {
      const { cf, alice, id } = await loadFixture(campaignFixture);
      await expect(cf.connect(alice).cancelCampaign(id)).to.be.revertedWithCustomError(cf, "NotCreator");
    });

    it("não cancela duas vezes nem após o prazo", async function () {
      const { cf, creator, id } = await loadFixture(campaignFixture);
      await cf.connect(creator).cancelCampaign(id);
      await expect(cf.connect(creator).cancelCampaign(id)).to.be.revertedWithCustomError(cf, "CampaignIsCancelled");

      await cf.connect(creator).createCampaign("Outra", "", "", GOAL, 7 * DAY);
      await time.increase(8 * DAY);
      await expect(cf.connect(creator).cancelCampaign(2)).to.be.revertedWithCustomError(cf, "CampaignEnded");
    });
  });

  // -------------------------------------------------------------------- status
  describe("getStatus", function () {
    it("percorre todos os estados", async function () {
      const { cf, creator, alice } = await loadFixture(deployFixture);
      await cf.connect(creator).createCampaign("A", "", "", GOAL, 7 * DAY); // 1: vai ter sucesso
      await cf.connect(creator).createCampaign("B", "", "", GOAL, 7 * DAY); // 2: vai falhar
      await cf.connect(creator).createCampaign("C", "", "", GOAL, 7 * DAY); // 3: será cancelada
      await cf.connect(alice).contribute(1, { value: GOAL });
      await cf.connect(creator).cancelCampaign(3);

      expect(await cf.getStatus(1)).to.equal(Status.Active);
      expect(await cf.getStatus(2)).to.equal(Status.Active);
      expect(await cf.getStatus(3)).to.equal(Status.Cancelled);

      await time.increase(8 * DAY);
      expect(await cf.getStatus(1)).to.equal(Status.Successful);
      expect(await cf.getStatus(2)).to.equal(Status.Failed);

      await cf.connect(creator).withdraw(1);
      expect(await cf.getStatus(1)).to.equal(Status.Completed);
    });

    it("reverte para campanha inexistente", async function () {
      const { cf } = await loadFixture(deployFixture);
      await expect(cf.getStatus(1)).to.be.revertedWithCustomError(cf, "CampaignNotFound");
      await expect(cf.getCampaign(1)).to.be.revertedWithCustomError(cf, "CampaignNotFound");
    });
  });

  // ---------------------------------------------------------------- pagination
  describe("getCampaigns (paginação)", function () {
    async function manyFixture() {
      const base = await deployFixture();
      for (let i = 1; i <= 5; i++) {
        await base.cf.connect(base.creator).createCampaign(`Campanha ${i}`, "", "", GOAL, 7 * DAY);
      }
      return base;
    }

    it("retorna páginas corretas", async function () {
      const { cf } = await loadFixture(manyFixture);

      let [page, total] = await cf.getCampaigns(0, 2);
      expect(total).to.equal(5n);
      expect(page.map((c) => c.id)).to.deep.equal([1n, 2n]);

      [page] = await cf.getCampaigns(2, 2);
      expect(page.map((c) => c.id)).to.deep.equal([3n, 4n]);

      [page] = await cf.getCampaigns(4, 10); // limite maior que o restante
      expect(page.map((c) => c.id)).to.deep.equal([5n]);
    });

    it("retorna lista vazia para offset fora do intervalo ou limit zero", async function () {
      const { cf } = await loadFixture(manyFixture);
      let [page] = await cf.getCampaigns(5, 10);
      expect(page.length).to.equal(0);
      [page] = await cf.getCampaigns(0, 0);
      expect(page.length).to.equal(0);
    });

    it("funciona sem campanhas", async function () {
      const { cf } = await loadFixture(deployFixture);
      const [page, total] = await cf.getCampaigns(0, 10);
      expect(page.length).to.equal(0);
      expect(total).to.equal(0n);
    });
  });

  // --------------------------------------------------------------------- admin
  describe("administração", function () {
    it("owner altera a taxa (com teto) e emite evento", async function () {
      const { cf, owner } = await loadFixture(deployFixture);
      await expect(cf.connect(owner).setFeeBps(100)).to.emit(cf, "FeeUpdated").withArgs(FEE_BPS, 100n);
      expect(await cf.feeBps()).to.equal(100n);
      await expect(cf.connect(owner).setFeeBps(501)).to.be.revertedWithCustomError(cf, "FeeTooHigh");
    });

    it("apenas o owner acessa funções administrativas", async function () {
      const { cf, stranger } = await loadFixture(deployFixture);
      const denied = "OwnableUnauthorizedAccount";
      await expect(cf.connect(stranger).setFeeBps(1)).to.be.revertedWithCustomError(cf, denied);
      await expect(cf.connect(stranger).pause()).to.be.revertedWithCustomError(cf, denied);
      await expect(cf.connect(stranger).unpause()).to.be.revertedWithCustomError(cf, denied);
      await expect(cf.connect(stranger).withdrawFees(stranger.address)).to.be.revertedWithCustomError(cf, denied);
    });

    it("owner saca as taxas acumuladas", async function () {
      const { cf, owner, creator, stranger, id } = await loadFixture(successfulFixture);
      await cf.connect(creator).withdraw(id);
      const fee = feeOf(GOAL);

      await expect(cf.connect(owner).withdrawFees(stranger.address))
        .to.emit(cf, "FeesWithdrawn")
        .withArgs(stranger.address, fee);
      expect(await cf.accruedFees()).to.equal(0n);
      await expect(cf.connect(owner).withdrawFees(stranger.address)).to.be.revertedWithCustomError(
        cf,
        "NoFeesToWithdraw"
      );
    });

    it("saque de taxas entrega o valor ao destinatário", async function () {
      const { cf, owner, creator, stranger, id } = await loadFixture(successfulFixture);
      await cf.connect(creator).withdraw(id);
      await expect(cf.connect(owner).withdrawFees(stranger.address)).to.changeEtherBalance(
        stranger,
        feeOf(GOAL)
      );
    });

    it("rejeita saque de taxas para o endereço zero", async function () {
      const { cf, owner } = await loadFixture(deployFixture);
      await expect(cf.connect(owner).withdrawFees(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        cf,
        "InvalidAddress"
      );
    });

    it("pausa e retoma", async function () {
      const { cf, owner, creator } = await loadFixture(deployFixture);
      await cf.connect(owner).pause();
      expect(await cf.paused()).to.equal(true);
      await cf.connect(owner).unpause();
      await expect(cf.connect(creator).createCampaign("ok", "", "", GOAL, 7 * DAY)).to.not.be.reverted;
    });

    it("transferência de propriedade em duas etapas", async function () {
      const { cf, owner, alice } = await loadFixture(deployFixture);
      await cf.connect(owner).transferOwnership(alice.address);
      expect(await cf.owner()).to.equal(owner.address); // ainda não mudou
      await cf.connect(alice).acceptOwnership();
      expect(await cf.owner()).to.equal(alice.address);
    });
  });

  // ----------------------------------------------------------------- invariante
  describe("invariante de saldo", function () {
    it("saldo do contrato = fundos pendentes + taxas acumuladas", async function () {
      const { cf, creator, alice, bob } = await loadFixture(deployFixture);
      // campanha 1: sucesso e saque
      await cf.connect(creator).createCampaign("1", "", "", GOAL, 7 * DAY);
      await cf.connect(alice).contribute(1, { value: GOAL });
      // campanha 2: continua ativa
      await cf.connect(creator).createCampaign("2", "", "", GOAL, 60 * DAY);
      await cf.connect(bob).contribute(2, { value: ethers.parseEther("3") });
      // campanha 3: falha, com um reembolso
      await cf.connect(creator).createCampaign("3", "", "", GOAL, 7 * DAY);
      await cf.connect(alice).contribute(3, { value: ethers.parseEther("2") });
      await cf.connect(bob).contribute(3, { value: ethers.parseEther("1") });

      await time.increase(8 * DAY);
      await cf.connect(creator).withdraw(1);
      await cf.connect(alice).refund(3);

      // pendentes: campanha 2 (3 ETH) + campanha 3 ainda não reembolsada do Bob (1 ETH)
      const pending = ethers.parseEther("3") + ethers.parseEther("1");
      const balance = await ethers.provider.getBalance(await cf.getAddress());
      expect(balance).to.equal(pending + (await cf.accruedFees()));
    });
  });
});
