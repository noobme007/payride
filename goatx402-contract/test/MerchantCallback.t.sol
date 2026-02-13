// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MerchantCallback} from "../src/MerchantCallback.sol";
import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Mock EIP-3009 Token
contract MockEip3009Token is ERC20 {
    mapping(bytes32 => bool) public authorizationUsed;

    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 1000000e6);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8,  // v - unused in mock
        bytes32,  // r - unused in mock
        bytes32  // s - unused in mock
    ) external {
        require(block.timestamp >= validAfter, "Authorization not yet valid");
        require(block.timestamp < validBefore, "Authorization expired");
        require(!authorizationUsed[nonce], "Authorization already used");

        authorizationUsed[nonce] = true;
        _transfer(from, to, value);
    }
}

// Mock Permit2
contract MockPermit2 {
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

    mapping(uint256 => bool) public nonceUsed;

    function permitTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata /* signature */
    ) external {
        require(block.timestamp <= permit.deadline, "Permit expired");
        require(!nonceUsed[permit.nonce], "Nonce already used");

        nonceUsed[permit.nonce] = true;
        require(
            IERC20(permit.permitted.token).transferFrom(owner, transferDetails.to, transferDetails.requestedAmount),
            "Transfer failed"
        );
    }
}

contract MerchantCallbackTest is Test {
    MerchantCallback public callback;
    MockEip3009Token public token;
    MockPermit2 public permit2;

    address public owner;
    address public authorizedCaller;
    address public tssWallet;
    address public user;

    // Test signer for EIP-712 signatures
    uint256 constant SIGNER_PRIVATE_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address public signer;

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

    function setUp() public {
        owner = address(this);
        authorizedCaller = address(0x7770000000000000000000000000000000000001);
        tssWallet = address(0x7550000000000000000000000000000000000001);
        user = address(0x1234);
        signer = vm.addr(SIGNER_PRIVATE_KEY);

        // Deploy implementation
        MerchantCallback implementation = new MerchantCallback();

        // Deploy proxy and initialize
        bytes memory initData = abi.encodeWithSelector(
            MerchantCallback.initialize.selector,
            owner
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        callback = MerchantCallback(address(proxy));

        // Authorize the caller
        callback.setAuthorizedCaller(authorizedCaller, true);

        token = new MockEip3009Token();
        permit2 = new MockPermit2();

        // Fund TSS wallet with tokens
        token.mint(tssWallet, 1000000e6);

        // Approve permit2 to spend TSS tokens
        vm.prank(tssWallet);
        token.approve(address(permit2), type(uint256).max);
    }

    // Helper to compute EIP-712 domain separator
    function _computeDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("GoatX402 Pay Callback"),
                keccak256("1"),
                block.chainid,
                address(callback)
            )
        );
    }

    // Helper to sign EIP-3009 calldata with EIP-712
    function _signEip3009Calldata(
        address tokenAddr,
        address ownerAddr,
        address payer,
        uint256 amount,
        bytes32 orderId,
        uint256 calldataNonce,
        uint256 calldataDeadline,
        bytes memory calldata_
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(abi.encode(
            callback.EIP3009_CALLBACK_DATA_TYPEHASH(),
            tokenAddr,
            ownerAddr,
            payer,
            amount,
            orderId,
            calldataNonce,
            calldataDeadline,
            keccak256(calldata_)
        ));

        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            _computeDomainSeparator(),
            structHash
        ));

        (v, r, s) = vm.sign(SIGNER_PRIVATE_KEY, digest);
    }

    // Helper to sign Permit2 calldata with EIP-712
    function _signPermit2Calldata(
        address permit2Addr,
        address tokenAddr,
        address ownerAddr,
        address payer,
        uint256 amount,
        bytes32 orderId,
        uint256 calldataNonce,
        uint256 calldataDeadline,
        bytes memory calldata_
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(abi.encode(
            callback.PERMIT2_CALLBACK_DATA_TYPEHASH(),
            permit2Addr,
            tokenAddr,
            ownerAddr,
            payer,
            amount,
            orderId,
            calldataNonce,
            calldataDeadline,
            keccak256(calldata_)
        ));

        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            _computeDomainSeparator(),
            structHash
        ));

        (v, r, s) = vm.sign(SIGNER_PRIVATE_KEY, digest);
    }

    function testEip3009Callback() public {
        uint256 amount = 1000e6;
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 nonce = keccak256(abi.encodePacked("test_nonce_1"));
        uint8 v = 27;
        bytes32 r = keccak256(abi.encodePacked("r_value"));
        bytes32 s = keccak256(abi.encodePacked("s_value"));

        // Check initial balances
        uint256 tssBalanceBefore = token.balanceOf(tssWallet);
        uint256 callbackBalanceBefore = token.balanceOf(address(callback));

        // Expect event
        vm.expectEmit(true, true, true, true);
        emit Eip3009CallbackReceived(
            address(token),
            user,
            tssWallet,
            amount,
            validAfter,
            validBefore,
            nonce
        );

        // Call callback as authorized caller
        vm.prank(authorizedCaller);
        callback.x402SpentEip3009(
            address(token),
            user,
            tssWallet,
            amount,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );

        // Verify token transfer
        assertEq(token.balanceOf(tssWallet), tssBalanceBefore - amount);
        assertEq(token.balanceOf(address(callback)), callbackBalanceBefore + amount);
    }

    function testPermit2Callback() public {
        uint256 amount = 2000e6;
        uint256 nonce = 12345;
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = abi.encodePacked("test_signature");

        // Check initial balances
        uint256 tssBalanceBefore = token.balanceOf(tssWallet);
        uint256 callbackBalanceBefore = token.balanceOf(address(callback));

        // Expect event
        vm.expectEmit(true, true, true, true);
        emit Permit2CallbackReceived(
            address(token),
            user,
            tssWallet,
            amount,
            nonce,
            deadline
        );

        // Call callback as authorized caller
        vm.prank(authorizedCaller);
        callback.x402SpentPermit2(
            address(permit2),
            address(token),
            user,
            tssWallet,
            amount,
            nonce,
            deadline,
            signature
        );

        // Verify token transfer
        assertEq(token.balanceOf(tssWallet), tssBalanceBefore - amount);
        assertEq(token.balanceOf(address(callback)), callbackBalanceBefore + amount);
    }

    function testUnauthorizedCallerEip3009() public {
        // Call from unauthorized address should revert
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(MerchantCallback.UnauthorizedCaller.selector, user));
        callback.x402SpentEip3009(
            address(token),
            user,
            tssWallet,
            1000e6,
            block.timestamp,
            block.timestamp + 1 hours,
            keccak256(abi.encodePacked("nonce")),
            27,
            keccak256(abi.encodePacked("r")),
            keccak256(abi.encodePacked("s"))
        );
    }

    function testUnauthorizedCallerPermit2() public {
        // Call from unauthorized address should revert
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(MerchantCallback.UnauthorizedCaller.selector, user));
        callback.x402SpentPermit2(
            address(permit2),
            address(token),
            user,
            tssWallet,
            1000e6,
            123,
            block.timestamp + 1 hours,
            abi.encodePacked("signature")
        );
    }

    function testSetAuthorizedCaller() public {
        address newCaller = address(0x9999);

        // Initially not authorized
        assertFalse(callback.authorizedCallers(newCaller));

        // Authorize
        vm.expectEmit(true, false, false, true);
        emit AuthorizedCallerUpdated(newCaller, true);
        callback.setAuthorizedCaller(newCaller, true);
        assertTrue(callback.authorizedCallers(newCaller));

        // Deauthorize
        vm.expectEmit(true, false, false, true);
        emit AuthorizedCallerUpdated(newCaller, false);
        callback.setAuthorizedCaller(newCaller, false);
        assertFalse(callback.authorizedCallers(newCaller));
    }

    function testBatchSetAuthorizedCallers() public {
        address[] memory callers = new address[](2);
        callers[0] = address(0x1111);
        callers[1] = address(0x2222);

        bool[] memory authorized = new bool[](2);
        authorized[0] = true;
        authorized[1] = true;

        callback.setAuthorizedCallers(callers, authorized);

        assertTrue(callback.authorizedCallers(callers[0]));
        assertTrue(callback.authorizedCallers(callers[1]));
    }

    function testWithdrawTokens() public {
        // First receive some tokens via callback
        vm.prank(authorizedCaller);
        callback.x402SpentEip3009(
            address(token),
            user,
            tssWallet,
            1000e6,
            block.timestamp,
            block.timestamp + 1 hours,
            keccak256(abi.encodePacked("nonce")),
            27,
            keccak256(abi.encodePacked("r")),
            keccak256(abi.encodePacked("s"))
        );

        assertEq(token.balanceOf(address(callback)), 1000e6);

        // Withdraw tokens
        address recipient = address(0xBEEF);
        uint256 withdrawAmount = 500e6;

        vm.expectEmit(true, true, false, true);
        emit TokensWithdrawn(address(token), recipient, withdrawAmount);

        callback.withdrawTokens(address(token), recipient, withdrawAmount);

        assertEq(token.balanceOf(address(callback)), 500e6);
        assertEq(token.balanceOf(recipient), withdrawAmount);
    }

    function testOnlyOwnerFunctions() public {
        vm.prank(user);
        vm.expectRevert();
        callback.setAuthorizedCaller(user, true);

        vm.prank(user);
        vm.expectRevert();
        callback.withdrawTokens(address(token), user, 100);
    }

    // ============ Tests for Calldata Callback Functions ============

    function testEip3009CallbackWithCalldata() public {
        token.mint(tssWallet, 100000e6);

        uint256 amount = 1000e6;
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 eip3009Nonce = keccak256(abi.encodePacked("eip3009_nonce_1"));
        uint8 v = 27;
        bytes32 r = keccak256(abi.encodePacked("r_value"));
        bytes32 s = keccak256(abi.encodePacked("s_value"));

        bytes memory calldata_ = hex"1234567890abcdef";
        bytes32 orderId = keccak256(abi.encodePacked("order_123"));
        uint256 calldataNonce = 1;
        uint256 calldataDeadline = block.timestamp + 1 hours;

        // Sign the calldata with new EIP-712 structure (binds to orderId)
        (uint8 calldataV, bytes32 calldataR, bytes32 calldataS) = _signEip3009Calldata(
            address(token),
            tssWallet,
            signer,
            amount,
            orderId,
            calldataNonce,
            calldataDeadline,
            calldata_
        );

        // Expect events
        vm.expectEmit(true, true, true, true);
        emit Eip3009CallbackReceived(address(token), signer, tssWallet, amount, validAfter, validBefore, eip3009Nonce);

        vm.expectEmit(true, true, true, true);
        emit Eip3009CallbackWithCalldataReceived(address(token), signer, tssWallet, amount, eip3009Nonce, calldata_, calldataNonce);

        // Call callback with calldata as authorized caller
        vm.prank(authorizedCaller);
        callback.x402SpentEip3009WithCalldata(
            address(token),
            signer,
            tssWallet,
            amount,
            validAfter,
            validBefore,
            eip3009Nonce,
            v,
            r,
            s,
            calldata_,
            orderId,
            calldataNonce,
            calldataDeadline,
            calldataV,
            calldataR,
            calldataS
        );

        // Verify calldata nonce was used
        assertTrue(callback.isCalldataNonceUsed(signer, calldataNonce));

        // Verify token transfer
        assertEq(token.balanceOf(address(callback)), amount);
    }

    function testPermit2CallbackWithCalldata() public {
        token.mint(tssWallet, 100000e6);
        vm.prank(tssWallet);
        token.approve(address(permit2), type(uint256).max);

        uint256 amount = 2000e6;
        uint256 permit2Nonce = 12345;
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory permit2Signature = abi.encodePacked("permit2_signature");

        bytes memory calldata_ = hex"deadbeef";
        bytes32 orderId = keccak256(abi.encodePacked("order_456"));
        uint256 calldataNonce = 1;
        uint256 calldataDeadline = block.timestamp + 1 hours;

        // Sign the calldata with new EIP-712 structure (binds to orderId)
        (uint8 calldataV, bytes32 calldataR, bytes32 calldataS) = _signPermit2Calldata(
            address(permit2),
            address(token),
            tssWallet,
            signer,
            amount,
            orderId,
            calldataNonce,
            calldataDeadline,
            calldata_
        );

        // Expect events
        vm.expectEmit(true, true, true, true);
        emit Permit2CallbackReceived(address(token), signer, tssWallet, amount, permit2Nonce, deadline);

        vm.expectEmit(true, true, true, true);
        emit Permit2CallbackWithCalldataReceived(address(token), signer, tssWallet, amount, permit2Nonce, calldata_, calldataNonce);

        // Call callback with calldata as authorized caller
        vm.prank(authorizedCaller);
        callback.x402SpentPermit2WithCalldata(
            address(permit2),
            address(token),
            signer,
            tssWallet,
            amount,
            permit2Nonce,
            deadline,
            permit2Signature,
            calldata_,
            orderId,
            calldataNonce,
            calldataDeadline,
            calldataV,
            calldataR,
            calldataS
        );

        // Verify calldata nonce was used
        assertTrue(callback.isCalldataNonceUsed(signer, calldataNonce));

        // Verify token transfer
        assertEq(token.balanceOf(address(callback)), amount);
    }

    function testEip3009WithCalldataInvalidSignature() public {
        token.mint(tssWallet, 100000e6);

        uint256 amount = 1000e6;
        bytes32 eip3009Nonce = keccak256(abi.encodePacked("nonce"));
        bytes memory calldata_ = hex"1234";
        bytes32 orderId = keccak256(abi.encodePacked("order_invalid_sig"));
        uint256 calldataNonce = 1;
        uint256 calldataDeadline = block.timestamp + 1 hours;

        // Sign with signer but claim different originalPayer
        (uint8 calldataV, bytes32 calldataR, bytes32 calldataS) = _signEip3009Calldata(
            address(token),
            tssWallet,
            signer,  // Sign as signer
            amount,
            orderId,
            calldataNonce,
            calldataDeadline,
            calldata_
        );

        // Pass different originalPayer - should fail signature verification
        // When the originalPayer doesn't match, the struct hash is different,
        // so ECDSA recovery produces a random address (not signer)
        vm.prank(authorizedCaller);
        vm.expectRevert();  // Will revert with InvalidCalldataSignature
        callback.x402SpentEip3009WithCalldata(
            address(token),
            address(0xDEAD),  // Different from signer
            tssWallet,
            amount,
            block.timestamp,
            block.timestamp + 1 hours,
            eip3009Nonce,
            27,
            bytes32(0),
            bytes32(0),
            calldata_,
            orderId,
            calldataNonce,
            calldataDeadline,
            calldataV,
            calldataR,
            calldataS
        );
    }

    function testPermit2WithCalldataInvalidSignature() public {
        token.mint(tssWallet, 100000e6);
        vm.prank(tssWallet);
        token.approve(address(permit2), type(uint256).max);

        uint256 amount = 1000e6;
        uint256 permit2Nonce = 123;
        bytes memory calldata_ = hex"1234";
        bytes32 orderId = keccak256(abi.encodePacked("order_permit2_invalid"));
        uint256 calldataNonce = 1;
        uint256 calldataDeadline = block.timestamp + 1 hours;

        // Sign with signer but claim different originalPayer
        (uint8 calldataV, bytes32 calldataR, bytes32 calldataS) = _signPermit2Calldata(
            address(permit2),
            address(token),
            tssWallet,
            signer,  // Sign as signer
            amount,
            orderId,
            calldataNonce,
            calldataDeadline,
            calldata_
        );

        // Pass different originalPayer - should fail
        // When the originalPayer doesn't match, the struct hash is different,
        // so ECDSA recovery produces a random address (not signer)
        vm.prank(authorizedCaller);
        vm.expectRevert();  // Will revert with InvalidCalldataSignature
        callback.x402SpentPermit2WithCalldata(
            address(permit2),
            address(token),
            address(0xDEAD),  // Different from signer
            tssWallet,
            amount,
            permit2Nonce,
            block.timestamp + 1 hours,
            hex"",
            calldata_,
            orderId,
            calldataNonce,
            calldataDeadline,
            calldataV,
            calldataR,
            calldataS
        );
    }

    function testEip3009WithCalldataExpiredDeadline() public {
        token.mint(tssWallet, 100000e6);

        uint256 amount = 1000e6;
        bytes32 eip3009Nonce = keccak256(abi.encodePacked("nonce"));
        bytes memory calldata_ = hex"1234";
        bytes32 orderId = keccak256(abi.encodePacked("order_expired"));
        uint256 calldataNonce = 1;
        uint256 calldataDeadline = block.timestamp - 1;  // Expired!

        (uint8 calldataV, bytes32 calldataR, bytes32 calldataS) = _signEip3009Calldata(
            address(token), tssWallet, signer, amount, orderId, calldataNonce, calldataDeadline, calldata_
        );

        vm.prank(authorizedCaller);
        vm.expectRevert(abi.encodeWithSelector(
            MerchantCallback.CalldataSignatureExpired.selector,
            calldataDeadline,
            block.timestamp
        ));
        callback.x402SpentEip3009WithCalldata(
            address(token),
            signer,
            tssWallet,
            amount, block.timestamp, block.timestamp + 1 hours,
            eip3009Nonce, 27, bytes32(0), bytes32(0),
            calldata_, orderId, calldataNonce, calldataDeadline, calldataV, calldataR, calldataS
        );
    }

    function testEip3009WithCalldataDuplicateNonce() public {
        token.mint(tssWallet, 200000e6);

        uint256 amount = 1000e6;
        bytes32 eip3009Nonce1 = keccak256(abi.encodePacked("nonce1"));
        bytes32 eip3009Nonce2 = keccak256(abi.encodePacked("nonce2"));
        bytes memory calldata_ = hex"1234";
        bytes32 orderId1 = keccak256(abi.encodePacked("order_dup_1"));
        bytes32 orderId2 = keccak256(abi.encodePacked("order_dup_2"));
        uint256 calldataNonce = 1;  // Same calldata nonce for both calls
        uint256 calldataDeadline = block.timestamp + 1 hours;

        // Sign for first call with orderId1
        (uint8 calldataV1, bytes32 calldataR1, bytes32 calldataS1) = _signEip3009Calldata(
            address(token), tssWallet, signer, amount, orderId1, calldataNonce, calldataDeadline, calldata_
        );

        // First call succeeds
        vm.prank(authorizedCaller);
        callback.x402SpentEip3009WithCalldata(
            address(token),
            signer,
            tssWallet,
            amount, block.timestamp, block.timestamp + 1 hours,
            eip3009Nonce1, 27, bytes32(0), bytes32(0),
            calldata_, orderId1, calldataNonce, calldataDeadline, calldataV1, calldataR1, calldataS1
        );

        // Sign for second call with orderId2 but same calldataNonce
        (uint8 calldataV2, bytes32 calldataR2, bytes32 calldataS2) = _signEip3009Calldata(
            address(token), tssWallet, signer, amount, orderId2, calldataNonce, calldataDeadline, calldata_
        );

        // Second call with same calldata nonce should fail (even with valid signature)
        vm.prank(authorizedCaller);
        vm.expectRevert(abi.encodeWithSelector(
            MerchantCallback.CalldataNonceAlreadyUsed.selector,
            signer,
            calldataNonce
        ));
        callback.x402SpentEip3009WithCalldata(
            address(token),
            signer,
            tssWallet,
            amount, block.timestamp, block.timestamp + 1 hours,
            eip3009Nonce2, 27, bytes32(0), bytes32(0),
            calldata_, orderId2, calldataNonce, calldataDeadline, calldataV2, calldataR2, calldataS2
        );
    }

    function testDomainSeparator() public view {
        bytes32 domainSeparator = callback.getDomainSeparator();
        bytes32 expectedDomainSeparator = _computeDomainSeparator();
        assertEq(domainSeparator, expectedDomainSeparator);
    }

    function testVersion() public view {
        assertEq(callback.version(), "2.1.0");
    }
}
