# Hệ Thống Quản Lý Phòng Ban Web3 - Tài Liệu

## 📋 Tổng Quan

Hệ thống quản lý phòng ban tự động gồm 3 smart contracts chính:

1. **TestManagement.sol** - Quản lý test chuyên môn on-chain
2. **VotingManagement.sol** - Quản lý voting cộng đồng
3. **DepartmentManagement.sol** - Quản lý phòng ban và tự động phân quyền

## 🏗️ Kiến Trúc

```
┌─────────────────────────────────────┐
│   DepartmentManagement               │
│   (Quản lý phòng ban)               │
└──────────┬──────────────────────────┘
           │
           ├───> TestManagement
           │     (Quản lý test)
           │
           └───> VotingManagement
                 (Quản lý voting)
```

## 📦 Contracts

### 1. TestManagement.sol

**Chức năng:**
- Tạo và quản lý test chuyên môn cho từng phòng ban
- Lưu trữ câu hỏi và đáp án on-chain
- Tự động chấm điểm khi nhân viên submit test
- Cung cấp interface cho DepartmentManagement

**Các function chính:**
- `createTest()` - Tạo test mới cho phòng ban
- `addQuestion()` - Thêm câu hỏi vào test
- `submitTest()` - Nhân viên submit test và tự động chấm điểm
- `getTestScore()` - Lấy điểm số (interface cho DepartmentManagement)

**Ví dụ sử dụng:**
```solidity
// 1. Tạo test
testManagement.createTest("dept-001", "Frontend Developer Test");

// 2. Thêm câu hỏi
testManagement.addQuestion(
    "dept-001",
    "q1",
    "What is React?",
    ["Framework", "Library", "Language", "Tool"],
    1, // Đáp án đúng là index 1 (Library)
    10 // 10 điểm
);

// 3. Nhân viên submit test
testManagement.submitTest(
    "dept-001",
    "did:employee:123",
    ["q1", "q2"],
    [1, 0] // Đáp án đã chọn
);
```

### 2. VotingManagement.sol

**Chức năng:**
- Tạo và quản lý kỳ ứng tuyển theo chu kỳ
- Cho phép ứng viên đăng ký tham gia
- Cho phép cộng đồng vote cho ứng viên
- Xác định người thắng cuộc (số vote cao nhất)
- Cung cấp interface cho DepartmentManagement

**Các function chính:**
- `createVotingPeriod()` - Tạo kỳ ứng tuyển mới
- `registerCandidate()` - Ứng viên đăng ký tham gia
- `vote()` - Người dùng vote cho ứng viên
- `endVotingPeriod()` - Kết thúc kỳ và xác định người thắng
- `getTopCandidate()` - Lấy ứng viên có số vote cao nhất (interface)

**Ví dụ sử dụng:**
```solidity
// 1. Tạo kỳ ứng tuyển (30 ngày)
votingManagement.createVotingPeriod("dept-001", 30);

// 2. Ứng viên đăng ký
votingManagement.registerCandidate(
    "dept-001",
    1, // periodId
    "did:employee:123",
    0x1234... // wallet address
);

// 3. Người dùng vote
votingManagement.vote(
    "dept-001",
    1,
    "did:employee:123"
);

// 4. Kết thúc kỳ (sau 30 ngày)
votingManagement.endVotingPeriod("dept-001", 1);
```

### 3. DepartmentManagement.sol

**Chức năng:**
- Tạo phòng ban với cấu hình điều kiện tham gia
- Tự động kiểm tra điều kiện (test hoặc voting)
- Tự động thêm nhân viên vào phòng ban khi đủ điều kiện
- Quản lý danh sách thành viên

**Các function chính:**
- `createDepartment()` - Tạo phòng ban mới
- `joinDepartment()` - Nhân viên tham gia phòng ban (tự động kiểm tra điều kiện)
- `checkQualification()` - Kiểm tra xem nhân viên có đủ điều kiện chưa
- `isMemberOfDepartment()` - Kiểm tra nhân viên có trong phòng ban không

**Ví dụ sử dụng:**
```solidity
// 1. Tạo phòng ban với cả 2 điều kiện
departmentManagement.createDepartment(
    "dept-001",
    "Frontend Development",
    true, // requireTest
    testManagementAddress,
    70, // minTestScore
    true, // requireVoting
    votingManagementAddress,
    10, // minVotes
    1 // votingPeriod (1 tháng)
);

// 2. Nhân viên tham gia (tự động kiểm tra điều kiện)
departmentManagement.joinDepartment(
    "dept-001",
    "did:employee:123",
    0x1234... // wallet address
);

// 3. Kiểm tra điều kiện trước
(bool qualified, string memory method) = departmentManagement.checkQualification(
    "dept-001",
    "did:employee:123"
);
```

