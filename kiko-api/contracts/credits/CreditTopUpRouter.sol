// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ICreditTopUpRouter.sol";

// CONTEXT MEMORY
// Updated: 2026-04-22
// Status: verified
// Why: Credits top-up is moving from treasury address watching to an explicit Base
//      router contract so each deposit has a deterministic orderId and refund path.
// Debug Goal: Keep onchain deposit and refund events stable enough for backend
//      webhook ingestion, idempotent credit minting, and one-deposit-one-refund-flow.
// Search Tags: credits topup router deposit received refund from treasury base
// Invariants:
// - Each `orderId` can only be deposited once.
// - Refunds always return to the original deposit refundAddress and never exceed the deposited amount.
// Failure Modes:
// - Reusing an orderId or refundId would double-credit or double-refund if not rejected.
// - Treasury forgetting to approve token allowance to this router will make automated refunds revert.

contract CreditTopUpRouter is ICreditTopUpRouter, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public override treasury;
    address public override refundAuthority;
    uint64 public override refundWindowSeconds;

    mapping(address => TokenConfig) public override tokenConfigs;
    mapping(bytes32 => DepositRecord) public override deposits;
    mapping(bytes32 => bool) public override processedRefundIds;

    modifier onlyRefundOperator() {
        if (msg.sender != owner() && msg.sender != refundAuthority) revert NotAuthorized();
        _;
    }

    constructor(
        address owner_,
        address treasury_,
        address refundAuthority_,
        uint64 refundWindowSeconds_
    ) Ownable(owner_) {
        if (owner_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        refundAuthority = refundAuthority_;
        refundWindowSeconds = refundWindowSeconds_ == 0 ? 24 hours : refundWindowSeconds_;
    }

    function deposit(
        bytes32 orderId,
        address token,
        uint256 amount,
        address beneficiary,
        address refundAddress,
        bytes32 metadataHash
    ) external override whenNotPaused nonReentrant {
        if (orderId == bytes32(0)) revert InvalidOrderId();
        if (amount == 0) revert ZeroValue();
        if (token == address(0)) revert ZeroAddress();
        if (!tokenConfigs[token].supported) revert UnsupportedToken();
        if (deposits[orderId].exists) revert DepositAlreadyExists();

        address beneficiary_ = beneficiary == address(0) ? msg.sender : beneficiary;
        address refundAddress_ = refundAddress == address(0) ? msg.sender : refundAddress;
        if (beneficiary_ == address(0) || refundAddress_ == address(0)) revert ZeroAddress();

        uint64 depositedAt = uint64(block.timestamp);
        uint64 refundableUntil = depositedAt + refundWindowSeconds;
        deposits[orderId] = DepositRecord({
            payer: msg.sender,
            beneficiary: beneficiary_,
            refundAddress: refundAddress_,
            token: token,
            amount: amount,
            refundedAmount: 0,
            depositedAt: depositedAt,
            refundableUntil: refundableUntil,
            metadataHash: metadataHash,
            exists: true
        });

        IERC20(token).safeTransferFrom(msg.sender, treasury, amount);

        emit DepositReceived(
            orderId,
            msg.sender,
            token,
            beneficiary_,
            refundAddress_,
            treasury,
            amount,
            refundableUntil,
            metadataHash
        );
    }

    function refundDeposit(bytes32 orderId, bytes32 refundId, uint256 amount)
        external
        override
        onlyRefundOperator
        whenNotPaused
        nonReentrant
    {
        if (refundId == bytes32(0)) revert InvalidRefundId();
        if (amount == 0) revert ZeroValue();
        if (processedRefundIds[refundId]) revert RefundAlreadyProcessed();

        DepositRecord storage record = deposits[orderId];
        if (!record.exists) revert DepositNotFound();
        if (!tokenConfigs[record.token].refundsEnabled) revert RefundsDisabled();
        if (block.timestamp > record.refundableUntil) revert RefundWindowExpired();

        uint256 remaining = record.amount - record.refundedAmount;
        if (amount > remaining) revert RefundAmountExceeded();

        processedRefundIds[refundId] = true;
        record.refundedAmount += amount;

        IERC20(record.token).safeTransferFrom(treasury, record.refundAddress, amount);

        emit DepositRefunded(
            orderId,
            refundId,
            record.token,
            record.payer,
            record.refundAddress,
            treasury,
            amount,
            record.refundedAmount
        );
    }

    function refundableAmount(bytes32 orderId) external view override returns (uint256) {
        DepositRecord memory record = deposits[orderId];
        if (!record.exists) return 0;
        if (block.timestamp > record.refundableUntil) return 0;
        if (!tokenConfigs[record.token].refundsEnabled) return 0;
        return record.amount - record.refundedAmount;
    }

    function setTreasury(address newTreasury) external override onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setRefundAuthority(address newRefundAuthority) external override onlyOwner {
        emit RefundAuthorityUpdated(refundAuthority, newRefundAuthority);
        refundAuthority = newRefundAuthority;
    }

    function setRefundWindowSeconds(uint64 newRefundWindowSeconds) external override onlyOwner {
        if (newRefundWindowSeconds == 0) revert ZeroValue();
        emit RefundWindowUpdated(refundWindowSeconds, newRefundWindowSeconds);
        refundWindowSeconds = newRefundWindowSeconds;
    }

    function setTokenConfig(address token, bool supported, bool refundsEnabled) external override onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        tokenConfigs[token] = TokenConfig({
            supported: supported,
            refundsEnabled: refundsEnabled
        });
        emit TokenConfigUpdated(token, supported, refundsEnabled);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
