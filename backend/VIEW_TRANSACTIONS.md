# 🔍 Xem Transactions On-Chain trên Sepolia

## 📊 Transaction Vừa Thực Hiện

Từ log backend, bạn vừa có transaction:

### Test Score Recording Transaction

**Transaction Hash:** `0x5e956b0e4271d12bb0853e468f6822f04e2680c6f2ecb1304354758f0df38e42`

**Block Number:** `9922224`

**Contract:** SimpleTestManagement (`0x5d8a0496eb787165aC77337b1a078f07257D3b5B`)

**Xem trên Etherscan:**
👉 https://sepolia.etherscan.io/tx/0x5e956b0e4271d12bb0853e468f6822f04e2680c6f2ecb1304354758f0df38e42

---

## 📋 Contract Addresses

### SimpleTestManagement
**Address:** `0x5d8a0496eb787165aC77337b1a078f07257D3b5B`

**Xem trên Etherscan:**
👉 https://sepolia.etherscan.io/address/0x5d8a0496eb787165aC77337b1a078f07257D3b5B

**Xem tất cả transactions:**
👉 https://sepolia.etherscan.io/address/0x5d8a0496eb787165aC77337b1a078f07257D3b5B#internaltx

### DepartmentManagement
**Address:** `0xBAAe2F5D4C8c26Bc3D1954fe30914aAF3a1EC7D1`

**Xem trên Etherscan:**
👉 https://sepolia.etherscan.io/address/0xBAAe2F5D4C8c26Bc3D1954fe30914aAF3a1EC7D1

**Xem tất cả transactions:**
👉 https://sepolia.etherscan.io/address/0xBAAe2F5D4C8c26Bc3D1954fe30914aAF3a1EC7D1#internaltx

### SimpleVotingManagement
**Address:** `0x500ddf8b3266Fb5c8eEC132EeD9ef3dB7f53327c`

**Xem trên Etherscan:**
👉 https://sepolia.etherscan.io/address/0x500ddf8b3266Fb5c8eEC132EeD9ef3dB7f53327c

### TUSD Token
**Address:** `0x052bd64b3f565698270f3fcdf98d7502d21f2377`

**Xem trên Etherscan:**
👉 https://sepolia.etherscan.io/address/0x052bd64b3f565698270f3fcdf98d7502d21f2377

---

## 🔍 Cách Xem Chi Tiết Transaction

1. **Click vào link transaction hash** để xem:
   - Block number
   - Gas used
   - Gas price
   - From/To addresses
   - Input data (function call)
   - Events (logs)

2. **Xem Events:**
   - Tìm tab "Logs" hoặc "Events"
   - Sẽ thấy event `TestScoreRecorded` với:
     - `departmentId`
     - `employeeDid`
     - `score`

3. **Xem tất cả transactions của contract:**
   - Click vào contract address
   - Tab "Transactions" - Tất cả transactions
   - Tab "Internal Txns" - Internal transactions
   - Tab "Events" - Tất cả events

---

## 📱 Quick Links

### Transaction vừa thực hiện:
https://sepolia.etherscan.io/tx/0x5e956b0e4271d12bb0853e468f6822f04e2680c6f2ecb1304354758f0df38e42

### SimpleTestManagement Contract:
https://sepolia.etherscan.io/address/0x5d8a0496eb787165aC77337b1a078f07257D3b5B

### DepartmentManagement Contract:
https://sepolia.etherscan.io/address/0xBAAe2F5D4C8c26Bc3D1954fe30914aAF3a1EC7D1

---

## 🎯 Các Loại Transactions Sẽ Thấy

1. **Test Score Recording** (vừa thực hiện)
   - Function: `recordTestScore(departmentId, employeeDid, score)`
   - Event: `TestScoreRecorded`

2. **Create Department** (khi admin tạo phòng ban)
   - Function: `createDepartment(...)`
   - Event: `DepartmentCreated`

3. **Join Department** (khi nhân viên tham gia)
   - Function: `joinDepartment(departmentId, employeeDid, walletAddress)`
   - Events: `EmployeeJoined`, `JoinRewardPaid` (nếu có TUSD)

---

**Lưu ý:** Tất cả transactions đều được lưu vĩnh viễn trên Sepolia blockchain và có thể xem công khai trên Etherscan!

