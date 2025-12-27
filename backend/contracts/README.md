# Smart Contracts Documentation

## HRPayroll Contract

Contract quản lý thanh toán lương và thưởng sử dụng ERC20 token (TestUSDT).

### Features

- ✅ Thanh toán lương/thưởng tự động qua ERC20 token
- ✅ Quản lý bởi admin address
- ✅ Event logging cho audit trail
- ✅ Đơn giản và hiệu quả về gas

### Contract Address

**HRPayroll Safe Address:** `0xfAFaf2532b6148fA52e3ff0453dEcc85417bb33E`

### Deployment

#### 1. Cài đặt dependencies

```bash
cd backend
npm install
```

#### 2. Cấu hình môi trường

Tạo file `.env` trong thư mục `backend`:

```env
# HRPayroll Contract (Két sắt)
HR_PAYROLL_ADDRESS=0xfAFaf2532b6148fA52e3ff0453dEcc85417bb33E
HR_PAYROLL_PRIVATE_KEY=f596f9e97e9b0d3e614cd8a65c9eda5e9c553a80d67656f4cc116db12ef95bef

# Token Address (TestUSDT)
TOKEN_ADDRESS=0x052bd64b3f565698270f3fcdf98d7502d21f2377

# RPC URL
RPC_URL=http://localhost:8545
# Hoặc cho Sepolia:
# RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
```

#### 3. Deploy contract (nếu chưa deploy)

**Deploy lên localhost:**
```bash
npm run deploy:hrpayroll
```

**Deploy lên Sepolia testnet:**
```bash
npm run deploy:hrpayroll:sepolia
```

Script sẽ:
1. Deploy TestUSDT token
2. Deploy HRPayroll contract với token address
3. Transfer tokens vào contract (optional)

### Contract Functions

#### Payment

```solidity
// Pay salary/reward to employee
function paySalary(
    string memory _employeeDid,
    address _employeeWallet,
    uint256 _amount
) public
```

**Requirements:**
- Chỉ admin mới có thể gọi hàm này
- Contract phải có đủ token balance
- Employee wallet address phải hợp lệ

### Events

Contract emit các events sau:

- `SalaryPaid(string employeeDid, address walletAddress, uint256 amount)` - Khi thanh toán lương/thưởng

### Nạp Token vào Contract

Contract cần có token balance để thanh toán. Có 3 cách nạp:

**Cách 1: Qua API (Khuyến nghị)**
```bash
POST /api/payroll/deposit
Headers: { Authorization: "Bearer <super_admin_token>" }
Body: { "amount": 100000 }  # 100,000 TUSD
```

**Cách 2: Transfer trực tiếp từ MetaMask**
- Mở MetaMask
- Gửi TestUSDT đến địa chỉ: `0xfAFaf2532b6148fA52e3ff0453dEcc85417bb33E`

**Cách 3: Qua script**
```bash
node scripts/transfer-tokens-to-contract.js
```

### Integration với Backend

Backend sử dụng `ethers.js` để tương tác với contract. Xem `backend/services/payrollContractService.js` để biết cách sử dụng.

**Các hàm chính:**
- `payTaskReward(employeeDid, rewardAmount, taskId)` - Thanh toán thưởng task
- `getContractBalance()` - Lấy số dư token của contract
- `transferTokensToContract(amount)` - Nạp token vào contract
- `getContractInfo()` - Lấy thông tin contract

### Quy trình Thanh toán Tự động

1. **Admin giao task** → Hệ thống tính toán reward
2. **Nhân viên hoàn thành** → Cập nhật tiến độ 100%
3. **Super Admin approve** → Tự động gọi `payTaskReward()`
4. **Contract chuyển token** → Từ contract address vào ví nhân viên
5. **Lưu transaction hash** → Vào database

### Security Best Practices

1. ✅ Chỉ admin mới có thể gọi `paySalary()`
2. ✅ Kiểm tra balance trước khi thanh toán
3. ✅ Events cho audit trail
4. ✅ Validate input parameters

### Troubleshooting

#### 1. "Insufficient contract token balance"

**Nguyên nhân**: Contract không có đủ token

**Giải pháp**: 
- Nạp token vào contract: `POST /api/payroll/deposit`
- Hoặc transfer trực tiếp từ MetaMask

#### 2. "Only Admin"

**Nguyên nhân**: Private key không phải admin của contract

**Giải pháp**: 
- Kiểm tra `HR_PAYROLL_PRIVATE_KEY` trong `.env`
- Đảm bảo address từ private key là admin của contract

#### 3. "Low signer wallet balance"

**Nguyên nhân**: Wallet dùng để ký transaction không có đủ ETH cho gas

**Giải pháp**: 
- Nạp ETH vào wallet của `HR_PAYROLL_PRIVATE_KEY`

### References

- [Ethers.js Documentation](https://docs.ethers.org/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Solidity Documentation](https://docs.soliditylang.org)
- [ERC20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)
