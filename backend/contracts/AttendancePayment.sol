// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract AttendancePayment {
    address public admin;
    IERC20 public paymentToken;
    
    // Constants
    uint256 public constant HOURLY_RATE = 2; // 2 USDT per hour
    uint256 public constant MINIMUM_HOURS = 4; // Minimum 4 hours to receive payment
    uint8 public constant RATE_DECIMALS = 18; // USDT has 18 decimals
    
    // Mapping to track payments per day per employee
    mapping(string => mapping(string => bool)) public hasPaid; // employeeDid => date => paid
    
    // Events
    event AttendancePaid(
        string indexed employeeDid,
        address indexed employeeWallet,
        string date,
        uint256 hoursWorked,
        uint256 amountPaid,
        uint256 timestamp
    );
    
    event PaymentRejected(
        string indexed employeeDid,
        string date,
        uint256 hoursWorked,
        string reason
    );
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    constructor(address _tokenAddress) {
        admin = msg.sender;
        paymentToken = IERC20(_tokenAddress);
    }
    
    /**
     * @dev Pay attendance salary automatically when employee checks out
     * @param _employeeDid Employee DID identifier
     * @param _employeeWallet Employee wallet address to receive payment
     * @param _date Date of attendance (YYYY-MM-DD format)
     * @param _hoursWorked Total hours worked (in hours * 100, e.g., 850 for 8.50 hours)
     * @param _amountInTokenUnits Amount to pay in token units (already calculated by backend)
     */
    function payAttendance(
        string memory _employeeDid,
        address _employeeWallet,
        string memory _date,
        uint256 _hoursWorked,
        uint256 _amountInTokenUnits
    ) external {
        // Only admin can call this function (backend service)
        require(msg.sender == admin, "Only admin can process payments");
        
        // Check if already paid for this date
        require(!hasPaid[_employeeDid][_date], "Already paid for this date");
        
        // Validate minimum hours requirement (hours are passed as integer * 100, e.g., 400 = 4.00 hours)
        require(_hoursWorked >= (MINIMUM_HOURS * 100), "Minimum 4 hours required");
        
        // Validate amount is greater than 0
        require(_amountInTokenUnits > 0, "Invalid payment amount");
        
        // Check contract balance
        uint256 contractBalance = paymentToken.balanceOf(address(this));
        require(contractBalance >= _amountInTokenUnits, "Insufficient contract balance");
        
        // Transfer tokens to employee
        bool success = paymentToken.transfer(_employeeWallet, _amountInTokenUnits);
        require(success, "Token transfer failed");
        
        // Mark as paid
        hasPaid[_employeeDid][_date] = true;
        
        // Emit event
        emit AttendancePaid(
            _employeeDid,
            _employeeWallet,
            _date,
            _hoursWorked,
            _amountInTokenUnits,
            block.timestamp
        );
    }
    
    /**
     * @dev Check if employee has been paid for a specific date
     */
    function checkPaymentStatus(string memory _employeeDid, string memory _date) 
        external 
        view 
        returns (bool) 
    {
        return hasPaid[_employeeDid][_date];
    }
    
    /**
     * @dev Get contract token balance
     */
    function getContractBalance() external view returns (uint256) {
        return paymentToken.balanceOf(address(this));
    }
    
    /**
     * @dev Admin function to deposit tokens to contract
     * Note: Admin needs to approve this contract first, then call depositTokens
     */
    function depositTokens(uint256 _amount) external onlyAdmin {
        uint256 tokenDecimals = uint256(paymentToken.decimals());
        uint256 amountInTokenUnits = _amount * (10 ** tokenDecimals);
        
        bool success = paymentToken.transferFrom(msg.sender, address(this), amountInTokenUnits);
        require(success, "Token deposit failed");
    }
    
    /**
     * @dev Admin function to withdraw tokens from contract (emergency only)
     */
    function withdrawTokens(uint256 _amount) external onlyAdmin {
        uint256 tokenDecimals = uint256(paymentToken.decimals());
        uint256 amountInTokenUnits = _amount * (10 ** tokenDecimals);
        
        bool success = paymentToken.transfer(admin, amountInTokenUnits);
        require(success, "Token withdrawal failed");
    }
    
    /**
     * @dev Change admin (only current admin can call)
     */
    function changeAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid address");
        admin = _newAdmin;
    }
}

