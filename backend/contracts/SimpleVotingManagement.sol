// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title SimpleVotingManagement
 * @dev Simplified version cho demo - Quản lý voting đơn giản
 */
contract SimpleVotingManagement is Ownable {
    using Counters for Counters.Counter;
    
    struct VotingPeriod {
        string departmentId;
        uint256 periodId;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        bool isEnded;
        string[] candidates;
        mapping(string => uint256) votes;
        mapping(string => address) candidateWallets; // employeeDid => wallet
        mapping(address => bool) hasVoted;
    }
    
    Counters.Counter private _periodCounter;
    
    mapping(string => mapping(uint256 => VotingPeriod)) public votingPeriods;
    mapping(string => uint256) public currentPeriodId;
    
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
    
    /**
     * @dev Tạo kỳ ứng tuyển mới
     */
    function createVotingPeriod(
        string memory departmentId,
        uint256 durationInDays
    ) external onlyOwner {
        require(
            bytes(departmentId).length > 0,
            "Department ID cannot be empty"
        );
        
        _periodCounter.increment();
        uint256 newPeriodId = _periodCounter.current();
        
        VotingPeriod storage period = votingPeriods[departmentId][newPeriodId];
        period.departmentId = departmentId;
        period.periodId = newPeriodId;
        period.startTime = block.timestamp;
        period.endTime = block.timestamp + (durationInDays * 1 days);
        period.isActive = true;
        period.isEnded = false;
        
        currentPeriodId[departmentId] = newPeriodId;
        
        emit VotingPeriodCreated(
            departmentId,
            newPeriodId,
            period.startTime,
            period.endTime
        );
    }
    
    /**
     * @dev Đăng ký ứng viên
     */
    function registerCandidate(
        string memory departmentId,
        uint256 periodId,
        string memory employeeDid,
        address walletAddress
    ) external {
        VotingPeriod storage period = votingPeriods[departmentId][periodId];
        
        require(
            period.isActive && !period.isEnded,
            "Period not active"
        );
        require(
            block.timestamp >= period.startTime && block.timestamp <= period.endTime,
            "Outside voting period"
        );
        require(
            bytes(employeeDid).length > 0,
            "Employee DID cannot be empty"
        );
        require(
            walletAddress != address(0),
            "Invalid wallet address"
        );
        
        // Check chưa đăng ký
        bool exists = false;
        for (uint256 i = 0; i < period.candidates.length; i++) {
            if (
                keccak256(bytes(period.candidates[i])) ==
                keccak256(bytes(employeeDid))
            ) {
                exists = true;
                break;
            }
        }
        require(!exists, "Already registered");
        
        period.candidates.push(employeeDid);
        period.votes[employeeDid] = 0;
        period.candidateWallets[employeeDid] = walletAddress;
        
        emit CandidateRegistered(departmentId, periodId, employeeDid, walletAddress);
    }
    
    /**
     * @dev Vote cho ứng viên
     */
    function vote(
        string memory departmentId,
        uint256 periodId,
        string memory candidateDid
    ) external {
        VotingPeriod storage period = votingPeriods[departmentId][periodId];
        
        require(
            period.isActive && !period.isEnded,
            "Period not active"
        );
        require(
            block.timestamp >= period.startTime && block.timestamp <= period.endTime,
            "Outside voting period"
        );
        require(
            !period.hasVoted[msg.sender],
            "Already voted"
        );
        
        // Check candidate exists
        bool exists = false;
        for (uint256 i = 0; i < period.candidates.length; i++) {
            if (
                keccak256(bytes(period.candidates[i])) ==
                keccak256(bytes(candidateDid))
            ) {
                exists = true;
                break;
            }
        }
        require(exists, "Candidate does not exist");
        
        period.votes[candidateDid]++;
        period.hasVoted[msg.sender] = true;
        
        emit VoteCast(departmentId, periodId, msg.sender, candidateDid);
    }
    
    /**
     * @dev Kết thúc kỳ và xác định người thắng
     */
    function endVotingPeriod(
        string memory departmentId,
        uint256 periodId
    ) external onlyOwner {
        VotingPeriod storage period = votingPeriods[departmentId][periodId];
        
        require(!period.isEnded, "Already ended");
        require(
            block.timestamp >= period.endTime,
            "Period not ended yet"
        );
        
        period.isActive = false;
        period.isEnded = true;
        
        // Tìm người thắng
        string memory winnerDid = "";
        uint256 maxVotes = 0;
        
        for (uint256 i = 0; i < period.candidates.length; i++) {
            uint256 votes = period.votes[period.candidates[i]];
            if (votes > maxVotes) {
                maxVotes = votes;
                winnerDid = period.candidates[i];
            }
        }
        
        emit VotingPeriodEnded(departmentId, periodId, winnerDid, maxVotes);
    }
    
    /**
     * @dev Interface function cho DepartmentManagement
     */
    function getVoteCount(
        string memory employeeDid,
        string memory departmentId,
        uint256 periodId
    ) external view returns (uint256) {
        return votingPeriods[departmentId][periodId].votes[employeeDid];
    }
    
    /**
     * @dev Interface function cho DepartmentManagement
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
            uint256 candidateVotes = period.votes[period.candidates[i]];
            if (candidateVotes > maxVotes) {
                maxVotes = candidateVotes;
                winnerDid = period.candidates[i];
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
        return votingPeriods[departmentId][periodId].candidateWallets[employeeDid];
    }
}

