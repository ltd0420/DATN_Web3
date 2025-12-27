# Hướng Dẫn Demo Hệ Thống Quản Lý Phòng Ban Web3

## 📋 Tổng Quan

Hệ thống quản lý phòng ban Web3 đầy đủ với:
- ✅ **Backend API** - RESTful APIs đầy đủ
- ✅ **Frontend UI** - Giao diện demo
- ✅ **Database Models** - MongoDB models
- ✅ **TUSD Integration** - Tự động thưởng TUSD khi join
- ✅ **Mock Blockchain** - Không cần blockchain thật, phù hợp demo

## 🚀 Cài Đặt và Chạy

### 1. Backend Setup

```bash
cd backend
npm install
```

### 2. Database

Đảm bảo MongoDB đang chạy. Hệ thống sẽ tự động tạo collections:
- `department_web3`
- `department_members`
- `test_results`
- `voting_periods`
- `voting_candidates`
- `voting_votes`

### 3. Start Backend

```bash
cd backend
npm start
# hoặc
node server.js
```

Backend sẽ chạy tại `http://localhost:5000`

### 4. Start Frontend

```bash
cd frontend
npm install
npm start
```

Frontend sẽ chạy tại `http://localhost:3000`

## 📡 API Endpoints

### Department Management

```
GET    /api/web3/departments                    # Lấy tất cả phòng ban
GET    /api/web3/departments/:id                # Lấy phòng ban theo ID
POST   /api/web3/departments                    # Tạo phòng ban mới
GET    /api/web3/departments/:id/members        # Lấy danh sách thành viên
GET    /api/web3/departments/:departmentId/qualification/:employeeDid  # Kiểm tra điều kiện
POST   /api/web3/departments/join               # Tham gia phòng ban
GET    /api/web3/employees/:employeeDid/departments  # Lấy phòng ban của nhân viên
```

### Test Management

```
POST   /api/web3/test/record                    # Ghi điểm test
GET    /api/web3/test/:departmentId/:employeeDid  # Lấy kết quả test
GET    /api/web3/test/department/:id            # Lấy tất cả kết quả test của phòng ban
```

### Voting Management

```
POST   /api/web3/voting/period                  # Tạo kỳ ứng tuyển
POST   /api/web3/voting/register                # Đăng ký ứng viên
POST   /api/web3/voting/vote                    # Vote cho ứng viên
POST   /api/web3/voting/end/:departmentId/:periodId  # Kết thúc kỳ ứng tuyển
GET    /api/web3/voting/:departmentId/:periodId # Lấy thông tin kỳ ứng tuyển
GET    /api/web3/voting/:departmentId/active    # Lấy kỳ ứng tuyển đang active
```

## 🎯 Demo Workflow

### Bước 1: Admin Tạo Phòng Ban

**Frontend:** Vào Admin Dashboard → Department Web3 Management → Create Department

**Hoặc API:**
```bash
POST /api/web3/departments
{
  "department_id": "dept-frontend",
  "department_name": "Frontend Development",
  "require_test": true,
  "min_test_score": 70,
  "require_voting": true,
  "min_votes": 1,
  "voting_period_days": 7,
  "join_reward_tusd": 100
}
```

### Bước 2: Nhân Viên Làm Test (Nếu có yêu cầu test)

**Frontend:** Vào Employee Dashboard → Join Web3 Departments → Record Test Score

**Hoặc API:**
```bash
POST /api/web3/test/record
{
  "departmentId": "dept-frontend",
  "employeeDid": "did:employee:123",
  "score": 85
}
```

### Bước 3: Tạo Kỳ Ứng Tuyển (Nếu có yêu cầu voting)

**API:**
```bash
POST /api/web3/voting/period
{
  "departmentId": "dept-frontend",
  "durationInDays": 7
}
```

**Đăng ký ứng viên:**
```bash
POST /api/web3/voting/register
{
  "departmentId": "dept-frontend",
  "periodId": 1,
  "employeeDid": "did:employee:123",
  "walletAddress": "0x1234..."
}
```

**Vote:**
```bash
POST /api/web3/voting/vote
{
  "departmentId": "dept-frontend",
  "periodId": 1,
  "candidateDid": "did:employee:123",
  "voterAddress": "0x5678..."
}
```

**Kết thúc kỳ:**
```bash
POST /api/web3/voting/end/dept-frontend/1
```

### Bước 4: Nhân Viên Tham Gia Phòng Ban

**Frontend:** Vào Employee Dashboard → Join Web3 Departments → Click "Join Department"

**Hoặc API:**
```bash
POST /api/web3/departments/join
{
  "departmentId": "dept-frontend",
  "employeeDid": "did:employee:123",
  "walletAddress": "0x1234..."
}
```

