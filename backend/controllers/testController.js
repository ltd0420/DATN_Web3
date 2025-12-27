const TestResult = require('../models/TestResult');
const TestQuestion = require('../models/TestQuestion');
const TestSubmission = require('../models/TestSubmission');
const DepartmentWeb3 = require('../models/DepartmentWeb3');
const departmentWeb3Service = require('../services/departmentWeb3Service');

// Add question to test
const addQuestion = async (req, res) => {
  try {
    const { departmentId, questionId, questionText, options, correctAnswerIndex, points, order } = req.body;
    
    // Validate
    if (!departmentId || !questionId || !questionText || !options || correctAnswerIndex === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    if (options.length < 2) {
      return res.status(400).json({ message: 'Must have at least 2 options' });
    }
    
    if (correctAnswerIndex < 0 || correctAnswerIndex >= options.length) {
      return res.status(400).json({ message: 'Invalid correct answer index' });
    }
    
    // Check department exists
    const department = await DepartmentWeb3.findOne({ department_id: departmentId });
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }
    
    // Check if question already exists
    const existing = await TestQuestion.findOne({ department_id: departmentId, question_id: questionId });
    if (existing) {
      return res.status(400).json({ message: 'Question already exists' });
    }
    
    const question = new TestQuestion({
      department_id: departmentId,
      question_id: questionId,
      question_text: questionText,
      options: options,
      correct_answer_index: correctAnswerIndex,
      points: points || 10,
      order: order || 0
    });
    
    await question.save();
    
    res.status(201).json({
      success: true,
      question,
      message: 'Question added successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all questions for a department (without answers for employees)
const getDepartmentQuestions = async (req, res) => {
  try {
    const questions = await TestQuestion.find({
      department_id: req.params.id
    }).sort({ order: 1 });
    
    // Remove correct_answer_index from response (for security)
    const questionsWithoutAnswer = questions.map(q => ({
      question_id: q.question_id,
      question_text: q.question_text,
      options: q.options,
      points: q.points,
      order: q.order
    }));
    
    res.json(questionsWithoutAnswer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all questions for a department WITH answers (for admin)
const getDepartmentQuestionsForAdmin = async (req, res) => {
  try {
    const departmentId = req.params.id;
    console.log('[testController] getDepartmentQuestionsForAdmin called for department:', departmentId);
    
    const questions = await TestQuestion.find({
      department_id: departmentId
    }).sort({ order: 1 });
    
    console.log('[testController] Found questions:', questions.length);
    
    // Return all fields including correct_answer_index for admin
    res.json(questions);
  } catch (error) {
    console.error('[testController] Error in getDepartmentQuestionsForAdmin:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get question with answer (for admin)
const getQuestionWithAnswer = async (req, res) => {
  try {
    const question = await TestQuestion.findOne({
      department_id: req.params.departmentId,
      question_id: req.params.questionId
    });
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Submit test (nhân viên làm bài test)
const submitTest = async (req, res) => {
  try {
    console.log('[testController] submitTest called with:', {
      departmentId: req.body.departmentId,
      employeeDid: req.body.employeeDid,
      answersCount: req.body.answers?.length,
      body: req.body
    });
    
    const { departmentId, employeeDid, answers } = req.body;
    
    // Validate
    if (!departmentId || !employeeDid || !answers || !Array.isArray(answers)) {
      console.error('[testController] Missing required fields:', {
        hasDepartmentId: !!departmentId,
        hasEmployeeDid: !!employeeDid,
        hasAnswers: !!answers,
        isArray: Array.isArray(answers)
      });
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Check department exists
    const department = await DepartmentWeb3.findOne({ department_id: departmentId });
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }
    
    // Check if employee is currently a member of this department
    const HoSoNhanVien = require('../models/HoSoNhanVien');
    const employee = await HoSoNhanVien.findOne({ employee_did: employeeDid });
    
    // Check if already submitted
    const existing = await TestSubmission.findOne({
      department_id: departmentId,
      employee_did: employeeDid
    });
    
    if (existing) {
      // Nếu nhân viên không còn là thành viên của phòng ban (hoặc không thuộc phòng ban nào), cho phép làm lại test
      const isMember = employee && department.phong_ban_id && employee.phong_ban_id === department.phong_ban_id;
      
      if (!isMember) {
        console.log('[testController] Employee not a member of department, allowing retest', {
          employeePhongBanId: employee?.phong_ban_id,
          departmentPhongBanId: department.phong_ban_id
        });
        // Xóa test submission và result cũ để cho phép làm lại
        await TestSubmission.deleteMany({
          department_id: departmentId,
          employee_did: employeeDid
        });
        await TestResult.deleteMany({
          department_id: departmentId,
          employee_did: employeeDid
        });
        console.log('[testController] Deleted old test data, allowing retest');
      } else {
        // Nhân viên vẫn là thành viên, trả về kết quả cũ
        console.log('[testController] Test already submitted, returning existing result');
        const existingResult = await TestResult.findOne({
          department_id: departmentId,
          employee_did: employeeDid
        });
        
        if (existingResult) {
          return res.status(200).json({
            success: true,
            submission: {
              ...existing.toObject(),
              percentage_score: existingResult.score
            },
            message: 'Test already submitted',
            alreadySubmitted: true
          });
        }
        
        return res.status(400).json({ message: 'Test already submitted' });
      }
    }
    
    // Get all questions for this department
    const questions = await TestQuestion.find({
      department_id: departmentId
    }).sort({ order: 1 });
    
    if (questions.length === 0) {
      return res.status(400).json({ message: 'No questions found for this department' });
    }
    
    if (answers.length !== questions.length) {
      return res.status(400).json({ message: 'Must answer all questions' });
    }
    
    // Calculate score
    let totalScore = 0;
    let maxScore = 0;
    const answerDetails = [];
    
    for (const question of questions) {
      maxScore += question.points;
      
      const answer = answers.find(a => a.question_id === question.question_id);
      if (!answer) {
        return res.status(400).json({ message: `Missing answer for question ${question.question_id}` });
      }
      
      const isCorrect = answer.selected_answer_index === question.correct_answer_index;
      if (isCorrect) {
        totalScore += question.points;
      }
      
      answerDetails.push({
        question_id: question.question_id,
        question_text: question.question_text,
        options: question.options,
        selected_answer_index: answer.selected_answer_index,
        correct_answer_index: question.correct_answer_index,
        is_correct: isCorrect,
        points: isCorrect ? question.points : 0
      });
    }
    
    // Calculate percentage score (0-100)
    const percentageScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    
    console.log('[testController] Saving submission:', {
      employee_did: employeeDid,
      department_id: departmentId,
      totalScore,
      maxScore,
      percentageScore
    });
    
    // Save submission
    const submission = new TestSubmission({
      employee_did: employeeDid,
      department_id: departmentId,
      answers: answers,
      score: totalScore,
      max_score: maxScore
    });
    
    try {
      await submission.save();
      console.log('[testController] Submission saved successfully');
    } catch (saveError) {
      console.error('[testController] Error saving submission:', saveError);
      // If duplicate key error, check if it's a race condition
      if (saveError.code === 11000) {
        console.log('[testController] Duplicate submission detected, checking existing...');
        const existingSubmission = await TestSubmission.findOne({
          department_id: departmentId,
          employee_did: employeeDid
        });
        if (existingSubmission) {
          return res.status(400).json({ message: 'Test already submitted' });
        }
      }
      throw saveError;
    }
    
    // Save to TestResult (for compatibility with existing system)
    const testResult = new TestResult({
      employee_did: employeeDid,
      department_id: departmentId,
      score: percentageScore, // Store as percentage (0-100)
      max_score: 100
    });
    
    try {
      await testResult.save();
      console.log('[testController] TestResult saved successfully');
    } catch (saveError) {
      console.error('[testController] Error saving TestResult:', saveError);
      // If duplicate key error, update existing instead
      if (saveError.code === 11000) {
        console.log('[testController] Duplicate TestResult detected, updating existing...');
        await TestResult.findOneAndUpdate(
          { employee_did: employeeDid, department_id: departmentId },
          { score: percentageScore, max_score: 100 },
          { new: true, upsert: false }
        );
      } else {
        throw saveError;
      }
    }

    // Record test score on blockchain if available
    let blockchainTxHash = null;
    let blockchainBlockNumber = null;
    const departmentContractService = require('../services/departmentContractService');
    if (departmentContractService.hasDepartmentContractConfig()) {
      try {
        const blockchainResult = await departmentContractService.recordTestScoreOnChain(
          departmentId,
          employeeDid,
          percentageScore
        );
        blockchainTxHash = blockchainResult.transactionHash;
        blockchainBlockNumber = blockchainResult.blockNumber;
        console.log(`[testController] Test score recorded on blockchain: ${percentageScore}%`);
        console.log(`[testController] Transaction hash: ${blockchainTxHash}`);
        
        // Update TestResult with blockchain info
        await TestResult.findOneAndUpdate(
          { employee_did: employeeDid, department_id: departmentId },
          { 
            transaction_hash: blockchainTxHash,
            block_number: blockchainBlockNumber
          },
          { new: true }
        );
      } catch (blockchainError) {
        console.warn('[testController] Failed to record test score on blockchain:', blockchainError.message);
        // Continue without blockchain
      }
    }

    // Kiểm tra điểm và tự động thêm nhân viên vào phòng ban thường nếu đạt điểm
    // HoSoNhanVien đã được require ở trên (dòng 128)
    try {
      if (department && department.phong_ban_id && percentageScore >= department.min_test_score) {
        // Get employee info for wallet address
        const employee = await HoSoNhanVien.findOne({ employee_did: employeeDid });
        if (!employee) {
          console.warn(`[testController] Employee ${employeeDid} not found, skipping department assignment`);
        } else {
          // Tự động thêm nhân viên vào phòng ban thường
          await HoSoNhanVien.findOneAndUpdate(
            { employee_did: employeeDid },
            { phong_ban_id: department.phong_ban_id },
            { new: true }
          );
          console.log(`[testController] Auto-assigned employee ${employeeDid} to department ${department.phong_ban_id} after passing test`);
          
          // Also join Web3 department to create DepartmentMember record with blockchain transaction
          try {
            const joinResult = await departmentWeb3Service.joinDepartment(
              departmentId,
              employeeDid,
              employee.walletAddress
            );
            console.log(`[testController] Employee ${employeeDid} joined Web3 department:`, {
              memberId: joinResult.member?._id,
              blockchain_tx_hash: joinResult.member?.blockchain_tx_hash,
              blockchain_block_number: joinResult.member?.blockchain_block_number
            });
          } catch (web3JoinError) {
            // If already a member, that's okay
            if (web3JoinError.message && web3JoinError.message.includes('Already a member')) {
              console.log(`[testController] Employee ${employeeDid} already a Web3 member`);
            } else {
              console.error('[testController] Failed to join Web3 department:', web3JoinError.message);
              // Don't throw - traditional department assignment succeeded
            }
          }
        }
      }
    } catch (assignError) {
      console.error('[testController] Failed to auto-assign employee to department:', assignError);
      // Không throw error, vì test đã submit thành công
    }
    
    console.log('[testController] Preparing response:', {
      submissionId: submission._id,
      totalScore,
      maxScore,
      percentageScore,
      answerDetailsCount: answerDetails.length
    });
    
    const responseData = {
      success: true,
      submission: {
        _id: submission._id,
        employee_did: submission.employee_did,
        department_id: submission.department_id,
        answers: submission.answers,
        score: submission.score,
        max_score: submission.max_score,
        percentage_score: percentageScore,
        submitted_at: submission.submitted_at,
        transaction_hash: blockchainTxHash,
        block_number: blockchainBlockNumber
      },
      answerDetails: answerDetails,
      blockchain: blockchainTxHash ? {
        transaction_hash: blockchainTxHash,
        block_number: blockchainBlockNumber
      } : null,
      message: `Test submitted successfully! Score: ${totalScore}/${maxScore} (${percentageScore}%)`
    };
    
    console.log('[testController] Sending response');
    res.status(201).json(responseData);
  } catch (error) {
    console.error('[testController] submitTest error:', error);
    console.error('[testController] Error stack:', error.stack);
    res.status(500).json({ 
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get test result
const getTestResult = async (req, res) => {
  try {
    const { departmentId, employeeDid } = req.params;
    
    // Check if employee is currently a member of this department
    const HoSoNhanVien = require('../models/HoSoNhanVien');
    const DepartmentWeb3 = require('../models/DepartmentWeb3');
    const DepartmentMember = require('../models/DepartmentMember');
    const employee = await HoSoNhanVien.findOne({ employee_did: employeeDid });
    const department = await DepartmentWeb3.findOne({ department_id: departmentId });
    
    // Kiểm tra xem nhân viên có phải là thành viên của phòng ban này không
    // Check both DepartmentMember (Web3) and phong_ban_id (traditional)
    let isMember = false;
    
    // First check DepartmentMember (Web3 membership)
    if (department) {
      const web3Member = await DepartmentMember.findOne({
        department_id: departmentId,
        employee_did: employeeDid,
        is_active: true
      });
      if (web3Member) {
        isMember = true;
      }
    }
    
    // Also check traditional department membership
    if (!isMember && employee && department && department.phong_ban_id) {
      isMember = employee.phong_ban_id && employee.phong_ban_id === department.phong_ban_id;
    }
    
    console.log('[testController] getTestResult - Checking membership:', {
      employeeDid,
      departmentId,
      employeePhongBanId: employee?.phong_ban_id,
      departmentPhongBanId: department?.phong_ban_id,
      isMember,
      hasEmployee: !!employee,
      hasDepartment: !!department
    });
    
    // Nếu nhân viên không còn là thành viên, vẫn trả về test result nếu có transaction_hash (để hiển thị blockchain link)
    // Chỉ xóa data nếu không có transaction_hash
    if (!isMember) {
      // Check if test result has blockchain transaction hash
      const testResultWithTx = await TestResult.findOne({
        department_id: departmentId,
        employee_did: employeeDid,
        $or: [
          { transaction_hash: { $exists: true, $ne: null } },
          { 'blockchain.transaction_hash': { $exists: true, $ne: null } }
        ]
      });
      
      if (testResultWithTx) {
        // If has transaction hash, return it for blockchain link display
        console.log('[testController] Employee not a member but has blockchain transaction, returning for link display');
        const submission = await TestSubmission.findOne({
          department_id: departmentId,
          employee_did: employeeDid
        });
        
        if (submission) {
          // Return minimal data with transaction hash
          return res.json({
            transaction_hash: testResultWithTx.transaction_hash || testResultWithTx.blockchain?.transaction_hash,
            block_number: testResultWithTx.block_number || testResultWithTx.blockchain?.block_number,
            blockchain: testResultWithTx.blockchain || (testResultWithTx.transaction_hash ? {
              transaction_hash: testResultWithTx.transaction_hash,
              block_number: testResultWithTx.block_number
            } : null)
          });
        }
      }
      
      // No transaction hash, delete old data
      console.log('[testController] Employee not a member and no blockchain transaction, deleting old test data and returning 404');
      const deletedSubmissions = await TestSubmission.deleteMany({
        department_id: departmentId,
        employee_did: employeeDid
      });
      const deletedResults = await TestResult.deleteMany({
        department_id: departmentId,
        employee_did: employeeDid
      });
      console.log('[testController] Deleted test data:', {
        submissions: deletedSubmissions.deletedCount,
        results: deletedResults.deletedCount
      });
      return res.status(404).json({ message: 'No test result found' });
    }
    
    const submission = await TestSubmission.findOne({
      department_id: departmentId,
      employee_did: employeeDid
    });
    
    if (!submission) {
      console.log('[testController] No submission found for:', { departmentId, employeeDid });
      return res.status(404).json({ message: 'No test result found' });
    }
    
    // Get TestResult to retrieve transaction_hash
    const testResult = await TestResult.findOne({
      department_id: departmentId,
      employee_did: employeeDid
    });
    
    console.log('[testController] TestResult found:', {
      hasResult: !!testResult,
      transaction_hash: testResult?.transaction_hash,
      block_number: testResult?.block_number
    });
    
    // Get questions to show correct answers
    const questions = await TestQuestion.find({
      department_id: departmentId
    });
    
    const questionMap = {};
    questions.forEach(q => {
      questionMap[q.question_id] = q;
    });
    
    // Add question details to answers
    const answersWithDetails = submission.answers.map(answer => {
      const question = questionMap[answer.question_id];
      return {
        question_id: answer.question_id,
        question_text: question ? question.question_text : '',
        options: question ? question.options : [],
        selected_answer_index: answer.selected_answer_index,
        correct_answer_index: question ? question.correct_answer_index : null,
        is_correct: question ? answer.selected_answer_index === question.correct_answer_index : false,
        points: question && answer.selected_answer_index === question.correct_answer_index ? question.points : 0
      };
    });
    
    // Double-check membership before returning result (safety check)
    if (employee && department && department.phong_ban_id) {
      const isStillMember = employee.phong_ban_id && employee.phong_ban_id === department.phong_ban_id;
      if (!isStillMember) {
        console.log('[testController] Double-check: Employee not a member, deleting and returning 404');
        await TestSubmission.deleteMany({
          department_id: departmentId,
          employee_did: employeeDid
        });
        await TestResult.deleteMany({
          department_id: departmentId,
          employee_did: employeeDid
        });
        return res.status(404).json({ message: 'No test result found' });
      }
    } else if (employee && (!employee.phong_ban_id || employee.phong_ban_id === null)) {
      // Employee has no department, delete test data
      console.log('[testController] Double-check: Employee has no department, deleting and returning 404');
      await TestSubmission.deleteMany({
        department_id: departmentId,
        employee_did: employeeDid
      });
      await TestResult.deleteMany({
        department_id: departmentId,
        employee_did: employeeDid
      });
      return res.status(404).json({ message: 'No test result found' });
    }
    
    const percentageScore = submission.max_score > 0 
      ? Math.round((submission.score / submission.max_score) * 100) 
      : 0;
    
    // Include transaction_hash and block_number from TestResult if available
    const responseData = {
      ...submission.toObject(),
      percentage_score: percentageScore,
      answers: answersWithDetails
    };
    
    if (testResult) {
      if (testResult.transaction_hash) {
        responseData.transaction_hash = testResult.transaction_hash;
        responseData.block_number = testResult.block_number;
        responseData.blockchain = {
          transaction_hash: testResult.transaction_hash,
          block_number: testResult.block_number
        };
      }
      console.log('[testController] Returning test result with blockchain data:', {
        hasTransactionHash: !!responseData.transaction_hash,
        transaction_hash: responseData.transaction_hash,
        block_number: responseData.block_number
      });
    }
    
    res.json(responseData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Record test score (simplified - for backward compatibility)
const recordTestScore = async (req, res) => {
  try {
    const { departmentId, employeeDid, score } = req.body;
    
    // Validate
    if (!departmentId || !employeeDid || score === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    if (score < 0 || score > 100) {
      return res.status(400).json({ message: 'Score must be between 0 and 100' });
    }
    
    // Check department exists
    const department = await DepartmentWeb3.findOne({ department_id: departmentId });
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }
    
    // Check if already taken
    const existing = await TestResult.findOne({ departmentId, employeeDid });
    if (existing) {
      return res.status(400).json({ message: 'Test already taken' });
    }
    
    // Create test result
    const testResult = new TestResult({
      employee_did: employeeDid,
      department_id: departmentId,
      score: score,
      max_score: 100
    });
    
    await testResult.save();
    
    res.status(201).json({
      success: true,
      testResult,
      message: 'Test score recorded successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all test results for a department
const getDepartmentTestResults = async (req, res) => {
  try {
    const testResults = await TestResult.find({
      department_id: req.params.id
    }).sort({ score: -1 });
    
    res.json(testResults);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete question
const deleteQuestion = async (req, res) => {
  try {
    const { departmentId, questionId } = req.params;
    
    const question = await TestQuestion.findOneAndDelete({
      department_id: departmentId,
      question_id: questionId
    });
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    res.json({ success: true, message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Import questions from JSON file
const importQuestionsFromJSON = async (req, res) => {
  try {
    console.log('[importQuestionsFromJSON] Request received', {
      hasFile: !!req.file,
      body: req.body,
      fileSize: req.file?.size
    });
    
    // Get departmentId from FormData body
    const departmentId = req.body.departmentId;
    console.log('[importQuestionsFromJSON] Department ID:', departmentId);
    
    if (!departmentId) {
      console.log('[importQuestionsFromJSON] Missing department ID');
      return res.status(400).json({ message: 'Department ID is required' });
    }
    
    // Check department exists
    console.log('[importQuestionsFromJSON] Checking department exists...');
    let department = await DepartmentWeb3.findOne({ department_id: departmentId });
    console.log('[importQuestionsFromJSON] Department found:', !!department);
    
    // If not found, try to find by phong_ban_id and create if traditional department exists
    if (!department) {
      console.log('[importQuestionsFromJSON] Department Web3 not found, checking traditional department...');
      const DanhMucPhongBan = require('../models/DanhMucPhongBan');
      const traditionalDept = await DanhMucPhongBan.findOne({ phong_ban_id: departmentId });
      
      if (traditionalDept) {
        console.log('[importQuestionsFromJSON] Traditional department found, creating Web3 department...');
        // Auto-create Web3 department
        department = new DepartmentWeb3({
          department_id: traditionalDept.phong_ban_id,
          phong_ban_id: traditionalDept.phong_ban_id,
          department_name: traditionalDept.ten_phong_ban,
          require_test: true,
          min_test_score: 70,
          is_active: true
        });
        await department.save();
        console.log('[importQuestionsFromJSON] Web3 department created:', department.department_id);
      } else {
        console.log('[importQuestionsFromJSON] Traditional department also not found');
        return res.status(404).json({ 
          message: 'Department not found. Please create the department first.' 
        });
      }
    }
    
    // Get JSON from file
    let questionsData = [];
    
    if (!req.file) {
      console.log('[importQuestionsFromJSON] No file uploaded');
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // File uploaded via multer
    console.log('[importQuestionsFromJSON] Reading file content...');
    const fileContent = req.file.buffer.toString('utf8');
    console.log('[importQuestionsFromJSON] File content length:', fileContent.length);
    try {
      questionsData = JSON.parse(fileContent);
      console.log('[importQuestionsFromJSON] Parsed JSON successfully, questions count:', questionsData.length);
    } catch (parseError) {
      console.error('[importQuestionsFromJSON] JSON parse error:', parseError);
      return res.status(400).json({ 
        message: 'Invalid JSON file format', 
        error: parseError.message 
      });
    }
    
    if (!Array.isArray(questionsData)) {
      return res.status(400).json({ message: 'Questions must be an array' });
    }
    
    if (questionsData.length === 0) {
      console.log('[importQuestionsFromJSON] Questions array is empty');
      return res.status(400).json({ message: 'Questions array is empty' });
    }
    
    // Validate and import questions
    console.log('[importQuestionsFromJSON] Starting to import questions...');
    const results = {
      success: 0,
      failed: 0,
      errors: [],
      imported: []
    };
    
    for (let i = 0; i < questionsData.length; i++) {
      console.log(`[importQuestionsFromJSON] Processing question ${i + 1}/${questionsData.length}`);
      const q = questionsData[i];
      
      try {
        // Validate required fields
        if (!q.question_id || !q.question_text || !q.options || q.correct_answer_index === undefined) {
          results.failed++;
          results.errors.push({
            index: i,
            question_id: q.question_id || 'unknown',
            error: 'Missing required fields (question_id, question_text, options, correct_answer_index)'
          });
          continue;
        }
        
        // Validate options
        if (!Array.isArray(q.options) || q.options.length < 2) {
          results.failed++;
          results.errors.push({
            index: i,
            question_id: q.question_id,
            error: 'Options must be an array with at least 2 items'
          });
          continue;
        }
        
        // Validate correct_answer_index
        if (q.correct_answer_index < 0 || q.correct_answer_index >= q.options.length) {
          results.failed++;
          results.errors.push({
            index: i,
            question_id: q.question_id,
            error: `Invalid correct_answer_index (must be between 0 and ${q.options.length - 1})`
          });
          continue;
        }
        
        // Check if question already exists
        const existing = await TestQuestion.findOne({
          department_id: departmentId,
          question_id: q.question_id
        });
        
        if (existing) {
          results.failed++;
          results.errors.push({
            index: i,
            question_id: q.question_id,
            error: 'Question already exists'
          });
          continue;
        }
        
        // Create question
        const question = new TestQuestion({
          department_id: departmentId,
          question_id: q.question_id,
          question_text: q.question_text,
          options: q.options,
          correct_answer_index: q.correct_answer_index,
          points: q.points || 10,
          order: q.order !== undefined ? q.order : i
        });
        
        await question.save();
        console.log(`[importQuestionsFromJSON] Question ${q.question_id} saved successfully`);
        results.success++;
        results.imported.push({
          question_id: q.question_id,
          question_text: q.question_text
        });
      } catch (error) {
        console.error(`[importQuestionsFromJSON] Error processing question ${i}:`, error);
        results.failed++;
        results.errors.push({
          index: i,
          question_id: q.question_id || 'unknown',
          error: error.message
        });
      }
    }
    
    console.log('[importQuestionsFromJSON] Import completed:', {
      success: results.success,
      failed: results.failed,
      total: questionsData.length
    });
    
    res.status(201).json({
      success: true,
      message: `Imported ${results.success} questions, ${results.failed} failed`,
      results: {
        total: questionsData.length,
        success: results.success,
        failed: results.failed,
        imported: results.imported,
        errors: results.errors
      }
    });
  } catch (error) {
    console.error('[importQuestionsFromJSON] Unexpected error:', error);
    console.error('[importQuestionsFromJSON] Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to import questions', 
      error: error.message 
    });
  }
};

module.exports = {
  addQuestion,
  getDepartmentQuestions,
  getDepartmentQuestionsForAdmin,
  getQuestionWithAnswer,
  submitTest,
  getTestResult,
  recordTestScore,
  getDepartmentTestResults,
  deleteQuestion,
  importQuestionsFromJSON
};
