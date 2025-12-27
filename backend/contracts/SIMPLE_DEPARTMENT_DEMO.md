# Hướng Dẫn Demo Hệ Thống Quản Lý Phòng Ban Web3 (Simplified)

## 📋 Tổng Quan

Phiên bản đơn giản cho demo, sử dụng:
- **TUSD Token** - Thưởng khi nhân viên join department
- **Localhost Network** - Không cần Sepolia
- **Simplified Contracts** - Không cần on-chain phức tạp

## 🏗️ Kiến Trúc Đơn Giản

```
┌─────────────────────────────────────┐
│   DepartmentManagement               │
│   + TUSD Reward khi join            │
└──────────┬──────────────────────────┘
           │
           ├───> SimpleTestManagement
           │     (Ghi điểm đơn giản)
           │
           └───> SimpleVotingManagement
                 (Voting đơn giản)
```

## 🚀 Deployment

### Bước 1: Start Local Network

```bash
cd backend
npx hardhat node
```

Giữ terminal này chạy, mở terminal mới.

### Bước 2: Deploy Contracts

```bash
cd backend
npx hardhat run scripts/deploy-simple-department-system.js --network localhost
```

Kết quả sẽ được lưu vào `deployment-simple-department-system.json`.

## 📝 Demo Workflow

### 1. Setup Test Score (Simplified)

Thay vì làm test phức tạp, owner chỉ cần ghi điểm:

```javascript
const testManagement = await ethers.getContractAt(
  "SimpleTestManagement",
  TEST_MANAGEMENT_ADDRESS
);

// Ghi điểm 85 cho nhân viên
await testManagement.recordTestScore(
  "dept-001",
  "did:employee:123",
  85 // Điểm số
);
```

### 2. Setup Voting Period

```javascript
const votingManagement = await ethers.getContractAt(
  "SimpleVotingManagement",
  VOTING_MANAGEMENT_ADDRESS
);

// Tạo kỳ ứng tuyển 7 ngày
await votingManagement.createVotingPeriod("dept-001", 7);

// Ứng viên đăng ký
await votingManagement.registerCandidate(
  "dept-001",
  1, // periodId
  "did:employee:456",
  "0x1234..." // wallet address
);

// Người dùng vote
await votingManagement.vote("dept-001", 1, "did:employee:456");

// Kết thúc kỳ (sau 7 ngày hoặc khi cần)
await votingManagement.endVotingPeriod("dept-001", 1);
```

### 3. Tạo Phòng Ban

```javascript
const departmentManagement = await ethers.getContractAt(
  "DepartmentManagement",
  DEPARTMENT_MANAGEMENT_ADDRESS
);

await departmentManagement.createDepartment(
  "dept-001",
  "Frontend Development",
  true, // requireTest
  TEST_MANAGEMENT_ADDRESS,
  70, // minTestScore (>= 70 điểm)
  true, // requireVoting
  VOTING_MANAGEMENT_ADDRESS,
  1, // minVotes (>= 1 vote)
  1 // votingPeriod (1 tháng)
);
```

### 4. Nhân Viên Join Department

```javascript
// Nhân viên gọi joinDepartment
// Contract tự động:
// 1. Kiểm tra điểm test >= 70 HOẶC
// 2. Kiểm tra có phải người thắng voting không
// 3. Nếu đủ điều kiện → Tự động thêm vào phòng ban
// 4. Tự động chuyển 100 TUSD vào ví nhân viên

await departmentManagement.joinDepartment(
  "dept-001",
  "did:employee:123",
  "0x5678..." // wallet address của nhân viên
);
```

## 💰 TUSD Integration

### Thưởng Khi Join

- Mỗi nhân viên join department thành công sẽ nhận **100 TUSD**
- TUSD được tự động chuyển vào ví nhân viên
- Contract cần có đủ TUSD để thưởng

### Quản Lý TUSD

```javascript
// Kiểm tra số dư TUSD của contract
const balance = await departmentManagement.getTUSDBalance();
console.log("Contract TUSD balance:", ethers.formatUnits(balance, 18));

// Owner nạp thêm TUSD vào contract
await tusdToken.approve(DEPARTMENT_MANAGEMENT_ADDRESS, amount);
await departmentManagement.depositTUSD(amount);

// Owner rút TUSD (emergency)
await departmentManagement.withdrawTUSD(amount);
```

## 🎯 Demo Scenarios

### Scenario 1: Join Qua Test

1. Owner ghi điểm test: 85 điểm
2. Owner tạo phòng ban với minTestScore = 70
3. Nhân viên gọi `joinDepartment()`
4. ✅ Đủ điều kiện (85 >= 70)
5. ✅ Nhận 100 TUSD reward

### Scenario 2: Join Qua Voting

1. Owner tạo voting period
2. Ứng viên đăng ký và nhận votes
3. Owner kết thúc voting period
4. Người thắng gọi `joinDepartment()`
5. ✅ Đủ điều kiện (là người thắng)
6. ✅ Nhận 100 TUSD reward

## 📊 Contract Addresses

Sau khi deploy, các địa chỉ sẽ được lưu trong `deployment-simple-department-system.json`:

```json
{
  "contracts": {
    "TUSDToken": "0x...",
    "SimpleTestManagement": "0x...",
    "SimpleVotingManagement": "0x...",
    "DepartmentManagement": "0x..."
  },
  "config": {
    "joinRewardAmountFormatted": "100 TUSD"
  }
}
```

## ⚙️ Environment Variables

Thêm vào `.env`:

```env
# Department Management System
TUSD_TOKEN_ADDRESS=0x...
SIMPLE_TEST_MANAGEMENT_ADDRESS=0x...
SIMPLE_VOTING_MANAGEMENT_ADDRESS=0x...
DEPARTMENT_MANAGEMENT_ADDRESS=0x...

# Network
RPC_URL=http://localhost:8545
```

## 🔍 Testing

### Kiểm Tra Điều Kiện Trước Khi Join

```javascript
const [qualified, method] = await departmentManagement.checkQualification(
  "dept-001",
  "did:employee:123"
);

console.log("Qualified:", qualified);
console.log("Method:", method); // "test" hoặc "voting"
```

### Kiểm Tra Membership

```javascript
const isMember = await departmentManagement.isMemberOfDepartment(
  "dept-001",
  "did:employee:123"
);

console.log("Is member:", isMember);
```

## 💡 Lưu Ý

1. **Simplified Version**: 
   - Test: Chỉ cần ghi điểm, không cần câu hỏi chi tiết
   - Voting: Đơn giản, không có cơ chế phức tạp
   - Phù hợp cho demo, không phải production

2. **TUSD Token**:
   - Deploy tự động khi chạy script
   - Có 1 triệu TUSD cho deployer
   - Cần approve và deposit vào DepartmentManagement contract

3. **Localhost Network**:
   - Chạy `npx hardhat node` trước
   - Không cần Sepolia hay testnet khác
   - Phù hợp cho development và demo

4. **Gas Cost**:
   - Localhost không tốn gas thật
   - Có thể test thoải mái

## 📚 Files

- `SimpleTestManagement.sol` - Test management đơn giản
- `SimpleVotingManagement.sol` - Voting management đơn giản
- `DepartmentManagement.sol` - Department management với TUSD reward
- `deploy-simple-department-system.js` - Deploy script
- `TestUSDT.sol` - TUSD token contract

---

**Phiên bản:** Simplified Demo  
**Network:** Localhost  
**Token:** TUSD (TestUSDT)

