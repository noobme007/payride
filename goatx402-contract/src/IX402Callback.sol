// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IX402Callback
 * @notice Interface for x402 payment callback functions
 * @dev Implement this interface to receive payment callbacks from goatx402
 *      when cross-chain payments are settled on the destination chain.
 *
 * There are two payment methods supported:
 * - EIP-3009: For USDC and other tokens that support receiveWithAuthorization
 * - Permit2: For tokens that have approved Uniswap's Permit2 contract
 *
 * Each method has two variants:
 * - Basic: Just receives the payment notification
 * - WithCalldata: Receives payment notification plus user-signed calldata for custom logic
 */
interface IX402Callback {
    /**
     * @notice EIP-3009 callback function
     * @dev Called by x402 after TSS signs the authorization. The implementation
     *      should call receiveWithAuthorization to pull tokens from the TSS wallet.
     * @param token The EIP-3009 token contract address
     * @param originalPayer The original payer who created the order on source chain
     * @param owner The token owner address (TSS wallet)
     * @param amount The amount of tokens to transfer
     * @param validAfter The timestamp after which the authorization is valid
     * @param validBefore The timestamp before which the authorization is valid
     * @param nonce The unique nonce for this authorization
     * @param v The recovery id of the signature
     * @param r The r component of the signature
     * @param s The s component of the signature
     */
    function x402SpentEip3009(
        address token,
        address originalPayer,
        address owner,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /**
     * @notice Permit2 callback function
     * @dev Called by x402 after TSS signs the permit. The implementation
     *      should call Permit2.permitTransferFrom to pull tokens from the TSS wallet.
     * @param permit2 The Permit2 contract address
     * @param token The token contract address
     * @param originalPayer The original payer who created the order on source chain
     * @param owner The token owner address (TSS wallet)
     * @param amount The amount of tokens to transfer
     * @param nonce The unique nonce for this permit
     * @param deadline The deadline timestamp for the permit
     * @param signature The signature bytes
     */
    function x402SpentPermit2(
        address permit2,
        address token,
        address originalPayer,
        address owner,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external;

    /**
     * @notice EIP-3009 callback function with user calldata
     * @dev Called by x402 after successful EIP-3009 payment, includes user-signed calldata.
     *      The calldata signature should be verified using EIP-712 with the originalPayer as signer.
     * @param token The EIP-3009 token contract address
     * @param originalPayer The original payer who created the order (signs the calldata)
     * @param owner The token owner address (TSS wallet)
     * @param amount The amount of tokens transferred
     * @param validAfter The timestamp after which the authorization is valid
     * @param validBefore The timestamp before which the authorization is valid
     * @param nonce The unique nonce for this authorization
     * @param v The recovery id of the EIP-3009 signature
     * @param r The r component of the EIP-3009 signature
     * @param s The s component of the EIP-3009 signature
     * @param calldata_ The user calldata bytes
     * @param orderId The order ID (binds calldata signature to specific order)
     * @param calldataNonce The nonce for calldata replay protection
     * @param calldataDeadline The deadline for calldata signature validity
     * @param calldataV The recovery id of the calldata signature
     * @param calldataR The r component of the calldata signature
     * @param calldataS The s component of the calldata signature
     */
    function x402SpentEip3009WithCalldata(
        address token,
        address originalPayer,
        address owner,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s,
        bytes calldata calldata_,
        bytes32 orderId,
        uint256 calldataNonce,
        uint256 calldataDeadline,
        uint8 calldataV,
        bytes32 calldataR,
        bytes32 calldataS
    ) external;

    /**
     * @notice Permit2 callback function with user calldata
     * @dev Called by x402 after successful Permit2 payment, includes user-signed calldata.
     *      The calldata signature should be verified using EIP-712 with the originalPayer as signer.
     * @param permit2 The Permit2 contract address
     * @param token The token contract address
     * @param originalPayer The original payer who created the order (signs the calldata)
     * @param owner The token owner address (TSS wallet)
     * @param amount The amount of tokens transferred
     * @param nonce The unique nonce for this permit
     * @param deadline The deadline timestamp for the permit
     * @param signature The Permit2 signature bytes
     * @param calldata_ The user calldata bytes
     * @param orderId The order ID (binds calldata signature to specific order)
     * @param calldataNonce The nonce for calldata replay protection
     * @param calldataDeadline The deadline for calldata signature validity
     * @param calldataV The recovery id of the calldata signature
     * @param calldataR The r component of the calldata signature
     * @param calldataS The s component of the calldata signature
     */
    function x402SpentPermit2WithCalldata(
        address permit2,
        address token,
        address originalPayer,
        address owner,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature,
        bytes calldata calldata_,
        bytes32 orderId,
        uint256 calldataNonce,
        uint256 calldataDeadline,
        uint8 calldataV,
        bytes32 calldataR,
        bytes32 calldataS
    ) external;
}
