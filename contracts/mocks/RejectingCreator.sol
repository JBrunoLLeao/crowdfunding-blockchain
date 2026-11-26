// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Crowdfunding} from "../Crowdfunding.sol";

/// @dev APENAS PARA TESTES. Contrato criador que rejeita ETH recebido.
contract RejectingCreator {
    Crowdfunding public immutable crowdfunding;

    constructor(Crowdfunding _crowdfunding) {
        crowdfunding = _crowdfunding;
    }

    function create(uint256 goal, uint256 duration) external returns (uint256) {
        return crowdfunding.createCampaign("Rejeita ETH", "", "", goal, duration);
    }

    function withdraw(uint256 id) external {
        crowdfunding.withdraw(id);
    }

    receive() external payable {
        revert("no ETH");
    }
}
