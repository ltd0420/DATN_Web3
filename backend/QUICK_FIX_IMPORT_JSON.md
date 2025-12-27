# Quick Fix: Import JSON Route 404

## Vấn Đề
Route `/api/web3/test/import-json` trả về 404.

## Giải Pháp

### 1. Restart Backend Server

Route đã được thêm vào `server.js` nhưng server cần restart để load route mới:

```bash
# Dừng server hiện tại (Ctrl+C)
# Sau đó start lại:
cd backend
npm start
# hoặc
node server.js
```

### 2. Kiểm Tra Route Đã Được Đăng Ký

Sau khi restart, kiểm tra console log:
```
[Server] Test routes registered: POST /api/web3/test/import-json
```

### 3. Kiểm Tra Multer Config

Đảm bảo `multerConfig.js` đã được require:
```javascript
const { jsonUpload } = require('./multerConfig');
```

### 4. Test Route

Sau khi restart, thử upload file JSON lại.

## Debug

Nếu vẫn lỗi, kiểm tra:
1. Server có đang chạy không?
2. Port có đúng không? (mặc định 5000)
3. Console có log `[importQuestionsFromJSON] Request received` không?
4. File có được upload không? (check `req.file`)

## Route Location

Route được đăng ký tại:
- File: `backend/server.js`
- Line: ~172
- Route: `POST /api/web3/test/import-json`

---

**Lưu ý:** Luôn restart server sau khi thêm route mới!

