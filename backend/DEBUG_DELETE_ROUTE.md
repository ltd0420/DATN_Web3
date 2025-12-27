# Debug DELETE Route

## Vấn Đề
Route `DELETE /api/web3/departments/:id` trả về 404.

## Kiểm Tra

### 1. Server đã restart chưa?
- Dừng server (Ctrl+C)
- Start lại: `cd backend && npm start`
- Kiểm tra console log: `[Server] Department Web3 routes registered: DELETE /api/web3/departments/:id`

### 2. Kiểm tra route có được đăng ký
Sau khi restart, khi click xóa phòng ban, kiểm tra console backend:
- Nếu thấy: `[Server] DELETE /api/web3/departments/:id route matched!` = route đã match
- Nếu không thấy = route chưa được đăng ký hoặc bị conflict

### 3. Kiểm tra request đến server
Khi click xóa, kiểm tra console backend:
- Nếu thấy: `[deleteDepartment] Request received: { id: '101', ... }` = request đã đến controller
- Nếu không thấy = request chưa đến controller

### 4. Test route trực tiếp
Dùng Postman hoặc curl:
```bash
curl -X DELETE http://localhost:5000/api/web3/departments/101
```

## Giải Pháp

1. **Restart server** - Quan trọng nhất!
2. Kiểm tra console log khi click xóa
3. Nếu vẫn lỗi, kiểm tra network tab trong browser để xem request có được gửi đúng không

