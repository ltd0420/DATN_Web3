// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestUSDT is ERC20 {
    constructor() ERC20("Test USDT", "TUSD") {
        // In 1 triệu coin cho người tạo
        _mint(msg.sender, 1000000 * 10 ** 18);
    }
}

