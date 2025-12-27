// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title VotingManagement
 * @dev Smart contract quản lý voting cộng đồng cho phòng ban
 * @notice Voting được thực hiện công khai và minh bạch trên blockchain
 */
contract VotingManagement is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    // ============ Structs ============
    
    /**
     * @dev Thông tin một kỳ ứng tuyển
     */
    struct VotingPeriod {
        string departmentId;
        uint256 periodId;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        bool isEnded;
        string[] candidates; // Danh sách employeeDid ứng viên
        mapping(string => uint256) votes; // employeeDid => số vote
        mapping(address => bool) hasVoted; // Voter address => đã vote chưa
        mapping(address => string) voterChoice; // Voter address => employeeDid đã vote
        address[] voters; // Danh sách người đã vote
    }
    
    /**
     * @dev Thông tin ứng viên trong một kỳ
     */
    struct CandidateInfo {
        string employeeDid;
        address walletAddress;
        uint256 votes;
        bool isRegistered;
    }
    
    // ============ State Variables ============
    
    Counters.Counter private _periodCounter;
    
    // Mapping từ departmentId + periodId đến VotingPeriod
    mapping(string => mapping(uint256 => VotingPeriod)) public votingPeriods;
    
    // Mapping từ departmentId đến periodId hiện tại
    mapping(string => uint256) public currentPeriodId;
    
    // Mapping từ employeeDid + departmentId + periodId đến wallet address
    mapping(string => mapping(string => mapping(uint256 => address))) public candidateWallets;
    
    // ============ Events ============
    
    event VotingPeriodCreated(
        string indexed departmentId,
        uint256 indexed periodId,
        uint256 startTime,
        uint256 endTime
    );
    
    event CandidateRegistered(
        string indexed departmentId,
        uint256 indexed periodId,
        string indexed employeeDid,
        address walletAddress
    );
    
    event VoteCast(
        string indexed departmentId,
        uint256 indexed periodId,
        address indexed voter,
        string candidateDid
    );
    
    event VotingPeriodEnded(
        string indexed departmentId,
        uint256 indexed periodId,
        string winnerDid,
        uint256 winnerVotes
    );
    
    // ============ Modifiers ============
    
    modifier periodExists(string memory departmentId, uint256 periodId) {
        require(
            votingPeriods[departmentId][periodId].periodId > 0,
            "Voting period does not exist"
        );
        _;
    }
    
    modifier periodActive(string memory departmentId, uint256 periodId) {
        VotingPeriod storage period = votingPeriods[departmentId][periodId];
        require(period.isActive, "Voting period is not active");
        require(!period.isEnded, "Voting period has ended");
        require(
            block.timestamp >= period.startTime,
            "Voting period has not started"
        );
        require(
            block.timestamp <= period.endTime,
            "Voting period has ended"
        );
        _;
    }
    
    // ============ Constructor ============
    
    constructor() {}
    
    // ============ Main Functions ============
    
    /**
     * @dev Tạo kỳ ứng tuyển mới cho phòng ban
     * @notice Chỉ owner có thể tạo kỳ ứng tuyển
     */
    function createVotingPeriod(
        string memory departmentId,
        uint256 durationInDays
    ) external onlyOwner {
        require(
            bytes(departmentId).length > 0,
            "Department ID cannot be empty"
        );
        require(
            durationInDays > 0,
            "Duration must be greater than 0"
        );
        
        _periodCounter.increment();
        uint256 newPeriodId = _periodCounter.current();
        
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + (durationInDays * 1 days);
        
        VotingPeriod storage period = votingPeriods[departmentId][newPeriodId];
        period.departmentId = departmentId;
        period.periodId = newPeriodId;
        period.startTime = startTime;
        period.endTime = endTime;
        period.isActive = true;
        period.isEnded = false;
        
        currentPeriodId[departmentId] = newPeriodId;
        
        emit VotingPeriodCreated(departmentId, newPeriodId, startTime, endTime);
    }
    
    /**
     * @dev Ứng viên đăng ký tham gia kỳ ứng tuyển
     * @notice Bất kỳ ai cũng có thể đăng ký (hoặc có thể thêm whitelist nếu cần)
     */
    function registerCandidate(
        string memory departmentId,
        uint256 periodId,
        string memory employeeDid,
        address walletAddress
    ) external nonReentrant periodExists(departmentId, periodId) {
        VotingPeriod storage period = votingPeriods[departmentId][periodId];
        
        require(
            block.timestamp >= period.startTime,
            "Voting period has not started"
        );
        require(
            block.timestamp <= period.endTime,
            "Voting period has ended"
        );
        require(
            bytes(employeeDid).length > 0,
            "Employee DID cannot be empty"
        );
        require(
            walletAddress != address(0),
            "Invalid wallet address"
        );
        
        // Kiểm tra chưa đăng ký
        bool alreadyRegistered = false;
        for (uint256 i = 0; i < period.candidates.length; i++) {
            if (
                keccak256(bytes(period.candidates[i])) ==
                keccak256(bytes(employeeDid))
            ) {
                alreadyRegistered = true;
                break;
            }
        }
        require(!alreadyRegistered, "Candidate already registered");
        
        period.candidates.push(employeeDid);
        period.votes[employeeDid] = 0;
        candidateWallets[employeeDid][departmentId][periodId] = walletAddress;
        
        emit CandidateRegistered(departmentId, periodId, employeeDid, walletAddress);
    }
    
    /**
     * @dev Người dùng vote cho ứng viên
     * @notice Mỗi người chỉ được vote 1 lần trong 1 kỳ
     */
    function vote(
        string memory departmentId,
        uint256 periodId,
        string memory candidateDid
    ) external nonReentrant periodActive(departmentId, periodId) {
        require(
            bytes(candidateDid).length > 0,
            "Candidate DID cannot be empty"
        );
        
        VotingPeriod storage period = votingPeriods[departmentId][periodId];
        
        require(
            !period.hasVoted[msg.sender],
            "Already voted"
        );
        
        // Kiểm tra ứng viên có trong danh sách không
        bool candidateExists = false;
        for (uint256 i = 0; i < period.candidates.length; i++) {
            if (
                keccak256(bytes(period.candidates[i])) ==
                keccak256(bytes(candidateDid))
            ) {
                candidateExists = true;
                break;
            }
        }
        require(candidateExists, "Candidate does not exist");
        
        period.votes[candidateDid]++;
        period.hasVoted[msg.sender] = true;
        period.voterChoice[msg.sender] = candidateDid;
        period.voters.push(msg.sender);
        
        emit VoteCast(departmentId, periodId, msg.sender, candidateDid);
    }
    
    /**
     * @dev Kết thúc kỳ ứng tuyển và xác định người thắng cuộc
     * @notice Chỉ owner có thể kết thúc kỳ (hoặc có thể tự động khi hết thời gian)
     */
    function endVotingPeriod(
        string memory departmentId,
        uint256 periodId
    ) external onlyOwner periodExists(departmentId, periodId) {
        VotingPeriod storage period = votingPeriods[departmentId][periodId];
        
        require(!period.isEnded, "Period already ended");
        require(
            block.timestamp >= period.endTime,
            "Period has not ended yet"
        );
        
        period.isActive = false;
        period.isEnded = true;
        
        // Tìm người thắng cuộc (có số vote cao nhất)
        string memory winnerDid = "";
        uint256 maxVotes = 0;
        
        for (uint256 i = 0; i < period.candidates.length; i++) {
            string memory candidateDid = period.candidates[i];
            uint256 candidateVotes = period.votes[candidateDid];
            
            if (candidateVotes > maxVotes) {
                maxVotes = candidateVotes;
                winnerDid = candidateDid;
            }
        }
        
        emit VotingPeriodEnded(departmentId, periodId, winnerDid, maxVotes);
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Lấy số vote của một ứng viên
     * @notice Interface function cho DepartmentManagement contract
     */
    function getVoteCount(
        string memory employeeDid,
        string memory departmentId,
        uint256 periodId
    ) external view returns (uint256) {
        return votingPeriods[departmentId][periodId].votes[employeeDid];
    }
    
    /**
     * @dev Lấy ứng viên có số vote cao nhất
     * @notice Interface function cho DepartmentManagement contract
     */
    function getTopCandidate(
        string memory departmentId,
        uint256 periodId
    ) external view returns (string memory employeeDid, uint256 votes) {
        VotingPeriod storage period = votingPeriods[departmentId][periodId];
        
        if (period.candidates.length == 0) {
            return ("", 0);
        }
        
        string memory winnerDid = period.candidates[0];
        uint256 maxVotes = period.votes[winnerDid];
        
        for (uint256 i = 1; i < period.candidates.length; i++) {
            string memory candidateDid = period.candidates[i];
            uint256 candidateVotes = period.votes[candidateDid];
            
            if (candidateVotes > maxVotes) {
                maxVotes = candidateVotes;
                winnerDid = candidateDid;
            }
        }
        
        return (winnerDid, maxVotes);
    }
    
    /**
     * @dev Lấy wallet address của ứng viên
     */
    function getCandidateWallet(
        string memory employeeDid,
        string memory departmentId,
        uint256 periodId
    ) external view returns (address) {
        return candidateWallets[employeeDid][departmentId][periodId];
    }
    
    /**
     * @dev Lấy thông tin kỳ ứng tuyển
     */
    function getVotingPeriod(
        string memory departmentId,
        uint256 periodId
    )
        external
        view
        returns (
            uint256 startTime,
            uint256 endTime,
            bool isActive,
            bool isEnded,
            uint256 totalCandidates,
            uint256 totalVotes
        )
    {
        VotingPeriod storage period = votingPeriods[departmentId][periodId];
        
        uint256 votes = 0;
        for (uint256 i = 0; i < period.candidates.length; i++) {
            votes += period.votes[period.candidates[i]];
        }
        
        return (
            period.startTime,
            period.endTime,
            period.isActive,
            period.isEnded,
            period.candidates.length,
            votes
        );
    }
    
    /**
     * @dev Lấy danh sách ứng viên
     */
    function getCandidates(
        string memory departmentId,
        uint256 periodId
    ) external view returns (string[] memory) {
        return votingPeriods[departmentId][periodId].candidates;
    }
    
    /**
     * @dev Kiểm tra người dùng đã vote chưa
     */
    function hasVoted(
        address voter,
        string memory departmentId,
        uint256 periodId
    ) external view returns (bool) {
        return votingPeriods[departmentId][periodId].hasVoted[voter];
    }
    
    /**
     * @dev Lấy lựa chọn vote của người dùng
     */
    function getVoterChoice(
        address voter,
        string memory departmentId,
        uint256 periodId
    ) external view returns (string memory) {
        return votingPeriods[departmentId][periodId].voterChoice[voter];
    }
}

