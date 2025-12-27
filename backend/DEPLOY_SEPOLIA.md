# Hướng Dẫn Deploy Department Management lên Sepolia Testnet

## 📋 Yêu Cầu

1. **Sepolia ETH** trong wallet để trả gas fees
2. **TUSD Token** đã được deploy (hoặc sử dụng token có sẵn)
3. **Private Key** của wallet deployer
4. **RPC URL** cho Sepolia testnet

## 🚀 Bước 1: Chuẩn Bị Environment Variables

Tạo hoặc cập nhật file `.env` trong thư mục `backend/`:

```env
# Blockchain Network (Sepolia Testnet)
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com

# Private Key để deploy và sign transactions
DEPARTMENT_MANAGEMENT_PRIVATE_KEY=f596f9e97e9b0d3e614cd8a65c9eda5e9c553a80d67656f4cc116db12ef95bef
# Hoặc dùng chung với HR_PAYROLL_PRIVATE_KEY:
# HR_PAYROLL_PRIVATE_KEY=f596f9e97e9b0d3e614cd8a65c9eda5e9c553a80d67656f4cc116db12ef95bef

# TUSD Token Address (đã có sẵn)
TOKEN_ADDRESS=0x052bd64b3f565698270f3fcdf98d7502d21f2377
# Hoặc:
# TUSD_TOKEN_ADDRESS=0x052bd64b3f565698270f3fcdf98d7502d21f2377

# Các config khác
MONGODB_URI=mongodb+srv://nguyenhuy4435:nhathuy812@clusterweb3.5tqfgfq.mongodb.net/?retryWrites=true&w=majority&appName=ClusterWeb3
JWT_SECRET=your_jwt_secret_here
PORT=5000
FRONTEND_URL=http://localhost:3000
```

## 🔨 Bước 2: Deploy Contracts

```bash
cd backend

# Deploy lên Sepolia testnet
npx hardhat run scripts/deploy-department-to-sepolia.js --network sepolia
```

Script sẽ:
1. Deploy `SimpleTestManagement` contract
2. Deploy `SimpleVotingManagement` contract  
3. Deploy `DepartmentManagement` contract (sử dụng TUSD token có sẵn)
4. Deposit 10,000 TUSD vào contract (nếu có đủ balance)
5. Lưu deployment info vào `deployment-department-sepolia.json`

**Output mẫu:**
```
Deploying contracts with the account: 0xfAFaf2532b6148fA52e3ff0453dEcc85417bb33E
Account balance: 0.5 ETH

=== Using existing TUSD Token ===
TUSD Token address: 0x052bd64b3f565698270f3fcdf98d7502d21f2377
Token Symbol: TUSD
Token Decimals: 18
Deployer TUSD balance: 50000.0

=== Deploying SimpleTestManagement ===
SimpleTestManagement deployed to: 0x...

=== Deploying SimpleVotingManagement ===
SimpleVotingManagement deployed to: 0x...

=== Deploying DepartmentManagement ===
Join reward amount: 100.0 TUSD
DepartmentManagement deployed to: 0x...

=== Depositing TUSD to DepartmentManagement ===
Depositing: 10000.0 TUSD
Approved TUSD transfer
Deposited TUSD to contract
Contract TUSD balance: 10000.0 TUSD

=== Environment Variables to Add ===
DEPARTMENT_MANAGEMENT_ADDRESS=0x...
SIMPLE_TEST_MANAGEMENT_ADDRESS=0x...
TUSD_TOKEN_ADDRESS=0x052bd64b3f565698270f3fcdf98d7502d21f2377
```

## ⚙️ Bước 3: Cập Nhật .env với Contract Addresses

Sau khi deploy thành công, thêm các addresses vào `.env`:

```env
# Department Management Contracts (sau khi deploy)
DEPARTMENT_MANAGEMENT_ADDRESS=0x...  # Từ output deploy
SIMPLE_TEST_MANAGEMENT_ADDRESS=0x...  # Từ output deploy
TUSD_TOKEN_ADDRESS=0x052bd64b3f565698270f3fcdf98d7502d21f2377
```

## 🚀 Bước 4: Khởi Động Backend

```bash
cd backend
npm start
```

Backend sẽ tự động:
1. Kết nối với Sepolia testnet qua RPC_URL
2. Initialize contracts với addresses đã cấu hình
3. Sẵn sàng xử lý các transactions on-chain