## 🚀 Deployment

### Bước 1: Deploy Contracts

```bash
cd backend
npx hardhat run scripts/deploy-department-system.js --network sepolia
```

Script sẽ deploy cả 3 contracts và lưu địa chỉ vào `deployment-department-system.json`.

### Bước 2: Cấu Hình Environment

Thêm vào `.env`:
```env
TEST_MANAGEMENT_ADDRESS=0x...
VOTING_MANAGEMENT_ADDRESS=0x...
DEPARTMENT_MANAGEMENT_ADDRESS=0x...
```

### Bước 3: Tạo Test và Voting

1. **Tạo test cho phòng ban:**
```javascript
const testManagement = await ethers.getContractAt("TestManagement", TEST_MANAGEMENT_ADDRESS);
await testManagement.createTest("dept-001", "Frontend Developer Test");
await testManagement.addQuestion("dept-001", "q1", "What is React?", ["Framework", "Library"], 1, 10);
```

2. **Tạo kỳ ứng tuyển:**
```javascript
const votingManagement = await ethers.getContractAt("VotingManagement", VOTING_MANAGEMENT_ADDRESS);
await votingManagement.createVotingPeriod("dept-001", 30); // 30 ngày
```

### Bước 4: Tạo Phòng Ban

```javascript
const departmentManagement = await ethers.getContractAt("DepartmentManagement", DEPARTMENT_MANAGEMENT_ADDRESS);
await departmentManagement.createDepartment(
    "dept-001",
    "Frontend Development",
    true, // requireTest
    TEST_MANAGEMENT_ADDRESS,
    70, // minTestScore
    true, // requireVoting
    VOTING_MANAGEMENT_ADDRESS,
    10, // minVotes
    1 // votingPeriod (1 tháng)
);
```

## 🔄 Quy Trình Hoạt Động

### Quy Trình 1: Tham Gia Qua Test

1. Owner tạo test cho phòng ban
2. Owner thêm câu hỏi vào test
3. Nhân viên làm test và submit
4. TestManagement tự động chấm điểm
5. Nhân viên gọi `joinDepartment()`
6. DepartmentManagement kiểm tra điểm >= minTestScore
7. Nếu đủ → Tự động thêm vào phòng ban

### Quy Trình 2: Tham Gia Qua Voting

1. Owner tạo kỳ ứng tuyển
2. Ứng viên đăng ký tham gia
3. Cộng đồng vote cho ứng viên
4. Owner kết thúc kỳ ứng tuyển
5. VotingManagement xác định người thắng cuộc
6. Người thắng gọi `joinDepartment()`
7. DepartmentManagement kiểm tra có phải người thắng không
8. Nếu đủ → Tự động thêm vào phòng ban

## ⚠️ Lưu Ý

1. **Gas Cost:**
   - Submit test tốn gas (tùy số câu hỏi)
   - Vote tốn gas
   - Join department tốn gas
   - Có thể sử dụng Layer 2 để giảm chi phí

2. **Security:**
   - Tất cả contracts đã có ReentrancyGuard
   - Input validation đầy đủ
   - Access control rõ ràng
   - Cần audit trước khi deploy mainnet

3. **Cấu Hình:**
   - Điều kiện phòng ban được cố định khi tạo
   - Không thể thay đổi sau (đảm bảo tính minh bạch)
   - Có thể tạo phòng ban mới với cấu hình mới

4. **Dependencies:**
   - DepartmentManagement phụ thuộc vào TestManagement và VotingManagement
   - Cần deploy Test và Voting trước khi tạo phòng ban
   - Cần đảm bảo địa chỉ contract đúng

## 📚 Tài Liệu Tham Khảo

- [TUSD_INTEGRATION_IDEA.md](./TUSD_INTEGRATION_IDEA.md) - Ý tưởng và kiến trúc hệ thống
- [DepartmentManagement.sol](./DepartmentManagement.sol) - Contract quản lý phòng ban
- [TestManagement.sol](./TestManagement.sol) - Contract quản lý test
- [VotingManagement.sol](./VotingManagement.sol) - Contract quản lý voting

---

**Phiên bản:** 1.0  
**Ngày tạo:** 2024

