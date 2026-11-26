// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Crowdfunding
 * @author Projeto educacional
 * @notice Plataforma de crowdfunding descentralizada no modelo "tudo ou nada".
 *
 *  Fluxo:
 *   1. Um criador abre uma campanha com meta (wei) e prazo (1 a 90 dias).
 *   2. Qualquer pessoa contribui com ETH enquanto a campanha estiver ativa.
 *   3. Ao fim do prazo:
 *        - meta atingida  -> o criador saca (descontada a taxa da plataforma);
 *        - meta não atingida -> cada apoiador recupera sua contribuição.
 *   4. O criador pode CANCELAR uma campanha ativa; todos os apoiadores são reembolsados.
 *
 * @dev Princípios de projeto:
 *  - Pull over push: o contrato nunca envia ETH automaticamente; cada parte saca o que é seu.
 *  - Checks-Effects-Interactions + ReentrancyGuard em toda função que envia ETH.
 *  - A taxa é "congelada" no momento da criação da campanha (o admin não pode mudá-la depois).
 *  - Pausar o contrato bloqueia apenas NOVAS campanhas/contribuições. Saques e reembolsos
 *    continuam sempre disponíveis: o admin nunca consegue travar o dinheiro dos usuários.
 *  - Invariante: saldo do contrato = fundos ainda não sacados das campanhas + accruedFees.
 */
