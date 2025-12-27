// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract HRPayroll {
    address public admin;
    IERC20 public paymentToken;

    // Khai báo sự kiện (Event) để sửa lỗi "unused variable"
    event SalaryPaid(string employeeDid, address walletAddress, uint256 amount);

    constructor(address _tokenAddress) {
        admin = msg.sender;
        paymentToken = IERC20(_tokenAddress);
    }

    function paySalary(string memory _employeeDid, address _employeeWallet, uint256 _amount) public {
        require(msg.sender == admin, "Only Admin");
        
        // Chuyển tiền
        paymentToken.transfer(_employeeWallet, _amount);
        
        // Ghi log sự kiện (Dòng này giúp biến _employeeDid được sử dụng -> Hết lỗi vàng)
        emit SalaryPaid(_employeeDid, _employeeWallet, _amount);
    }
}

