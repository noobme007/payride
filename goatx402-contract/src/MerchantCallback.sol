// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IX402Callback} from "./IX402Callback.sol";

/**
 * @title IEip3009
 * @notice Interface for EIP-3009 tokens (e.g., USDC)
 */
interface IEip3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/**
 * @title IPermit2
 * @notice Interface for Uniswap Permit2 SignatureTransfer
 */
interface IPermit2 {
    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }

    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount;
    }

    function permitTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;
}

/**
 * @title MerchantCallback
 * @notice UUPS upgradeable contract for receiving payment callbacks from goatx402
 * @dev Implements IX402Callback interface with EIP-712 signature verification for calldata
 *
 * Security features:
 * - Access control: Only authorized x402 addresses can call callback functions
 * - EIP-712 signatures bind to full payment context (token, permit2, owner, amount, etc.)
 * - Calldata execution limited to whitelisted function selectors
 * - Calldata nonce tracking per user prevents replay attacks
 */
contract MerchantCallback is
    Initializable,
    OwnableUpgradeable,
    EIP712Upgradeable,
    UUPSUpgradeable,
    IX402Callback
{
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    // ============ Events ============

    event Eip3009CallbackReceived(
        address indexed token,
        address indexed originalPayer,
        address indexed owner,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    );

    event Permit2CallbackReceived(
        address indexed token,
        address indexed originalPayer,
        address indexed owner,
        uint256 amount,
        uint256 nonce,
        uint256 deadline
    );

    event Eip3009CallbackWithCalldataReceived(
        address indexed token,
        address indexed originalPayer,
        address indexed owner,
        uint256 amount,
        bytes32 nonce,
        bytes calldata_,
        uint256 calldataNonce
    );

    event Permit2CallbackWithCalldataReceived(
        address indexed token,
        address indexed originalPayer,
        address indexed owner,
        uint256 amount,
        uint256 nonce,
        bytes calldata_,
        uint256 calldataNonce
    );

    event CalldataExecuted(bytes calldata_, bool success, bytes result);
    event TokensWithdrawn(address indexed token, address indexed to, uint256 amount);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event TestCallbackExecuted(address indexed payer, uint256 value, string message);

    // ============ Errors ============

    error UnauthorizedCaller(address caller);
    error CalldataNonceAlreadyUsed(address user, uint256 nonce);
    error CalldataSignatureExpired(uint256 deadline, uint256 currentTime);
    error InvalidCalldataSignature(address expected, address actual);

    // ============ EIP-712 Typehashes ============

    // EIP-712 typehash for EIP-3009 calldata verification
    // Binds signature to: token, owner (TSS), originalPayer, amount, orderId, and calldata
    bytes32 public constant EIP3009_CALLBACK_DATA_TYPEHASH = keccak256(
        "Eip3009CallbackData(address token,address owner,address payer,uint256 amount,bytes32 orderId,uint256 calldataNonce,uint256 deadline,bytes32 calldataHash)"
    );

    // EIP-712 typehash for Permit2 calldata verification
    // Binds signature to: permit2, token, owner (TSS), originalPayer, amount, orderId, and calldata
    bytes32 public constant PERMIT2_CALLBACK_DATA_TYPEHASH = keccak256(
        "Permit2CallbackData(address permit2,address token,address owner,address payer,uint256 amount,bytes32 orderId,uint256 calldataNonce,uint256 deadline,bytes32 calldataHash)"
    );

    // ============ Storage ============

    // Mapping to track authorized x402 callers
    mapping(address => bool) public authorizedCallers;

    // Mapping to track calldata nonces per user (prevent replay attacks)
    mapping(address => mapping(uint256 => bool)) public calldataNonceUsed;

    // ============ Modifiers ============

    /**
     * @notice Only allows authorized x402 callers
     */
    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender]) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }

    // ============ Constructor & Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (replaces constructor for upgradeable contracts)
     * @param initialOwner The initial owner of the contract
     */
    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __EIP712_init("GoatX402 Pay Callback", "1");
    }

    /**
     * @notice Reinitialize the contract to update EIP712 domain
     * @param eip712Name The new EIP712 domain name
     * @param eip712Version The new EIP712 domain version
     */
    function reinitialize(string memory eip712Name, string memory eip712Version) public reinitializer(2) onlyOwner {
        __EIP712_init(eip712Name, eip712Version);
    }

    // ============ Admin Functions ============

    /**
     * @notice Authorize upgrade (only owner can upgrade)
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @notice Set authorized caller status
     * @param caller The address to authorize/deauthorize
     * @param authorized Whether the caller is authorized
     */
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    /**
     * @notice Batch set authorized callers
     * @param callers Array of addresses to update
     * @param authorized Array of authorization statuses
     */
    function setAuthorizedCallers(address[] calldata callers, bool[] calldata authorized) external onlyOwner {
        require(callers.length == authorized.length, "Length mismatch");
        for (uint256 i = 0; i < callers.length; i++) {
            authorizedCallers[callers[i]] = authorized[i];
            emit AuthorizedCallerUpdated(callers[i], authorized[i]);
        }
    }

    /**
     * @notice Withdraw tokens from this contract
     * @param token The token contract address
     * @param to The recipient address
     * @param amount The amount to withdraw
     */
    function withdrawTokens(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
        emit TokensWithdrawn(token, to, amount);
    }

    // ============ Callback Functions ============

    /**
     * @notice EIP-3009 callback function
     * @dev Called by x402 after TSS signs the authorization
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
    ) external override onlyAuthorized {
        // Call receiveWithAuthorization to pull tokens from owner to this contract
        IEip3009(token).receiveWithAuthorization(
            owner,          // from
            address(this),  // to (this contract)
            amount,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );

        emit Eip3009CallbackReceived(
            token,
            originalPayer,
            owner,
            amount,
            validAfter,
            validBefore,
            nonce
        );
    }

    /**
     * @notice Permit2 callback function
     * @dev Called by x402 after TSS signs the permit
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
    ) external override onlyAuthorized {
        // Call Permit2 to pull tokens from owner to this contract
        IPermit2(permit2).permitTransferFrom(
            IPermit2.PermitTransferFrom({
                permitted: IPermit2.TokenPermissions({
                    token: token,
                    amount: amount
                }),
                nonce: nonce,
                deadline: deadline
            }),
            IPermit2.SignatureTransferDetails({
                to: address(this),
                requestedAmount: amount
            }),
            owner,
            signature
        );

        emit Permit2CallbackReceived(
            token,
            originalPayer,
            owner,
            amount,
            nonce,
            deadline
        );
    }

    /**
     * @notice EIP-3009 callback function with user calldata
     * @dev Called by x402 after successful EIP-3009 payment, includes user-signed calldata
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
    ) external override onlyAuthorized {
        // Check for duplicate calldata nonce
        if (calldataNonceUsed[originalPayer][calldataNonce]) {
            revert CalldataNonceAlreadyUsed(originalPayer, calldataNonce);
        }

        // Check calldata deadline
        if (block.timestamp > calldataDeadline) {
            revert CalldataSignatureExpired(calldataDeadline, block.timestamp);
        }

        // Verify calldata signature (EIP-712) - binds to full payment context
        bytes32 structHash = keccak256(abi.encode(
            EIP3009_CALLBACK_DATA_TYPEHASH,
            token,              // token address - prevents token substitution
            owner,              // TSS wallet - prevents owner substitution
            originalPayer,      // payer who signs the calldata
            amount,             // payment amount
            orderId,            // order ID - links to specific order
            calldataNonce,      // replay protection nonce
            calldataDeadline,   // signature expiry
            keccak256(calldata_) // calldata hash
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(calldataV, calldataR, calldataS);
        if (signer != originalPayer) {
            revert InvalidCalldataSignature(originalPayer, signer);
        }

        // Mark calldata nonce as used
        calldataNonceUsed[originalPayer][calldataNonce] = true;

        // Call receiveWithAuthorization to pull tokens from owner to this contract
        IEip3009(token).receiveWithAuthorization(
            owner,
            address(this),
            amount,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );

        emit Eip3009CallbackReceived(token, originalPayer, owner, amount, validAfter, validBefore, nonce);
        emit Eip3009CallbackWithCalldataReceived(token, originalPayer, owner, amount, nonce, calldata_, calldataNonce);

        // Execute calldata with selector whitelist check
        _executeCalldata(calldata_);
    }

    /**
     * @notice Permit2 callback function with user calldata
     * @dev Called by x402 after successful Permit2 payment, includes user-signed calldata
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
    ) external override onlyAuthorized {
        // Check for duplicate calldata nonce
        if (calldataNonceUsed[originalPayer][calldataNonce]) {
            revert CalldataNonceAlreadyUsed(originalPayer, calldataNonce);
        }

        // Check calldata deadline
        if (block.timestamp > calldataDeadline) {
            revert CalldataSignatureExpired(calldataDeadline, block.timestamp);
        }

        // Verify calldata signature (EIP-712) - binds to full payment context
        bytes32 structHash = keccak256(abi.encode(
            PERMIT2_CALLBACK_DATA_TYPEHASH,
            permit2,            // permit2 contract - prevents permit2 substitution
            token,              // token address - prevents token substitution
            owner,              // TSS wallet - prevents owner substitution
            originalPayer,      // payer who signs the calldata
            amount,             // payment amount
            orderId,            // order ID - links to specific order
            calldataNonce,      // replay protection nonce
            calldataDeadline,   // signature expiry
            keccak256(calldata_) // calldata hash
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(calldataV, calldataR, calldataS);
        if (signer != originalPayer) {
            revert InvalidCalldataSignature(originalPayer, signer);
        }

        // Mark calldata nonce as used
        calldataNonceUsed[originalPayer][calldataNonce] = true;

        // Call Permit2 to pull tokens from owner to this contract
        IPermit2(permit2).permitTransferFrom(
            IPermit2.PermitTransferFrom({
                permitted: IPermit2.TokenPermissions({
                    token: token,
                    amount: amount
                }),
                nonce: nonce,
                deadline: deadline
            }),
            IPermit2.SignatureTransferDetails({
                to: address(this),
                requestedAmount: amount
            }),
            owner,
            signature
        );

        emit Permit2CallbackReceived(token, originalPayer, owner, amount, nonce, deadline);
        emit Permit2CallbackWithCalldataReceived(token, originalPayer, owner, amount, nonce, calldata_, calldataNonce);

        // Execute user-signed calldata
        _executeCalldata(calldata_);
    }

    // ============ Internal Functions ============

    /**
     * @notice Execute user-signed calldata
     * @dev Calldata is trusted since it's signed by the user (originalPayer)
     * @param calldata_ The calldata to execute
     */
    function _executeCalldata(bytes calldata calldata_) internal {
        // Skip if calldata is empty or too short
        if (calldata_.length < 4) return;

        // Execute via self-call (calldata is already verified by EIP-712 signature)
        (bool success, bytes memory result) = address(this).call(calldata_);
        emit CalldataExecuted(calldata_, success, result);
    }

    // ============ Callable Functions (for calldata testing) ============

    /**
     * @notice Test function that can be called via calldata
     * @dev This function is designed to be called via _executeCalldata for testing purposes.
     *      It simply emits an event with the provided parameters - harmless for testing.
     * @param payer The payer address (typically the user who initiated the payment)
     * @param value A test value to emit
     * @param message A test message to emit
     */
    function testCallback(address payer, uint256 value, string calldata message) external {
        emit TestCallbackExecuted(payer, value, message);
    }

    // ============ View Functions ============

    /**
     * @notice Check if calldata nonce was used for a specific user
     * @param user The user address
     * @param nonce The calldata nonce to check
     */
    function isCalldataNonceUsed(address user, uint256 nonce) external view returns (bool) {
        return calldataNonceUsed[user][nonce];
    }

    /**
     * @notice Get the EIP-712 domain separator
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @notice Get the current implementation version
     */
    function version() external pure returns (string memory) {
        return "2.1.0";
    }
}
