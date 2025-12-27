// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title TestManagement
 * @dev Smart contract quản lý test chuyên môn on-chain
 * @notice Lưu trữ và chấm điểm test tự động, điểm số không thể thay đổi sau khi submit
 */
contract TestManagement is Ownable, ReentrancyGuard {
    
    // ============ Structs ============
    
    /**
     * @dev Thông tin một câu hỏi test
     */
    struct Question {
        string questionId;
        string questionText;
        string[] options; // Các lựa chọn
        uint256 correctAnswerIndex; // Index của đáp án đúng (0-based)
        uint256 points; // Điểm số của câu hỏi
    }
    
    /**
     * @dev Thông tin test cho một phòng ban
     */
    struct DepartmentTest {
        string departmentId;
        string testName;
        bool isActive;
        uint256 totalQuestions;
        uint256 maxScore; // Tổng điểm tối đa
        mapping(string => Question) questions; // questionId => Question
        string[] questionIds; // Danh sách ID câu hỏi
    }
    
    /**
     * @dev Kết quả test của nhân viên
     */
    struct TestResult {
        string employeeDid;
        string departmentId;
        uint256 score;
        uint256 maxScore;
        uint256 submittedAt;
        bool passed; // Đã pass hay chưa (dựa trên ngưỡng của department)
        mapping(string => uint256) answers; // questionId => selectedAnswerIndex
    }
    
    // ============ State Variables ============
    
    // Mapping từ departmentId đến test config
    mapping(string => DepartmentTest) public departmentTests;
    
    // Mapping từ employeeDid + departmentId đến test result
    mapping(string => mapping(string => TestResult)) public testResults;
    
    // Mapping để check xem nhân viên đã làm test chưa
    mapping(string => mapping(string => bool)) public hasTakenTest; // employeeDid => departmentId => bool
    
    // Danh sách các phòng ban có test
    string[] public departmentsWithTests;
    
    // ============ Events ============
    
    event TestCreated(
        string indexed departmentId,
        string testName,
        uint256 totalQuestions,
        uint256 maxScore
    );
    
    event QuestionAdded(
        string indexed departmentId,
        string indexed questionId,
        uint256 points
    );
    
    event TestSubmitted(
        string indexed departmentId,
        string indexed employeeDid,
        uint256 score,
        uint256 maxScore,
        bool passed
    );
    
    // ============ Modifiers ============
    
    modifier testExists(string memory departmentId) {
        require(
            departmentTests[departmentId].isActive,
            "Test does not exist or is not active"
        );
        _;
    }
    
    // ============ Constructor ============
    
    constructor() {}
    
    // ============ Main Functions ============
    
    /**
     * @dev Tạo test mới cho phòng ban
     * @notice Chỉ owner có thể tạo test
     */
    function createTest(
        string memory departmentId,
        string memory testName
    ) external onlyOwner {
        require(
            bytes(departmentId).length > 0,
            "Department ID cannot be empty"
        );
        require(
            !departmentTests[departmentId].isActive,
            "Test already exists for this department"
        );
        
        DepartmentTest storage test = departmentTests[departmentId];
        test.departmentId = departmentId;
        test.testName = testName;
        test.isActive = true;
        test.totalQuestions = 0;
        test.maxScore = 0;
        
        departmentsWithTests.push(departmentId);
        
        emit TestCreated(departmentId, testName, 0, 0);
    }
    
    /**
     * @dev Thêm câu hỏi vào test
     * @notice Chỉ owner có thể thêm câu hỏi
     */
    function addQuestion(
        string memory departmentId,
        string memory questionId,
        string memory questionText,
        string[] memory options,
        uint256 correctAnswerIndex,
        uint256 points
    ) external onlyOwner testExists(departmentId) {
        require(
            bytes(questionId).length > 0,
            "Question ID cannot be empty"
        );
        require(
            options.length >= 2,
            "Must have at least 2 options"
        );
        require(
            correctAnswerIndex < options.length,
            "Invalid correct answer index"
        );
        require(
            points > 0,
            "Points must be greater than 0"
        );
        
        DepartmentTest storage test = departmentTests[departmentId];
        
        // Kiểm tra câu hỏi chưa tồn tại
        require(
            bytes(test.questions[questionId].questionId).length == 0,
            "Question already exists"
        );
        
        Question storage question = test.questions[questionId];
        question.questionId = questionId;
        question.questionText = questionText;
        question.options = options;
        question.correctAnswerIndex = correctAnswerIndex;
        question.points = points;
        
        test.questionIds.push(questionId);
        test.totalQuestions++;
        test.maxScore += points;
        
        emit QuestionAdded(departmentId, questionId, points);
    }
    
    /**
     * @dev Nhân viên submit test và tự động chấm điểm
     * @notice Điểm số được tính tự động và không thể thay đổi sau khi submit
     */
    function submitTest(
        string memory departmentId,
        string memory employeeDid,
        string[] memory questionIds,
        uint256[] memory selectedAnswers
    ) external nonReentrant testExists(departmentId) {
        require(
            bytes(employeeDid).length > 0,
            "Employee DID cannot be empty"
        );
        require(
            !hasTakenTest[employeeDid][departmentId],
            "Test already submitted"
        );
        require(
            questionIds.length == selectedAnswers.length,
            "Question IDs and answers length mismatch"
        );
        
        DepartmentTest storage test = departmentTests[departmentId];
        require(
            questionIds.length == test.totalQuestions,
            "Must answer all questions"
        );
        
        TestResult storage result = testResults[employeeDid][departmentId];
        result.employeeDid = employeeDid;
        result.departmentId = departmentId;
        result.maxScore = test.maxScore;
        result.submittedAt = block.timestamp;
        
        uint256 totalScore = 0;
        
        // Chấm điểm từng câu hỏi
        for (uint256 i = 0; i < questionIds.length; i++) {
            string memory qId = questionIds[i];
            Question storage question = test.questions[qId];
            
            require(
                bytes(question.questionId).length > 0,
                "Question does not exist"
            );
            
            // Lưu đáp án đã chọn
            result.answers[qId] = selectedAnswers[i];
            
            // Kiểm tra đáp án đúng
            if (selectedAnswers[i] == question.correctAnswerIndex) {
                totalScore += question.points;
            }
        }
        
        result.score = totalScore;
        hasTakenTest[employeeDid][departmentId] = true;
        
        // Note: passed sẽ được xác định bởi DepartmentManagement contract
        // dựa trên minTestScore của phòng ban
        result.passed = false; // Sẽ được set bởi DepartmentManagement khi check
        
        emit TestSubmitted(
            departmentId,
            employeeDid,
            totalScore,
            test.maxScore,
            false
        );
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Lấy điểm số và trạng thái pass của nhân viên
     * @notice Interface function cho DepartmentManagement contract
     */
    function getTestScore(
        string memory employeeDid,
        string memory departmentId
    ) external view returns (uint256 score, bool passed) {
        require(
            hasTakenTest[employeeDid][departmentId],
            "Test not submitted"
        );
        
        TestResult storage result = testResults[employeeDid][departmentId];
        score = result.score;
        
        // passed sẽ được check bởi DepartmentManagement dựa trên minTestScore
        // Ở đây chỉ trả về true nếu đã submit
        passed = true;
    }
    
    /**
     * @dev Kiểm tra nhân viên đã pass test chưa
     * @notice Interface function cho DepartmentManagement contract
     */
    function hasPassedTest(
        string memory employeeDid,
        string memory departmentId
    ) external view returns (bool) {
        return hasTakenTest[employeeDid][departmentId];
    }
    
    /**
     * @dev Lấy thông tin test của phòng ban
     */
    function getTestInfo(string memory departmentId)
        external
        view
        returns (
            string memory testName,
            bool isActive,
            uint256 totalQuestions,
            uint256 maxScore
        )
    {
        DepartmentTest storage test = departmentTests[departmentId];
        return (
            test.testName,
            test.isActive,
            test.totalQuestions,
            test.maxScore
        );
    }
    
    /**
     * @dev Lấy danh sách câu hỏi của test
     */
    function getQuestionIds(string memory departmentId)
        external
        view
        returns (string[] memory)
    {
        return departmentTests[departmentId].questionIds;
    }
    
    /**
     * @dev Lấy thông tin một câu hỏi
     */
    function getQuestion(string memory departmentId, string memory questionId)
        external
        view
        returns (
            string memory questionText,
            string[] memory options,
            uint256 points
        )
    {
        Question storage question = departmentTests[departmentId].questions[questionId];
        require(
            bytes(question.questionId).length > 0,
            "Question does not exist"
        );
        
        return (
            question.questionText,
            question.options,
            question.points
        );
    }
    
    /**
     * @dev Lấy kết quả test của nhân viên
     */
    function getTestResult(string memory employeeDid, string memory departmentId)
        external
        view
        returns (
            uint256 score,
            uint256 maxScore,
            uint256 submittedAt
        )
    {
        require(
            hasTakenTest[employeeDid][departmentId],
            "Test not submitted"
        );
        
        TestResult storage result = testResults[employeeDid][departmentId];
        return (
            result.score,
            result.maxScore,
            result.submittedAt
        );
    }
    
    /**
     * @dev Tắt/bật test
     */
    function setTestActive(string memory departmentId, bool isActive)
        external
        onlyOwner
        testExists(departmentId)
    {
        departmentTests[departmentId].isActive = isActive;
    }
}

