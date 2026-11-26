// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Crowdfunding} from "../Crowdfunding.sol";

/// @dev APENAS PARA TESTES. Tenta reentrar em `refund` ao receber ETH.
contract ReentrancyAttacker {
    Crowdfunding public immutable crowdfunding;
    uint256 public targetId;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor(Crowdfunding _crowdfunding) {
        crowdfunding = _crowdfunding;
    }

    function contribute(uint256 id) external payable {
        targetId = id;
        crowdfunding.contribute{value: msg.value}(id);
    }

    function attackRefund(uint256 id) external {
        targetId = id;
        crowdfunding.refund(id);
    }

    receive() external payable {
        if (!reentryAttempted) {
            reentryAttempted = true;
            try crowdfunding.refund(targetId) {
                reentrySucceeded = true;
            } catch {}
        }
    }
}
