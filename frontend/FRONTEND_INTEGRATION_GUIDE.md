# Hướng Dẫn Tích Hợp Frontend - Department Web3

## ✅ Đã Tích Hợp

### Admin Dashboard
- ✅ **Menu Item:** "Quản lý Phòng ban Web3"
- ✅ **Component:** `DepartmentWeb3Management`
- ✅ **Location:** Admin Dashboard → Sidebar → "Tổ chức & Cấu hình"

### Employee Dashboard  
- ✅ **Menu Item:** "Tham gia Phòng ban Web3"
- ✅ **Component:** `DepartmentWeb3Join`
- ✅ **Location:** Employee Dashboard → Sidebar → "Thông tin cá nhân"

## 🎯 Cách Sử Dụng

### 1. Admin - Tạo Phòng Ban Web3

1. Đăng nhập với tài khoản **Super Admin**
2. Vào **Admin Dashboard**
3. Click **"Quản lý Phòng ban Web3"** trong sidebar
4. Click **"Create Department"**
5. Điền thông tin:
   - Department ID (ví dụ: `dept-frontend`)
   - Department Name (ví dụ: `Frontend Development`)
   - Bật **Require Test** nếu muốn yêu cầu test
   - Set **Min Test Score** (ví dụ: 70)
   - Bật **Require Voting** nếu muốn yêu cầu voting
   - Set **Min Votes** (ví dụ: 1)
   - Set **Join Reward TUSD** (ví dụ: 100)

### 2. Admin - Tạo Câu Hỏi Test

1. Vào **"Quản lý Phòng ban Web3"**
2. Click tab **"Test Questions"**
3. Chọn phòng ban cần tạo câu hỏi
4. Click **"Add Question"**
5. Điền thông tin:
   - Question ID (ví dụ: `q1`)
   - Question Text
   - Options (ít nhất 2 options)
   - Correct Answer Index (0-based)
   - Points (điểm số)
   - Order (thứ tự hiển thị)

### 3. Employee - Làm Bài Test

1. Đăng nhập với tài khoản **Employee**
2. Vào **Employee Dashboard**
3. Click **"Tham gia Phòng ban Web3"** trong sidebar
4. Tìm phòng ban muốn tham gia
5. Click **"Take Test"** (nếu phòng ban yêu cầu test)
6. Làm bài test:
   - Đọc câu hỏi
   - Chọn đáp án
   - Dùng **Previous/Next** để điều hướng
   - Click **"Submit Test"** khi hoàn thành
7. Xem kết quả:
   - Điểm số (score/max_score và phần trăm)
   - Chi tiết từng câu (đúng/sai)
   - Đáp án đúng

### 4. Employee - Tham Gia Phòng Ban

1. Sau khi làm test (nếu yêu cầu) hoặc đủ điều kiện voting
2. Click **"Join Department"** trên phòng ban
3. Hệ thống tự động:
   - Kiểm tra điều kiện (test score hoặc voting)
   - Nếu đủ điều kiện → Tự động thêm vào phòng ban
   - Tự động thưởng TUSD (mock)
4. Nhận thông báo thành công với số TUSD nhận được

## 📁 File Structure

```
frontend/src/components/
├── admin/
│   ├── DepartmentWeb3Management.js    ✅ (Quản lý phòng ban Web3)
│   └── TestQuestionManagement.js     ✅ (Quản lý câu hỏi test)
└── dashboard/
    ├── DepartmentWeb3Join.js         ✅ (Nhân viên tham gia)
    └── DepartmentTest.js             ✅ (Làm bài test)
```

## 🔗 Routes

### Admin Routes
- **Path:** `/admin/departments-web3`
- **Component:** `DepartmentWeb3Management`
- **Access:** Super Admin only

### Employee Routes
- **Path:** `/dashboard/departments-web3`
- **Component:** `DepartmentWeb3Join`
- **Access:** Employee & Manager

## 🎨 UI Features

### Admin Dashboard
- ✅ Tabs: All Departments, Test Questions, Voting Management
- ✅ Create Department form với validation
- ✅ Manage test questions (add/delete)
- ✅ View department list với status

### Employee Dashboard
- ✅ List departments với requirements
- ✅ Take Test dialog với:
  - Stepper navigation
  - Progress bar
  - Question-by-question interface
  - Result review
- ✅ Join Department button
- ✅ TUSD reward notification

## 🚀 Testing

1. **Start Backend:**
```bash
cd backend
npm start
```

2. **Start Frontend:**
```bash
cd frontend
npm start
```

3. **Test Flow:**
   - Admin tạo phòng ban
   - Admin thêm câu hỏi
   - Employee làm test
   - Employee join department
   - Kiểm tra TUSD reward

## 📝 Notes

- Tất cả components đã được tích hợp vào menu
- Props được truyền đúng (`user`, `employeeData`, etc.)
- API endpoints đã được cấu hình
- Mock blockchain service cho TUSD reward

---

**Status:** ✅ Hoàn thành tích hợp  
**Date:** 2024

