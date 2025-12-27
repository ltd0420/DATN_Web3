# 🔗 Vị Trí Hiển Thị Link Blockchain Transaction

## 📍 Các Vị Trí Link Sẽ Hiển Thị

### 1. **Sau Khi Làm Bài Test** ✅

**Vị trí:** Trong component `DepartmentTest` - Sau khi submit test thành công

**Khi nào hiển thị:**
- Sau khi nhân viên làm bài test và submit thành công
- Khi có transaction hash từ blockchain

**Giao diện:**
```
┌─────────────────────────────────┐
│   Hoàn Thành Bài Test!          │
│   Điểm: 100%                    │
│   60 / 60 điểm                  │
│                                 │
│   [Xem Transaction trên Etherscan] │ ← Link ở đây
│   Block: 9922224                │
└─────────────────────────────────┘
```

**File:** `frontend/src/components/dashboard/DepartmentTest.js` (dòng 211-227)

---

### 2. **Trong Thông Tin Phòng Ban** ✅

**Vị trí:** Trong component `DepartmentInfo` - Card "Thông Tin Phòng Ban"

**Khi nào hiển thị:**
- Khi nhân viên đã join phòng ban qua blockchain
- Khi có `blockchain_tx_hash` trong member info

**Giao diện:**
```
┌─────────────────────────────────┐
│   Phòng Hỗ trợ kỹ thuật         │
│   Trưởng phòng: ...             │
│   Tổng số nhân viên: 2          │
│   ─────────────────────────     │
│   [Xem Transaction Join Department] │ ← Link ở đây
└─────────────────────────────────┘
```

**File:** `frontend/src/components/dashboard/DepartmentInfo.js` (dòng 540-552)

---

## 🔍 Cách Kiểm Tra Link Có Hiển Thị

### Kiểm tra 1: Test Transaction

1. **Làm bài test** cho một phòng ban
2. **Submit test** thành công
3. **Xem kết quả** - Link sẽ hiển thị ngay dưới điểm số

**Nếu không thấy link:**
- Kiểm tra console log backend: `[testController] Transaction hash: ...`
- Kiểm tra database: `test_results` collection có field `transaction_hash` không
- Kiểm tra network tab: Xem response có `blockchain.transaction_hash` không

### Kiểm tra 2: Join Department Transaction

1. **Vào trang "Thông Tin Phòng Ban"**
2. **Xem card "Thông Tin Phòng Ban"** (tab đầu tiên)
3. **Link sẽ hiển thị** ở cuối card (sau "Tổng số nhân viên")

**Nếu không thấy link:**
- Kiểm tra `web3Department` có data không: `console.log(web3Department)`
- Kiểm tra `web3Department.member.blockchain_tx_hash` có giá trị không
- Kiểm tra API response: `/api/web3/departments/{id}?employeeDid={did}`

---

## 🐛 Troubleshooting

### Link không hiển thị sau test:

**Nguyên nhân có thể:**
1. Backend chưa ghi transaction lên blockchain
2. Transaction hash chưa được lưu vào database
3. Frontend chưa nhận được transaction hash trong response

**Cách fix:**
```javascript
// Kiểm tra trong DepartmentTest.js
console.log('Test result:', testResult);
console.log('Transaction hash:', testResult.transaction_hash);
console.log('Blockchain:', testResult.blockchain);
```

### Link không hiển thị trong Department Info:

**Nguyên nhân có thể:**
1. Employee chưa join department qua blockchain
2. `web3Department` chưa được fetch
3. Member info chưa có `blockchain_tx_hash`

**Cách fix:**
```javascript
// Kiểm tra trong DepartmentInfo.js
console.log('Web3 Department:', web3Department);
console.log('Member:', web3Department?.member);
console.log('TX Hash:', web3Department?.member?.blockchain_tx_hash);
```

---

## 📱 Screenshot Vị Trí

### Vị trí 1: Sau Test
```
┌─────────────────────────────────────┐
│  Hoàn Thành Bài Test!               │
│  ────────────────────────────────   │
│  Điểm: 100%                          │
│  60 / 60 điểm                        │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ 🔗 Xem Transaction trên      │   │ ← ĐÂY
│  │    Etherscan                 │   │
│  └──────────────────────────────┘   │
│  Block: 9922224                      │
└─────────────────────────────────────┘
```

### Vị trí 2: Department Info
```
┌─────────────────────────────────────┐
│  Phòng Hỗ trợ kỹ thuật              │
│  ────────────────────────────────   │
│  Trưởng phòng: ...                  │
│  Tổng số nhân viên: 2               │
│  ────────────────────────────────   │
│  ┌──────────────────────────────┐   │
│  │ 🔗 Xem Transaction Join       │   │ ← ĐÂY
│  │    Department                │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## ✅ Checklist

- [ ] Backend đã ghi transaction lên blockchain
- [ ] Transaction hash đã được lưu vào database
- [ ] Frontend nhận được transaction hash trong response
- [ ] Component render đúng điều kiện hiển thị link
- [ ] Link mở đúng URL Etherscan

---

**Lưu ý:** Link chỉ hiển thị khi có transaction hash thực sự từ blockchain. Nếu chưa có transaction nào, link sẽ không hiển thị.

