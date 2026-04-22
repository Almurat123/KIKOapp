// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICreditTopUpRouter {
    struct TokenConfig {
        bool supported;
        bool refundsEnabled;
    }

    struct DepositRecord {
        address payer;
        address beneficiary;
        address refundAddress;
        address token;
        uint256 amount;
        uint256 refundedAmount;
        uint64 depositedAt;
        uint64 refundableUntil;
        bytes32 metadataHash;
        bool exists;
    }

    event DepositReceived(
        bytes32 indexed orderId,
        address indexed payer,
        address indexed token,
        address beneficiary,
        address refundAddress,
        address treasury,
        uint256 amount,
        uint64 refundableUntil,
        bytes32 metadataHash
    );

    event DepositRefunded(
        bytes32 indexed orderId,
        bytes32 indexed refundId,
        address indexed token,
        address payer,
        address refundAddress,
        address treasury,
        uint256 amount,
        uint256 totalRefundedAmount
    );

    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event RefundAuthorityUpdated(address indexed previousAuthority, address indexed newAuthority);
    event RefundWindowUpdated(uint64 previousWindow, uint64 newWindow);
    event TokenConfigUpdated(address indexed token, bool supported, bool refundsEnabled);

    error ZeroAddress();
    error ZeroValue();
    error InvalidOrderId();
    error InvalidRefundId();
    error UnsupportedToken();
    error RefundsDisabled();
    error DepositAlreadyExists();
    error DepositNotFound();
    error RefundWindowExpired();
    error RefundAlreadyProcessed();
    error RefundAmountExceeded();
    error NotAuthorized();

    function treasury() external view returns (address);
    function refundAuthority() external view returns (address);
    function refundWindowSeconds() external view returns (uint64);
    function tokenConfigs(address token) external view returns (bool supported, bool refundsEnabled);
    function deposits(bytes32 orderId) external view returns (
        address payer,
        address beneficiary,
        address refundAddress,
        address token,
        uint256 amount,
        uint256 refundedAmount,
        uint64 depositedAt,
        uint64 refundableUntil,
        bytes32 metadataHash,
        bool exists
    );
    function processedRefundIds(bytes32 refundId) external view returns (bool);

    function deposit(
        bytes32 orderId,
        address token,
        uint256 amount,
        address beneficiary,
        address refundAddress,
        bytes32 metadataHash
    ) external;

    function refundDeposit(bytes32 orderId, bytes32 refundId, uint256 amount) external;

    function setTreasury(address newTreasury) external;
    function setRefundAuthority(address newRefundAuthority) external;
    function setRefundWindowSeconds(uint64 newRefundWindowSeconds) external;
    function setTokenConfig(address token, bool supported, bool refundsEnabled) external;

    function refundableAmount(bytes32 orderId) external view returns (uint256);
}
