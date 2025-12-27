const DepartmentWeb3 = require('../models/DepartmentWeb3');
const DepartmentMember = require('../models/DepartmentMember');
const TestResult = require('../models/TestResult');
const TestQuestion = require('../models/TestQuestion');
const TestSubmission = require('../models/TestSubmission');
const HoSoNhanVien = require('../models/HoSoNhanVien');
const departmentContractService = require('./departmentContractService');

/**
 * Service xử lý logic Department Web3
 * Tích hợp với smart contracts trên blockchain
 * Fallback về off-chain nếu blockchain không available
 */

/**
 * Kiểm tra nhân viên có đủ điều kiện tham gia phòng ban không
 * Ưu tiên check trên blockchain, fallback về off-chain nếu không có blockchain
 */
async function checkQualification(departmentId, employeeDid) {
  const department = await DepartmentWeb3.findOne({ department_id: departmentId });
  if (!department || !department.is_active) {
    return { qualified: false, method: null, reason: 'Department not found or inactive' };
  }

  // Try blockchain check first
  if (departmentContractService.hasDepartmentContractConfig()) {
    try {
      const blockchainResult = await departmentContractService.checkQualificationOnChain(departmentId, employeeDid);
      if (blockchainResult) {
        console.log('[checkQualification] Blockchain result:', blockchainResult);
        if (blockchainResult.qualified) {
          return {
            qualified: true,
            method: blockchainResult.method || 'test',
            source: 'blockchain'
          };
        }
        // If blockchain says not qualified, still check off-chain as fallback
      }
    } catch (error) {
      console.warn('[checkQualification] Blockchain check failed, using off-chain:', error.message);
    }
  }

  // Off-chain check (fallback)
  if (department.require_test) {
    const testResult = await TestResult.findOne({
      employee_did: employeeDid,
      department_id: departmentId
    });
    
    if (testResult && testResult.score >= department.min_test_score) {
      return {
        qualified: true,
        method: 'test',
        score: testResult.score,
        minScore: department.min_test_score,
        source: 'off-chain'
      };
    }
  }

  return { qualified: false, method: null, reason: 'Does not meet qualification requirements', source: 'off-chain' };
}

/**
 * Nhân viên tham gia phòng ban (tự động kiểm tra điều kiện)
 * Ưu tiên join trên blockchain, fallback về off-chain nếu không có blockchain
 */
async function joinDepartment(departmentId, employeeDid, walletAddress) {
  // Kiểm tra đã là thành viên chưa (check cả blockchain và off-chain)
  const existingMember = await DepartmentMember.findOne({
    department_id: departmentId,
    employee_did: employeeDid,
    is_active: true
  });
  
  if (existingMember) {
    throw new Error('Already a member of this department');
  }

  // Check blockchain membership
  if (departmentContractService.hasDepartmentContractConfig()) {
    try {
      const isMemberOnChain = await departmentContractService.isMemberOnChain(departmentId, employeeDid);
      if (isMemberOnChain === true) {
        throw new Error('Already a member of this department (on blockchain)');
      }
    } catch (error) {
      if (error.message.includes('Already a member')) {
        throw error;
      }
      console.warn('[joinDepartment] Blockchain membership check failed:', error.message);
    }
  }

  // Kiểm tra điều kiện
  const qualification = await checkQualification(departmentId, employeeDid);
  
  if (!qualification.qualified) {
    throw new Error(qualification.reason || 'Does not meet qualification requirements');
  }

  // Lấy thông tin nhân viên
  const employee = await HoSoNhanVien.findOne({ employee_did: employeeDid });
  if (!employee) {
    throw new Error('Employee not found');
  }

  const finalWalletAddress = walletAddress || employee.walletAddress;
  if (!finalWalletAddress) {
    throw new Error('Wallet address is required');
  }

  // Check if department exists on blockchain first
  const department = await DepartmentWeb3.findOne({ department_id: departmentId });
  if (!department) {
    throw new Error('Department not found');
  }

  // Try join on blockchain only if department was created on blockchain
  let blockchainResult = null;
  if (departmentContractService.hasDepartmentContractConfig() && department.blockchain_tx_hash) {
    try {
      blockchainResult = await departmentContractService.joinDepartmentOnChain(
        departmentId,
        employeeDid,
        finalWalletAddress
      );
      console.log('[joinDepartment] Successfully joined on blockchain:', blockchainResult);
    } catch (error) {
      console.error('[joinDepartment] Blockchain join failed:', error.message);
      // If department doesn't exist on-chain, that's okay - continue with off-chain only
      if (error.message && error.message.includes('Department does not exist')) {
        console.warn('[joinDepartment] Department not found on blockchain, creating off-chain member only');
      } else {
        // Other errors - continue with off-chain join as fallback
        console.warn('[joinDepartment] Continuing with off-chain join as fallback');
      }
    }
  } else {
    if (!department.blockchain_tx_hash) {
      console.log('[joinDepartment] Department not created on blockchain, creating off-chain member only');
    }
  }

  // Create member record (off-chain)
  const memberData = {
    department_id: departmentId,
    employee_did: employeeDid,
    wallet_address: finalWalletAddress,
    qualification_method: qualification.method,
    is_active: true
  };

  if (qualification.method === 'test' && qualification.score) {
    memberData.test_score = qualification.score;
  }

  if (blockchainResult) {
    memberData.blockchain_tx_hash = blockchainResult.transactionHash;
    memberData.blockchain_block_number = blockchainResult.blockNumber;
  }

  const member = new DepartmentMember(memberData);
  await member.save();
  
  console.log('[joinDepartment] DepartmentMember created:', {
    department_id: member.department_id,
    employee_did: member.employee_did,
    blockchain_tx_hash: member.blockchain_tx_hash,
    blockchain_block_number: member.blockchain_block_number,
    qualification_method: member.qualification_method
  });

  return {
    member,
    qualification,
    blockchain: blockchainResult
  };
}

