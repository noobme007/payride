// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {USDC} from "../src/USDC.sol";
import {USDT} from "../src/USDT.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Get decimals from environment, default to 6 if not set
        uint8 tokenDecimals = uint8(vm.envOr("TOKEN_DECIMALS", uint256(6)));

        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying contracts with account:", deployer);
        console.log("Token decimals:", tokenDecimals);

        // Deploy USDC with configurable decimals
        USDC usdc = new USDC(deployer, tokenDecimals);
        console.log("USDC deployed at:", address(usdc));
        console.log("USDC decimals:", usdc.decimals());

        // Deploy USDT with configurable decimals
        USDT usdt = new USDT(deployer, tokenDecimals);
        console.log("USDT deployed at:", address(usdt));
        console.log("USDT decimals:", usdt.decimals());

        vm.stopBroadcast();
    }
}