**Kết quả:**
- ✅ Tự động kiểm tra điều kiện (test hoặc voting)
- ✅ Nếu đủ điều kiện → Tự động thêm vào phòng ban
- ✅ Tự động thưởng TUSD (mock transfer)
- ✅ Trả về thông tin reward

## 💰 TUSD Integration

### Mock Blockchain Service

Hiện tại sử dụng `mockBlockchainService` trong `departmentWeb3Service.js`:
- Mock transfer TUSD
- Trả về transaction hash giả
- Không cần blockchain thật

### Thay Bằng Real Blockchain

Để tích hợp blockchain thật, thay `mockBlockchainService` trong `departmentWeb3Service.js`:

```javascript
const realBlockchainService = {
  async transferTUSD(toAddress, amount) {
    // Gọi smart contract thật
    const tx = await tusdTokenContract.transfer(toAddress, amount);
    return {
      success: true,
      transactionHash: tx.hash,
      amount: amount
    };
  }
};
```

## 🎨 Frontend Components

### Admin Components

- `DepartmentWeb3Management.js` - Quản lý phòng ban Web3
  - Tạo phòng ban mới
  - Xem danh sách phòng ban
  - Quản lý test và voting

### Employee Components

- `DepartmentWeb3Join.js` - Tham gia phòng ban Web3
  - Xem danh sách phòng ban
  - Ghi điểm test
  - Tham gia phòng ban
  - Nhận TUSD reward

## 📊 Database Schema

### DepartmentWeb3
```javascript
{
  department_id: String (unique),
  department_name: String,
  is_active: Boolean,
  require_test: Boolean,
  min_test_score: Number,
  require_voting: Boolean,
  min_votes: Number,
  voting_period_days: Number,
  join_reward_tusd: Number
}
```

### DepartmentMember
```javascript
{
  department_id: String,
  employee_did: String,
  wallet_address: String,
  qualification_method: String ('test' | 'voting'),
  test_score: Number,
  votes_received: Number,
  tusd_reward_received: Number,
  reward_transaction_hash: String,
  is_active: Boolean,
  joined_at: Date
}
```

### TestResult
```javascript
{
  employee_did: String,
  department_id: String,
  score: Number (0-100),
  max_score: Number,
  submitted_at: Date
}
```

### VotingPeriod
```javascript
{
  department_id: String,
  period_id: Number,
  start_time: Date,
  end_time: Date,
  is_active: Boolean,
  is_ended: Boolean,
  winner_did: String,
  winner_votes: Number
}
```

## 🔍 Testing

### Test với Postman/curl

1. **Tạo phòng ban:**
```bash
curl -X POST http://localhost:5000/api/web3/departments \
  -H "Content-Type: application/json" \
  -d '{
    "department_id": "dept-test",
    "department_name": "Test Department",
    "require_test": true,
    "min_test_score": 70,
    "join_reward_tusd": 100
  }'
```

2. **Ghi điểm test:**
```bash
curl -X POST http://localhost:5000/api/web3/test/record \
  -H "Content-Type: application/json" \
  -d '{
    "departmentId": "dept-test",
    "employeeDid": "did:employee:123",
    "score": 85
  }'
```

3. **Tham gia phòng ban:**
```bash
curl -X POST http://localhost:5000/api/web3/departments/join \
  -H "Content-Type: application/json" \
  -d '{
    "departmentId": "dept-test",
    "employeeDid": "did:employee:123",
    "walletAddress": "0x1234..."
  }'
```

## ⚠️ Lưu Ý

1. **Mock Blockchain:**
   - Hiện tại dùng mock service
   - Transaction hash là giả
   - Phù hợp cho demo, không phải production

2. **Authentication:**
   - Một số routes có thể cần authentication
   - Có thể disable tạm thời cho demo

3. **Database:**
   - Cần MongoDB đang chạy
   - Collections sẽ tự động tạo

4. **Frontend Integration:**
   - Cần thêm routes vào App.js để truy cập components
   - Cần thêm vào AdminDashboard và EmployeeDashboard

## 📝 Next Steps

1. **Thêm vào App.js:**
```javascript
import DepartmentWeb3Management from './components/admin/DepartmentWeb3Management';
import DepartmentWeb3Join from './components/dashboard/DepartmentWeb3Join';
```

2. **Thêm vào AdminDashboard:**
```javascript
<Route path="/admin/departments-web3" element={<DepartmentWeb3Management user={user} />} />
```

3. **Thêm vào EmployeeDashboard:**
```javascript
<Route path="/departments-web3" element={<DepartmentWeb3Join user={user} />} />
```

## 🎉 Hoàn Thành!

Hệ thống đã sẵn sàng để demo với:
- ✅ Backend API đầy đủ
- ✅ Frontend components
- ✅ Database models
- ✅ TUSD integration (mock)
- ✅ Test và Voting management

---

**Phiên bản:** 1.0  
**Ngày tạo:** 2024