**Log mẫu khi khởi động thành công:**
```
[Server] Initializing Department Contract Service...
[initializeDepartmentContractService] Connecting to RPC: https://ethereum-sepolia-rpc.publicnode.com
[initializeDepartmentContractService] RPC connection successful
[initializeDepartmentContractService] Signer wallet: 0xfAFaf2532b6148fA52e3ff0453dEcc85417bb33E
[initializeDepartmentContractService] DepartmentManagement contract verified at 0x...
[initializeDepartmentContractService] Token contract: TUSD at 0x052bd64b3f565698270f3fcdf98d7502d21f2377
[Server] Department Contract Service initialized successfully
```

## ✅ Bước 5: Kiểm Tra

### 1. Tạo Phòng Ban (Admin)

Khi admin tạo phòng ban mới:
- Transaction sẽ được gửi lên Sepolia
- Có thể xem trên [Sepolia Etherscan](https://sepolia.etherscan.io/)
- Transaction hash được lưu vào database

### 2. Nhân Viên Làm Test

Khi nhân viên submit test:
- Điểm test được ghi lên blockchain
- Transaction hash được lưu vào database

### 3. Nhân Viên Tham Gia Phòng Ban

Khi nhân viên đủ điều kiện và tham gia:
- Gọi `joinDepartment()` trên blockchain
- Nhận 100 TUSD reward (nếu contract có đủ balance)
- Transaction hash được lưu vào database

## 🔍 Kiểm Tra trên Etherscan

1. Mở [Sepolia Etherscan](https://sepolia.etherscan.io/)
2. Tìm contract address (từ deployment output)
3. Xem transactions và events:
   - `DepartmentCreated` - Khi tạo phòng ban
   - `TestScoreRecorded` - Khi ghi điểm test
   - `EmployeeJoined` - Khi nhân viên tham gia
   - `JoinRewardPaid` - Khi thưởng TUSD

## ⚠️ Lưu Ý

1. **Gas Fees:**
   - Mỗi transaction tốn Sepolia ETH
   - Đảm bảo wallet có đủ ETH (ít nhất 0.1 ETH)
   - Có thể xem gas price tại [ETH Gas Station](https://ethgasstation.info/)

2. **Private Key Security:**
   - **KHÔNG** commit private key vào git
   - Sử dụng `.env` và thêm vào `.gitignore`
   - Sử dụng wallet riêng cho testnet

3. **TUSD Token:**
   - Cần approve và deposit TUSD vào DepartmentManagement contract
   - Để thưởng nhân viên khi join
   - Script deploy tự động deposit 10,000 TUSD (nếu có đủ balance)

4. **Network:**
   - Đảm bảo RPC_URL đúng với Sepolia
   - Có thể dùng public RPC hoặc Infura/Alchemy

5. **Contract Addresses:**
   - Mỗi lần deploy sẽ có addresses mới
   - Cần cập nhật `.env` sau mỗi lần deploy mới

## 🐛 Troubleshooting

### Lỗi: "Deployer account has no ETH"
- **Giải pháp:** Nạp Sepolia ETH vào wallet deployer
- Có thể lấy Sepolia ETH từ [Sepolia Faucet](https://sepoliafaucet.com/)

### Lỗi: "Failed to verify token contract"
- **Giải pháp:** Kiểm tra TOKEN_ADDRESS có đúng không
- Đảm bảo contract là ERC20 token hợp lệ

### Lỗi: "RPC connection failed"
- **Giải pháp:** Kiểm tra RPC_URL có đúng không
- Thử RPC khác: `https://rpc.sepolia.org` hoặc Infura/Alchemy

### Lỗi: "Insufficient funds for gas"
- **Giải pháp:** Nạp thêm Sepolia ETH vào wallet

## 📚 Tài Liệu Tham Khảo

- [DEPARTMENT_BLOCKCHAIN_SETUP.md](./DEPARTMENT_BLOCKCHAIN_SETUP.md) - Tài liệu tổng quan
- [Sepolia Etherscan](https://sepolia.etherscan.io/) - Explorer cho Sepolia
- [Sepolia Faucet](https://sepoliafaucet.com/) - Lấy Sepolia ETH miễn phí

---

**Phiên bản:** 1.0  
**Network:** Sepolia Testnet

