// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interface cho Test Contract
interface ITestContract {
    function getTestScore(string memory employeeDid, string memory departmentId) 
        external view returns (uint256 score, bool passed);
    function hasPassedTest(string memory employeeDid, string memory departmentId) 
        external view returns (bool);
}

// Interface cho Voting Contract
interface IVotingContract {
    function getVoteCount(string memory employeeDid, string memory departmentId, uint256 periodId) 
        external view returns (uint256);
    function getTopCandidate(string memory departmentId, uint256 periodId) 
        external view returns (string memory employeeDid, uint256 votes);
    function getCandidateWallet(string memory employeeDid, string memory departmentId, uint256 periodId)
        external view returns (address);
}

/**
 * @title DepartmentManagement
 * @dev Smart contract quản lý phòng ban tự động dựa trên điều kiện định nghĩa sẵn
 * @notice Mỗi phòng ban là một instance riêng biệt, điều kiện tham gia được cố định khi deploy
 */
contract DepartmentManagement is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;
    
    // TUSD Token
    IERC20 public tusdToken;
    uint256 public joinRewardAmount; // Số TUSD thưởng khi join department
    
    // ============ Structs ============
    
    /**
     * @dev Cấu hình điều kiện tham gia phòng ban
     */
    struct DepartmentConfig {
        string departmentId;
        string departmentName;
        bool isActive;
        uint256 createdAt;
        // Điều kiện 1: Test chuyên môn
        bool requireTest;
        address testContractAddress; // Address của contract quản lý test
        uint256 minTestScore; // Điểm tối thiểu để pass test
        // Điều kiện 2: Voting cộng đồng
        bool requireVoting;
        address votingContractAddress; // Address của contract quản lý voting
        uint256 minVotes; // Số vote tối thiểu
        uint256 votingPeriod; // Chu kỳ voting (theo tháng)
    }
    
    /**
     * @dev Thông tin nhân viên trong phòng ban
     */
    struct DepartmentMember {
        string employeeDid;
        address walletAddress;
        uint256 joinedAt;
        string qualificationMethod; // "test" hoặc "voting"
        bool isActive;
    }
    
    /**
     * @dev Thông tin kỳ ứng tuyển
     */
    struct ApplicationPeriod {
        uint256 periodId;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        mapping(string => uint256) candidateVotes; // employeeDid => số vote
        string[] candidates; // Danh sách ứng viên
    }
    
    // ============ State Variables ============
    
    Counters.Counter private _departmentCounter;
    Counters.Counter private _periodCounter;
    
    // Mapping từ departmentId đến config
    mapping(string => DepartmentConfig) public departments;
    
    // Mapping từ departmentId đến danh sách members
    mapping(string => DepartmentMember[]) public departmentMembers;
    
    // Mapping từ employeeDid đến danh sách departmentId mà họ tham gia
    mapping(string => string[]) public employeeDepartments;
    
    // Mapping từ departmentId đến các kỳ ứng tuyển
    mapping(string => mapping(uint256 => ApplicationPeriod)) public applicationPeriods;
    
    // Mapping từ departmentId đến periodId hiện tại
    mapping(string => uint256) public currentPeriodId;
    
    // ============ Events ============
    
    event DepartmentCreated(
        string indexed departmentId,
        string departmentName,
        bool requireTest,
        bool requireVoting
    );
    
    event EmployeeJoined(
        string indexed departmentId,
        string indexed employeeDid,
        address walletAddress,
        string qualificationMethod
    );
    
    event EmployeeRemoved(
        string indexed departmentId,
        string indexed employeeDid,
        string reason
    );
    
    event ApplicationPeriodStarted(
        string indexed departmentId,
        uint256 indexed periodId,
        uint256 startTime,
        uint256 endTime
    );
    
    event ApplicationPeriodEnded(
        string indexed departmentId,
        uint256 indexed periodId,
        string winnerDid
    );
    
    event JoinRewardPaid(
        string indexed departmentId,
        string indexed employeeDid,
        address walletAddress,
        uint256 amount
    );
    
    // ============ Modifiers ============
    
    modifier departmentExists(string memory departmentId) {
        require(
            bytes(departments[departmentId].departmentId).length > 0,
            "Department does not exist"
        );
        _;
    }
    
    modifier departmentActive(string memory departmentId) {
        require(
            departments[departmentId].isActive,
            "Department is not active"
        );
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _tusdTokenAddress, uint256 _joinRewardAmount) {
        require(
            _tusdTokenAddress != address(0),
            "Invalid TUSD token address"
        );
        tusdToken = IERC20(_tusdTokenAddress);
        joinRewardAmount = _joinRewardAmount; // Amount in token units (with decimals)
    }
    
    // ============ Main Functions ============
    
    /**
     * @dev Tạo phòng ban mới với cấu hình điều kiện tham gia
     * @notice Chỉ owner có thể tạo phòng ban, cấu hình không thể thay đổi sau khi deploy
     */
    function createDepartment(
        string memory departmentId,
        string memory departmentName,
        bool requireTest,
        address testContractAddress,
        uint256 minTestScore,
        bool requireVoting,
        address votingContractAddress,
        uint256 minVotes,
        uint256 votingPeriod
    ) external onlyOwner {
        require(
            bytes(departmentId).length > 0,
            "Department ID cannot be empty"
        );
        require(
            bytes(departments[departmentId].departmentId).length == 0,
            "Department already exists"
        );
        require(
            requireTest || requireVoting,
            "At least one qualification method must be enabled"
        );
        
        if (requireTest) {
            require(
                testContractAddress != address(0),
                "Test contract address required"
            );
            require(
                minTestScore > 0 && minTestScore <= 100,
                "Invalid min test score"
            );
        }
        
        if (requireVoting) {
            require(
                votingContractAddress != address(0),
                "Voting contract address required"
            );
            require(
                minVotes > 0,
                "Invalid min votes"
            );
        }
        
        departments[departmentId] = DepartmentConfig({
            departmentId: departmentId,
            departmentName: departmentName,
            isActive: true,
            createdAt: block.timestamp,
            requireTest: requireTest,
            testContractAddress: testContractAddress,
            minTestScore: minTestScore,
            requireVoting: requireVoting,
            votingContractAddress: votingContractAddress,
            minVotes: minVotes,
            votingPeriod: votingPeriod
        });
        
        _departmentCounter.increment();
        
        emit DepartmentCreated(
            departmentId,
            departmentName,
            requireTest,
            requireVoting
        );
    }
    
    /**
     * @dev Nhân viên tự động tham gia phòng ban nếu đáp ứng điều kiện
     * @notice Kiểm tra cả 2 điều kiện, chỉ cần thỏa mãn 1 điều kiện là đủ
     */
    function joinDepartment(
        string memory departmentId,
        string memory employeeDid,
        address walletAddress
    ) 
        external 
        nonReentrant
        departmentExists(departmentId)
        departmentActive(departmentId)
    {
        require(
            bytes(employeeDid).length > 0,
            "Employee DID cannot be empty"
        );
        require(
            walletAddress != address(0),
            "Invalid wallet address"
        );
        require(
            !isMemberOfDepartment(departmentId, employeeDid),
            "Already a member of this department"
        );
        
        DepartmentConfig memory config = departments[departmentId];
        string memory qualificationMethod = "";
        bool qualified = false;
        
        // Kiểm tra điều kiện 1: Test chuyên môn
        if (config.requireTest) {
            ITestContract testContract = ITestContract(config.testContractAddress);
            (uint256 score, bool passed) = testContract.getTestScore(employeeDid, departmentId);
            
            if (passed && score >= config.minTestScore) {
                qualified = true;
                qualificationMethod = "test";
            }
        }
        
        // Kiểm tra điều kiện 2: Voting (nếu chưa đủ điều kiện test)
        if (!qualified && config.requireVoting) {
            uint256 currentPeriod = currentPeriodId[departmentId];
            if (currentPeriod > 0) {
                IVotingContract votingContract = IVotingContract(config.votingContractAddress);
                uint256 votes = votingContract.getVoteCount(
                    employeeDid,
                    departmentId,
                    currentPeriod
                );
                
                // Kiểm tra xem có phải người thắng cuộc trong kỳ hiện tại không
                (string memory winnerDid, uint256 winnerVotes) = votingContract.getTopCandidate(
                    departmentId,
                    currentPeriod
                );
                
                if (
                    keccak256(bytes(winnerDid)) == keccak256(bytes(employeeDid)) &&
                    winnerVotes >= config.minVotes &&
                    winnerVotes == votes
                ) {
                    qualified = true;
                    qualificationMethod = "voting";
                }
            }
        }
        
        require(qualified, "Employee does not meet qualification requirements");
        
        // Thêm nhân viên vào phòng ban
        departmentMembers[departmentId].push(DepartmentMember({
            employeeDid: employeeDid,
            walletAddress: walletAddress,
            joinedAt: block.timestamp,
            qualificationMethod: qualificationMethod,
            isActive: true
        }));
        
        employeeDepartments[employeeDid].push(departmentId);
        
        // Thưởng TUSD khi join department thành công
        if (joinRewardAmount > 0) {
            uint256 contractBalance = tusdToken.balanceOf(address(this));
            if (contractBalance >= joinRewardAmount) {
                tusdToken.safeTransfer(walletAddress, joinRewardAmount);
                emit JoinRewardPaid(
                    departmentId,
                    employeeDid,
                    walletAddress,
                    joinRewardAmount
                );
            }
        }
        
        emit EmployeeJoined(
            departmentId,
            employeeDid,
            walletAddress,
            qualificationMethod
        );
    }
    
    /**
     * @dev Kiểm tra xem nhân viên có phải thành viên của phòng ban không
     */
    function isMemberOfDepartment(
        string memory departmentId,
        string memory employeeDid
    ) public view returns (bool) {
        DepartmentMember[] memory members = departmentMembers[departmentId];
        for (uint256 i = 0; i < members.length; i++) {
            if (
                keccak256(bytes(members[i].employeeDid)) == keccak256(bytes(employeeDid)) &&
                members[i].isActive
            ) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Xóa nhân viên khỏi phòng ban (chỉ owner, ví dụ khi vi phạm quy định)
     * @notice Trong hệ thống Web3 thuần túy, có thể thêm cơ chế tự động xóa khi không còn đủ điều kiện
     */
    function removeEmployeeFromDepartment(
        string memory departmentId,
        string memory employeeDid,
        string memory reason
    ) external onlyOwner departmentExists(departmentId) {
        DepartmentMember[] storage members = departmentMembers[departmentId];
        bool found = false;
        
        for (uint256 i = 0; i < members.length; i++) {
            if (
                keccak256(bytes(members[i].employeeDid)) == keccak256(bytes(employeeDid)) &&
                members[i].isActive
            ) {
                members[i].isActive = false;
                found = true;
                break;
            }
        }
        
        require(found, "Employee not found in department");
        
        // Xóa khỏi danh sách employeeDepartments
        string[] storage depts = employeeDepartments[employeeDid];
        for (uint256 i = 0; i < depts.length; i++) {
            if (keccak256(bytes(depts[i])) == keccak256(bytes(departmentId))) {
                depts[i] = depts[depts.length - 1];
                depts.pop();
                break;
            }
        }
        
        emit EmployeeRemoved(departmentId, employeeDid, reason);
    }
    
    /**
     * @dev Bắt đầu kỳ ứng tuyển mới cho phòng ban
     */
    function startApplicationPeriod(
        string memory departmentId
    ) 
        external 
        onlyOwner 
        departmentExists(departmentId)
        departmentActive(departmentId)
    {
        DepartmentConfig memory config = departments[departmentId];
        require(config.requireVoting, "Department does not use voting");
        
        _periodCounter.increment();
        uint256 newPeriodId = _periodCounter.current();
        
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + (config.votingPeriod * 30 days);
        
        ApplicationPeriod storage period = applicationPeriods[departmentId][newPeriodId];
        period.periodId = newPeriodId;
        period.startTime = startTime;
        period.endTime = endTime;
        period.isActive = true;
        
        currentPeriodId[departmentId] = newPeriodId;
        
        emit ApplicationPeriodStarted(
            departmentId,
            newPeriodId,
            startTime,
            endTime
        );
    }
    
    /**
     * @dev Kết thúc kỳ ứng tuyển và tự động thêm người thắng cuộc vào phòng ban
     */
    function endApplicationPeriod(
        string memory departmentId,
        uint256 periodId
    ) 
        external 
        onlyOwner 
        departmentExists(departmentId)
    {
        ApplicationPeriod storage period = applicationPeriods[departmentId][periodId];
        require(period.isActive, "Period is not active");
        require(block.timestamp >= period.endTime, "Period has not ended yet");
        
        DepartmentConfig memory config = departments[departmentId];
        IVotingContract votingContract = IVotingContract(config.votingContractAddress);
        
        (string memory winnerDid, uint256 winnerVotes) = votingContract.getTopCandidate(
            departmentId,
            periodId
        );
        
        period.isActive = false;
        
        // Tự động thêm người thắng cuộc vào phòng ban nếu đủ điều kiện
        if (
            bytes(winnerDid).length > 0 &&
            winnerVotes >= config.minVotes &&
            !isMemberOfDepartment(departmentId, winnerDid)
        ) {
            // Lấy wallet address từ voting contract
            address winnerWallet = votingContract.getCandidateWallet(
                winnerDid,
                departmentId,
                periodId
            );
            
            require(
                winnerWallet != address(0),
                "Winner wallet address not found"
            );
            
            departmentMembers[departmentId].push(DepartmentMember({
                employeeDid: winnerDid,
                walletAddress: winnerWallet,
                joinedAt: block.timestamp,
                qualificationMethod: "voting",
                isActive: true
            }));
            
            employeeDepartments[winnerDid].push(departmentId);
            
            emit EmployeeJoined(
                departmentId,
                winnerDid,
                winnerWallet,
                "voting"
            );
        }
        
        emit ApplicationPeriodEnded(departmentId, periodId, winnerDid);
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Lấy thông tin phòng ban
     */
    function getDepartment(string memory departmentId) 
        external 
        view 
        returns (DepartmentConfig memory) 
    {
        require(
            bytes(departments[departmentId].departmentId).length > 0,
            "Department does not exist"
        );
        return departments[departmentId];
    }
    
    /**
     * @dev Lấy danh sách thành viên của phòng ban
     */
    function getDepartmentMembers(string memory departmentId) 
        external 
        view 
        returns (DepartmentMember[] memory) 
    {
        return departmentMembers[departmentId];
    }
    
    /**
     * @dev Lấy danh sách phòng ban mà nhân viên tham gia
     */
    function getEmployeeDepartments(string memory employeeDid) 
        external 
        view 
        returns (string[] memory) 
    {
        return employeeDepartments[employeeDid];
    }
    
    /**
     * @dev Kiểm tra xem nhân viên có đủ điều kiện tham gia phòng ban không
     */
    function checkQualification(
        string memory departmentId,
        string memory employeeDid
    ) 
        external 
        view 
        returns (bool qualified, string memory method) 
    {
        DepartmentConfig memory config = departments[departmentId];
        
        // Kiểm tra test
        if (config.requireTest) {
            ITestContract testContract = ITestContract(config.testContractAddress);
            (uint256 score, bool passed) = testContract.getTestScore(employeeDid, departmentId);
            if (passed && score >= config.minTestScore) {
                return (true, "test");
            }
        }
        
        // Kiểm tra voting
        if (config.requireVoting) {
            uint256 currentPeriod = currentPeriodId[departmentId];
            if (currentPeriod > 0) {
                IVotingContract votingContract = IVotingContract(config.votingContractAddress);
                (string memory winnerDid, uint256 winnerVotes) = votingContract.getTopCandidate(
                    departmentId,
                    currentPeriod
                );
                
                if (
                    keccak256(bytes(winnerDid)) == keccak256(bytes(employeeDid)) &&
                    winnerVotes >= config.minVotes
                ) {
                    return (true, "voting");
                }
            }
        }
        
        return (false, "");
    }
    
    /**
     * @dev Tắt/bật phòng ban
     */
    function setDepartmentActive(string memory departmentId, bool isActive) 
        external 
        onlyOwner 
        departmentExists(departmentId)
    {
        departments[departmentId].isActive = isActive;
    }
    
    /**
     * @dev Lấy tổng số phòng ban
     */
    function getTotalDepartments() external view returns (uint256) {
        return _departmentCounter.current();
    }
    
    /**
     * @dev Owner nạp TUSD vào contract để thưởng cho nhân viên
     */
    function depositTUSD(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        tusdToken.safeTransferFrom(msg.sender, address(this), amount);
    }
    
    /**
     * @dev Owner rút TUSD từ contract (emergency)
     */
    function withdrawTUSD(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        tusdToken.safeTransfer(msg.sender, amount);
    }
    
    /**
     * @dev Lấy số dư TUSD của contract
     */
    function getTUSDBalance() external view returns (uint256) {
        return tusdToken.balanceOf(address(this));
    }
    
    /**
     * @dev Thay đổi số lượng reward khi join (chỉ owner)
     */
    function setJoinRewardAmount(uint256 _newAmount) external onlyOwner {
        joinRewardAmount = _newAmount;
    }
}