contract Crowdfunding is Ownable2Step, Pausable, ReentrancyGuard {
    // ---------------------------------------------------------------------
    // Tipos
    // ---------------------------------------------------------------------

    enum Status {
        Active,     // prazo em andamento
        Successful, // prazo acabou, meta atingida, criador ainda não sacou
        Failed,     // prazo acabou, meta NÃO atingida (reembolsos liberados)
        Cancelled,  // cancelada pelo criador (reembolsos liberados)
        Completed   // meta atingida e fundos já sacados pelo criador
    }

    /// @dev Armazenamento: os 5 primeiros campos ocupam um único slot de 32 bytes.
    struct Campaign {
        address creator;     // 20 bytes
        uint64 deadline;     //  8 bytes - timestamp de encerramento
        uint16 feeBps;       //  2 bytes - taxa congelada (basis points)
        bool withdrawn;      //  1 byte
        bool cancelled;      //  1 byte
        uint256 goal;        // meta em wei
        uint256 totalRaised; // total arrecadado em wei
        string title;
        string description;
        string imageUrl;
    }

    /// @dev Estrutura de leitura (inclui id e status calculado) pensada para o frontend.
    struct CampaignView {
        uint256 id;
        address creator;
        string title;
        string description;
        string imageUrl;
        uint256 goal;
        uint256 totalRaised;
        uint256 deadline;
        uint256 feeBps;
        Status status;
    }

    // ---------------------------------------------------------------------
    // Constantes e estado
    // ---------------------------------------------------------------------

    uint256 public constant MIN_DURATION = 1 days;
    uint256 public constant MAX_DURATION = 90 days;
    uint256 public constant MAX_FEE_BPS = 500; // teto de 5%
    uint256 public constant MAX_TITLE_LENGTH = 100;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 2000;
    uint256 public constant MAX_IMAGE_URL_LENGTH = 300;
    uint256 private constant BPS_DENOMINATOR = 10_000;

    /// @notice Quantidade de campanhas criadas (ids de 1 até campaignCount).
    uint256 public campaignCount;

    /// @notice Taxa atual da plataforma (basis points: 250 = 2,5%). Vale para NOVAS campanhas.
    uint256 public feeBps;

    /// @notice Taxas acumuladas, disponíveis para o owner sacar.
    uint256 public accruedFees;

    mapping(uint256 => Campaign) private _campaigns;

    /// @notice campaignId => apoiador => valor contribuído (wei)
    mapping(uint256 => mapping(address => uint256)) public contributions;

    // ---------------------------------------------------------------------
    // Eventos
    // ---------------------------------------------------------------------

    event CampaignCreated(
        uint256 indexed id,
        address indexed creator,
        string title,
        uint256 goal,
        uint256 deadline
    );
    event Contributed(uint256 indexed id, address indexed backer, uint256 amount);
    event Withdrawn(uint256 indexed id, address indexed creator, uint256 amount, uint256 fee);
    event Refunded(uint256 indexed id, address indexed backer, uint256 amount);
    event CampaignCancelled(uint256 indexed id, address indexed creator);
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ---------------------------------------------------------------------
    // Erros customizados (mais baratos em gás que strings)
    // ---------------------------------------------------------------------

    error CampaignNotFound();
    error InvalidGoal();
    error InvalidDuration();
    error EmptyTitle();
    error TitleTooLong();
    error DescriptionTooLong();
    error ImageUrlTooLong();
    error CampaignEnded();
    error CampaignStillActive();
    error CampaignIsCancelled();
    error ZeroContribution();
    error NotCreator();
    error GoalNotReached();
    error GoalReached();
    error AlreadyWithdrawn();
    error NothingToRefund();
    error FeeTooHigh();
    error NoFeesToWithdraw();
    error InvalidAddress();
    error TransferFailed();

    // ---------------------------------------------------------------------
    // Construtor e modificadores
    // ---------------------------------------------------------------------

    /// @param initialFeeBps Taxa inicial da plataforma em basis points (máx. 500 = 5%).
    constructor(uint256 initialFeeBps) Ownable(msg.sender) {
        if (initialFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = initialFeeBps;
    }

    modifier exists(uint256 id) {
        if (id == 0 || id > campaignCount) revert CampaignNotFound();
        _;
    }

    // ---------------------------------------------------------------------
    // Funções dos usuários
    // ---------------------------------------------------------------------

    /**
     * @notice Cria uma nova campanha.
     * @param title Título (1 a 100 bytes).
     * @param description Descrição, ou URI (ipfs://...) com mais detalhes (até 2000 bytes).
     * @param imageUrl URL da imagem de capa (opcional, até 300 bytes).
     * @param goal Meta em wei (> 0). Ex.: 5 ether = 5e18.
     * @param durationInSeconds Duração entre MIN_DURATION e MAX_DURATION.
     * @return id Identificador da campanha criada.
     */
    function createCampaign(
        string calldata title,
        string calldata description,
        string calldata imageUrl,
        uint256 goal,
        uint256 durationInSeconds
    ) external whenNotPaused returns (uint256 id) {
        if (bytes(title).length == 0) revert EmptyTitle();
        if (bytes(title).length > MAX_TITLE_LENGTH) revert TitleTooLong();
        if (bytes(description).length > MAX_DESCRIPTION_LENGTH) revert DescriptionTooLong();
        if (bytes(imageUrl).length > MAX_IMAGE_URL_LENGTH) revert ImageUrlTooLong();
        if (goal == 0) revert InvalidGoal();
        if (durationInSeconds < MIN_DURATION || durationInSeconds > MAX_DURATION) {
            revert InvalidDuration();
        }

        id = ++campaignCount;

        Campaign storage c = _campaigns[id];
        c.creator = msg.sender;
        c.deadline = uint64(block.timestamp + durationInSeconds);
        c.feeBps = uint16(feeBps); // congela a taxa vigente
        c.goal = goal;
        c.title = title;
        c.description = description;
        c.imageUrl = imageUrl;

        emit CampaignCreated(id, msg.sender, title, goal, c.deadline);
    }

    /// @notice Contribui com ETH (msg.value) para uma campanha ativa.
    function contribute(uint256 id) external payable exists(id) whenNotPaused {
        Campaign storage c = _campaigns[id];
        if (c.cancelled) revert CampaignIsCancelled();
        if (block.timestamp >= c.deadline) revert CampaignEnded();
        if (msg.value == 0) revert ZeroContribution();

        c.totalRaised += msg.value;
        contributions[id][msg.sender] += msg.value;

        emit Contributed(id, msg.sender, msg.value);
    }

    /**
     * @notice O criador saca os fundos de uma campanha bem-sucedida.
     * @dev A taxa da plataforma é retida e fica em `accruedFees`.
     */
    function withdraw(uint256 id) external exists(id) nonReentrant {
        Campaign storage c = _campaigns[id];
        if (msg.sender != c.creator) revert NotCreator();

        Status s = _status(c);
        if (s == Status.Cancelled) revert CampaignIsCancelled();
        if (s == Status.Active) revert CampaignStillActive();
        if (s == Status.Failed) revert GoalNotReached();
        if (s == Status.Completed) revert AlreadyWithdrawn();

        c.withdrawn = true; // efeito antes da interação

        uint256 total = c.totalRaised;
        uint256 fee = (total * c.feeBps) / BPS_DENOMINATOR;
        uint256 payout = total - fee;
        accruedFees += fee;

        (bool ok, ) = payable(msg.sender).call{value: payout}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(id, msg.sender, payout, fee);
    }

    /// @notice O apoiador recupera sua contribuição de uma campanha falha ou cancelada.
    function refund(uint256 id) external exists(id) nonReentrant {
        Status s = _status(_campaigns[id]);
        if (s == Status.Active) revert CampaignStillActive();
        if (s == Status.Successful || s == Status.Completed) revert GoalReached();

        uint256 amount = contributions[id][msg.sender];
        if (amount == 0) revert NothingToRefund();

        contributions[id][msg.sender] = 0; // efeito antes da interação

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Refunded(id, msg.sender, amount);
    }

    /// @notice O criador cancela uma campanha ainda ativa. Todos podem pedir reembolso.
    function cancelCampaign(uint256 id) external exists(id) {
        Campaign storage c = _campaigns[id];
        if (msg.sender != c.creator) revert NotCreator();
        if (c.cancelled) revert CampaignIsCancelled();
        if (block.timestamp >= c.deadline) revert CampaignEnded();

        c.cancelled = true;
        emit CampaignCancelled(id, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Administração (owner)
    // ---------------------------------------------------------------------

    /// @notice Altera a taxa para NOVAS campanhas (máx. 5%).
    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        emit FeeUpdated(feeBps, newFeeBps);
        feeBps = newFeeBps;
    }

    /// @notice Saca as taxas acumuladas para o endereço informado.
    function withdrawFees(address payable to) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        uint256 amount = accruedFees;
        if (amount == 0) revert NoFeesToWithdraw();

        accruedFees = 0;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit FeesWithdrawn(to, amount);
    }

    /// @notice Pausa criação de campanhas e contribuições (saques/reembolsos seguem ativos).
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Retoma a operação normal.
    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------------
    // Leitura
    // ---------------------------------------------------------------------

    /// @notice Dados completos de uma campanha, já com o status calculado.
    function getCampaign(uint256 id) external view exists(id) returns (CampaignView memory) {
        return _toView(id);
    }

    /// @notice Lista paginada de campanhas (ordem de criação).
    /// @return page Campanhas de `offset` até `offset + limit` (limitado ao total).
    /// @return total Quantidade total de campanhas.
    function getCampaigns(
        uint256 offset,
        uint256 limit
    ) external view returns (CampaignView[] memory page, uint256 total) {
        total = campaignCount;
        if (offset >= total || limit == 0) {
            return (new CampaignView[](0), total);
        }
        uint256 end = limit > total - offset ? total : offset + limit;
        page = new CampaignView[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = _toView(i + 1);
        }
    }

    /// @notice Status atual de uma campanha.
    function getStatus(uint256 id) external view exists(id) returns (Status) {
        return _status(_campaigns[id]);
    }

    // ---------------------------------------------------------------------
    // Internas
    // ---------------------------------------------------------------------

    function _status(Campaign storage c) private view returns (Status) {
        if (c.cancelled) return Status.Cancelled;
        if (block.timestamp < c.deadline) return Status.Active;
        if (c.totalRaised < c.goal) return Status.Failed;
        return c.withdrawn ? Status.Completed : Status.Successful;
    }

    function _toView(uint256 id) private view returns (CampaignView memory v) {
        Campaign storage c = _campaigns[id];
        v.id = id;
        v.creator = c.creator;
        v.title = c.title;
        v.description = c.description;
        v.imageUrl = c.imageUrl;
        v.goal = c.goal;
        v.totalRaised = c.totalRaised;
        v.deadline = c.deadline;
        v.feeBps = c.feeBps;
        v.status = _status(c);
    }
}
