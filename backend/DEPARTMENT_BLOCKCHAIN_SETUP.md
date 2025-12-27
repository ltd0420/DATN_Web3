# Hướng Dẫn Tích Hợp Smart Contracts cho Department Management

## 📋 Tổng Quan

Hệ thống Department Management đã được tích hợp với smart contracts trên blockchain. Hệ thống sẽ tự động:
- Tạo phòng ban trên blockchain
- Ghi điểm test trên blockchain
- Kiểm tra điều kiện tham gia từ blockchain
- Thêm nhân viên vào phòng ban trên blockchain

Nếu blockchain không được cấu hình, hệ thống sẽ tự động fallback về off-chain mode (sử dụng MongoDB).

## 🚀 Bước 1: Deploy Smart Contracts

### 1.1. Start Local Blockchain (cho development)

```bash
cd backend
npx hardhat node
```

Giữ terminal này chạy, mở terminal mới.

### 1.2. Deploy Contracts

```bash
cd backend
npx hardhat run scripts/deploy-simple-department-system.js --network localhost
```

Kết quả sẽ được lưu vào `deployment-simple-department-system.json`:

```json
{
  "contracts": {
    "TUSDToken": "0x...",
    "SimpleTestManagement": "0x...",
    "SimpleVotingManagement": "0x...",
    "DepartmentManagement": "0x..."
  }
}
```

### 1.3. Deploy lên Testnet (Sepolia, Goerli, etc.)

```bash
# Cấu hình network trong hardhat.config.js trước
npx hardhat run scripts/deploy-simple-department-system.js --network sepolia
```

## ⚙️ Bước 2: Cấu Hình Environment Variables

Thêm vào file `.env` trong thư mục `backend/`:

```env
# Blockchain Network
RPC_URL=http://localhost:8545
# Hoặc cho testnet:
# RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# Department Management Contracts
DEPARTMENT_MANAGEMENT_ADDRESS=0x...
SIMPLE_TEST_MANAGEMENT_ADDRESS=0x...
TUSD_TOKEN_ADDRESS=0x...

# Private Key để sign transactions (phải là owner của contracts)
DEPARTMENT_MANAGEMENT_PRIVATE_KEY=0x...
# Hoặc dùng chung với HR_PAYROLL_PRIVATE_KEY:
# HR_PAYROLL_PRIVATE_KEY=0x...
```

## 🔄 Bước 3: Khởi Động Backend

```bash
cd backend
npm start
```

Backend sẽ tự động:
1. Kết nối với blockchain qua RPC_URL
2. Initialize contracts với addresses đã cấu hình
3. Nếu không có config → chạy ở off-chain mode

## 📝 Cách Hoạt Động

### Tạo Phòng Ban

Khi admin tạo phòng ban:
1. **Nếu có blockchain config:**
   - Tạo phòng ban trên blockchain (transaction)
   - Lưu transaction hash vào database
   - Lưu thông tin vào MongoDB

2. **Nếu không có blockchain config:**
   - Chỉ lưu vào MongoDB (off-chain mode)

### Nhân Viên Làm Test

Khi nhân viên submit test:
1. **Nếu có blockchain config:**
   - Ghi điểm test lên blockchain (transaction)
   - Lưu vào MongoDB

2. **Nếu không có blockchain config:**
   - Chỉ lưu vào MongoDB

### Nhân Viên Tham Gia Phòng Ban

Khi nhân viên đủ điều kiện và tham gia:
1. **Nếu có blockchain config:**
   - Kiểm tra điều kiện trên blockchain
   - Gọi `joinDepartment()` trên blockchain (transaction)
   - Nhận TUSD reward (nếu có)
   - Lưu transaction hash vào database
   - Lưu vào MongoDB

2. **Nếu không có blockchain config:**
   - Kiểm tra điều kiện từ MongoDB
   - Lưu vào MongoDB

## 🔍 Kiểm Tra Trạng Thái

### Check Service Status

Backend sẽ log khi khởi động:
```
[Server] Initializing Department Contract Service...
[initializeDepartmentContractService] Connecting to RPC: http://localhost:8545
[initializeDepartmentContractService] Signer wallet: 0x...
[initializeDepartmentContractService] DepartmentManagement contract verified at 0x...
[Server] Department Contract Service initialized successfully
```

### Check Off-Chain Mode

Nếu không có config:
```
[Server] Department Contract Service not configured. Using off-chain mode.
```

## ⚠️ Lưu Ý

1. **Gas Fees:**
   - Mỗi transaction tốn gas
   - Cần đảm bảo wallet có đủ ETH để trả gas
   - Localhost không tốn gas thật

2. **Private Key Security:**
   - **KHÔNG** commit private key vào git
   - Sử dụng environment variables
   - Sử dụng wallet riêng cho development

3. **Contract Addresses:**
   - Mỗi network có addresses khác nhau
   - Cần cập nhật `.env` khi deploy lên network mới

4. **Fallback Mode:**
   - Hệ thống tự động fallback về off-chain nếu blockchain không available
   - Không cần cấu hình gì thêm
   - Vẫn hoạt động bình thường với MongoDB

5. **TUSD Token:**
   - Cần approve và deposit TUSD vào DepartmentManagement contract
   - Để thưởng nhân viên khi join (nếu có)
   - Script deploy đã tự động deposit 10,000 TUSD

## 🧪 Testing

### Test Local Blockchain

```bash
# Terminal 1: Start local blockchain
npx hardhat node

# Terminal 2: Deploy contracts
npx hardhat run scripts/deploy-simple-department-system.js --network localhost

# Terminal 3: Start backend
npm start
```

### Test với Testnet

1. Deploy contracts lên testnet
2. Cấu hình `.env` với testnet RPC và addresses
3. Nạp testnet ETH vào wallet
4. Start backend

## 📚 Tài Liệu Tham Khảo

- [DEPARTMENT_SYSTEM_README.md](./contracts/DEPARTMENT_SYSTEM_README.md) - Tài liệu smart contracts
- [SIMPLE_DEPARTMENT_DEMO.md](./contracts/SIMPLE_DEPARTMENT_DEMO.md) - Hướng dẫn demo
- [deploy-simple-department-system.js](./scripts/deploy-simple-department-system.js) - Deploy script

---

**Phiên bản:** 1.0  
**Ngày tạo:** 2024

