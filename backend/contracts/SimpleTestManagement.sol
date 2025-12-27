// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SimpleTestManagement
 * @dev Simplified version cho demo - Lưu điểm test đơn giản, không cần câu hỏi chi tiết
 */
contract SimpleTestManagement is Ownable {
    
    // Mapping từ employeeDid + departmentId đến điểm số
    mapping(string => mapping(string => uint256)) public testScores;
    
    // Mapping để check đã làm test chưa
    mapping(string => mapping(string => bool)) public hasTakenTest;
    
    event TestScoreRecorded(
        string indexed departmentId,
        string indexed employeeDid,
        uint256 score
    );
    
    /**
     * @dev Owner ghi điểm test cho nhân viên (simplified cho demo)
     * @notice Trong production có thể thay bằng submit test thật
     */
    function recordTestScore(
        string memory departmentId,
        string memory employeeDid,
        uint256 score
    ) external onlyOwner {
        require(
            bytes(employeeDid).length > 0,
            "Employee DID cannot be empty"
        );
        require(
            score <= 100,
            "Score cannot exceed 100"
        );
        
        testScores[employeeDid][departmentId] = score;
        hasTakenTest[employeeDid][departmentId] = true;
        
        emit TestScoreRecorded(departmentId, employeeDid, score);
    }
    
    /**
     * @dev Interface function cho DepartmentManagement
     */
    function getTestScore(
        string memory employeeDid,
        string memory departmentId
    ) external view returns (uint256 score, bool passed) {
        require(
            hasTakenTest[employeeDid][departmentId],
            "Test not taken"
        );
        
        score = testScores[employeeDid][departmentId];
        passed = true; // Pass nếu đã có điểm
    }
    
    /**
     * @dev Interface function cho DepartmentManagement
     */
    function hasPassedTest(
        string memory employeeDid,
        string memory departmentId
    ) external view returns (bool) {
        return hasTakenTest[employeeDid][departmentId];
    }
}