/**
 * Tạo phòng ban mới
 * Tạo trên blockchain nếu có config, đồng thời lưu vào database
 */
async function createDepartment(departmentData) {
  // Validate - chỉ yêu cầu test
  if (!departmentData.require_test) {
    throw new Error('Test is required to join department');
  }

  if (departmentData.require_test) {
    if (!departmentData.min_test_score || departmentData.min_test_score < 0 || departmentData.min_test_score > 100) {
      throw new Error('Invalid min test score');
    }
  }

  // Bỏ các field voting nếu có
  delete departmentData.require_voting;
  delete departmentData.voting_contract_address;
  delete departmentData.min_votes;
  delete departmentData.voting_period_days;

  // Try create on blockchain first
  let blockchainResult = null;
  if (departmentContractService.hasDepartmentContractConfig()) {
    try {
      blockchainResult = await departmentContractService.createDepartmentOnChain({
        departmentId: departmentData.department_id,
        departmentName: departmentData.department_name,
        requireTest: departmentData.require_test,
        minTestScore: departmentData.min_test_score,
        requireVoting: false,
        votingPeriod: 0
      });
      console.log('[createDepartment] Successfully created on blockchain:', blockchainResult);
      
      // Store blockchain info
      departmentData.blockchain_tx_hash = blockchainResult.transactionHash;
      departmentData.blockchain_block_number = blockchainResult.blockNumber;
    } catch (error) {
      console.error('[createDepartment] Blockchain create failed:', error.message);
      // Continue with off-chain create as fallback
    }
  }

  // Save to database
  const department = new DepartmentWeb3(departmentData);
  await department.save();
  
  // If blockchain result was successful but not saved, update it
  if (blockchainResult && blockchainResult.transactionHash && !department.blockchain_tx_hash) {
    department.blockchain_tx_hash = blockchainResult.transactionHash;
    department.blockchain_block_number = blockchainResult.blockNumber;
    await department.save();
    console.log('[createDepartment] Updated department with blockchain info:', {
      department_id: department.department_id,
      blockchain_tx_hash: department.blockchain_tx_hash,
      blockchain_block_number: department.blockchain_block_number
    });
  }

  return department;
}

/**
 * Xóa phòng ban (và tất cả dữ liệu liên quan)
 */
async function deleteDepartment(departmentId) {
  const department = await DepartmentWeb3.findOne({ department_id: departmentId });
  if (!department) {
    throw new Error('Department not found');
  }

  // Xóa tất cả dữ liệu liên quan
  await DepartmentMember.deleteMany({ department_id: departmentId });
  await TestResult.deleteMany({ department_id: departmentId });
  await TestQuestion.deleteMany({ department_id: departmentId });
  await TestSubmission.deleteMany({ department_id: departmentId });
  
  // Xóa phòng ban
  await DepartmentWeb3.deleteOne({ department_id: departmentId });

  return { success: true, message: 'Department deleted successfully' };
}

module.exports = {
  checkQualification,
  joinDepartment,
  createDepartment,
  deleteDepartment
};

