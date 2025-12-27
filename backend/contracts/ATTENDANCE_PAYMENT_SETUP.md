# Attendance Payment Smart Contract - Setup Guide

## Tổng quan

Smart contract `AttendancePayment.sol` tự động chuyển tiền lương cho nhân viên khi họ checkout, với các quy tắc:

- **Mức lương**: 2 USDT/giờ
- **Giờ tối thiểu**: 4 giờ (nếu làm < 4 giờ sẽ không được chuyển tiền)
- **Tự động**: Không cần admin phê duyệt, tự động chuyển khi checkout

## Deploy Contract

### 1. Compile Contract

```bash
cd backend/contracts
npx hardhat compile
```

### 2. Deploy Contract

Sử dụng script deploy hoặc Remix IDE:

```javascript
// Deploy với token address
const AttendancePayment = await ethers.getContractFactory("AttendancePayment");
const tokenAddress = "0x6B5A4dfcb3c76EF57A5B6Bb928541Ef4807dfA38"; // TestUSDT address
const attendancePayment = await AttendancePayment.deploy(tokenAddress);
await attendancePayment.deployed();
console.log("AttendancePayment deployed to:", attendancePayment.address);
```

### 3. Cấu hình Environment Variables

Thêm vào file `.env`:

```env
# Attendance Payment Contract
ATTENDANCE_PAYMENT_ADDRESS=0x... # Địa chỉ contract vừa deploy
ATTENDANCE_PAYMENT_PRIVATE_KEY=... # Private key của admin (có thể dùng HR_PAYROLL_PRIVATE_KEY)
TOKEN_ADDRESS=0x6B5A4dfcb3c76EF57A5B6Bb928541Ef4807dfA38 # TestUSDT address
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

### 4. Nạp tiền vào Contract

Contract cần có token để chuyển cho nhân viên. Có 2 cách:

**Cách 1: Transfer trực tiếp**
```javascript
// Approve contract trước
await tokenContract.approve(ATTENDANCE_PAYMENT_ADDRESS, ethers.parseEther("1000"));

// Transfer tokens vào contract
await tokenContract.transfer(ATTENDANCE_PAYMENT_ADDRESS, ethers.parseEther("1000"));
```

**Cách 2: Sử dụng depositTokens function (cần approve trước)**
```javascript
// Approve
await tokenContract.approve(ATTENDANCE_PAYMENT_ADDRESS, ethers.parseEther("1000"));

// Deposit
await attendancePayment.depositTokens(1000); // 1000 USDT
```

## Quy trình hoạt động

### 1. Check-in (6:00 AM - 5:00 PM)
- Nhân viên check-in từ 6h sáng đến 5h chiều
- Sau 5h chiều không thể check-in

### 2. Check-out (trước 7:00 PM)
- Nhân viên có thể check-out trước 7h tối
- Sau 7h tối chức năng chấm công bị khóa
- Từ 5h chiều đến 7h tối là giờ tăng ca

### 3. Tự động thanh toán
Khi nhân viên checkout:
1. Hệ thống tính tổng giờ làm việc
2. Kiểm tra: Nếu >= 4 giờ → Tính lương (giờ × 2 USDT)
3. Gọi smart contract để tự động chuyển tiền
4. Lưu transaction hash vào database

### 4. Điều kiện thanh toán
- ✅ Làm việc >= 4 giờ → Nhận lương
- ❌ Làm việc < 4 giờ → Không nhận lương

## API Endpoints

### Check-out (tự động thanh toán)

```javascript
POST /api/attendance/checkout
{
  "employee_did": "did:employee:123",
  "ngay": "2024-01-15",
  "gio_ra": "17:30:00"
}

// Response
{
  "_id": "...",
  "employee_did": "did:employee:123",
  "ngay": "2024-01-15",
  "gio_vao": "08:00:00",
  "gio_ra": "17:30:00",
  "tong_gio_lam": 9.5,
  "luong_tinh_theo_gio": 19, // 9.5h × 2 USDT
  "payment": {
    "success": true,
    "transactionHash": "0x...",
    "usdtAmount": 19,
    "message": "Payment successful"
  }
}
```

## Testing

### Test với script

```bash
cd backend
node scripts/test-attendance-payment.js
```

### Test thủ công

1. Check-in lúc 8:00 AM
2. Check-out lúc 5:30 PM (9.5 giờ)
3. Kiểm tra:
   - Database có `salary_transaction_hash`
   - Wallet nhân viên nhận được 19 USDT (9.5 × 2)
   - Contract balance giảm đi 19 USDT

## Lưu ý

1. **Contract Balance**: Đảm bảo contract luôn có đủ token để thanh toán
2. **Gas Fees**: Admin wallet cần có ETH để trả gas khi gọi contract
3. **Minimum Hours**: Nhân viên làm < 4 giờ sẽ không nhận lương (theo yêu cầu)
4. **Duplicate Payment**: Contract ngăn chặn thanh toán trùng lặp cho cùng một ngày

## Troubleshooting

### Lỗi "Insufficient contract balance"
- Nạp thêm token vào contract
- Kiểm tra balance: `await attendancePayment.getContractBalance()`

### Lỗi "Minimum 4 hours required"
- Nhân viên làm < 4 giờ, không đủ điều kiện nhận lương
- Đây là hành vi mong muốn, không phải lỗi

### Lỗi "Already paid for this date"
- Đã thanh toán cho ngày này rồi
- Kiểm tra: `await attendancePayment.checkPaymentStatus(employeeDid, date)`

