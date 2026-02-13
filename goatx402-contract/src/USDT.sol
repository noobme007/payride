// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract USDT is ERC20, Ownable {
    uint8 private immutable _decimals;

    /// @notice Deploy USDT with custom decimals
    /// @param initialOwner The initial owner address
    /// @param decimals_ The number of decimals (e.g., 6 for ETH, 18 for BSC)
    constructor(address initialOwner, uint8 decimals_) ERC20("Tether USD", "USDT") Ownable(initialOwner) {
        _decimals = decimals_;
        _mint(initialOwner, 1000000000 * 10 ** _decimals);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
