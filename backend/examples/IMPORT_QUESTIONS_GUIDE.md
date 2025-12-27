# Hướng Dẫn Import Câu Hỏi Test từ File JSON

## 📋 Format JSON

File JSON phải là một mảng các object, mỗi object đại diện cho một câu hỏi:

```json
[
  {
    "question_id": "q1",
    "question_text": "What is React?",
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ],
    "correct_answer_index": 1,
    "points": 10,
    "order": 0
  }
]
```

## 📝 Các Trường Bắt Buộc

- **question_id** (string, required): ID duy nhất của câu hỏi
- **question_text** (string, required): Nội dung câu hỏi
- **options** (array, required): Mảng các lựa chọn, tối thiểu 2 options
- **correct_answer_index** (number, required): Index của đáp án đúng (0-based)
- **points** (number, optional): Điểm số của câu hỏi (mặc định: 10)
- **order** (number, optional): Thứ tự hiển thị (mặc định: theo index trong mảng)

## ✅ Ví Dụ File JSON

Xem file `test-questions-sample.json` trong thư mục `examples/`

## 🚀 Cách Sử Dụng

### 1. Tạo File JSON

Tạo file JSON với format như trên, ví dụ:

```json
[
  {
    "question_id": "q1",
    "question_text": "Câu hỏi 1?",
    "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    "correct_answer_index": 0,
    "points": 10,
    "order": 0
  },
  {
    "question_id": "q2",
    "question_text": "Câu hỏi 2?",
    "options": ["Đáp án A", "Đáp án B"],
    "correct_answer_index": 1,
    "points": 15,
    "order": 1
  }
]
```

### 2. Upload File

1. Vào **Admin Dashboard** → **Quản lý Phòng ban Web3**
2. Click tab **"Test Questions"**
3. Chọn phòng ban cần thêm câu hỏi
4. Click button **"Import JSON"**
5. Chọn file JSON
6. File sẽ tự động được upload và import

### 3. Xem Kết Quả

Sau khi upload, hệ thống sẽ hiển thị:
- Số câu hỏi import thành công
- Số câu hỏi thất bại (nếu có)
- Chi tiết lỗi cho từng câu hỏi thất bại

## ⚠️ Lưu Ý

1. **File Size**: Tối đa 10MB
2. **File Type**: Chỉ chấp nhận file `.json`
3. **Question ID**: Phải unique trong cùng một phòng ban
4. **Correct Answer Index**: Phải nằm trong khoảng 0 đến (số options - 1)
5. **Options**: Tối thiểu 2 options, không có giới hạn tối đa

## 🔍 Validation

Hệ thống sẽ tự động kiểm tra:
- ✅ Format JSON hợp lệ
- ✅ Các trường bắt buộc có đầy đủ
- ✅ Options là mảng và có ít nhất 2 phần tử
- ✅ Correct answer index hợp lệ
- ✅ Question ID chưa tồn tại

## 📊 Kết Quả Import

Sau khi import, bạn sẽ nhận được:
- **Total**: Tổng số câu hỏi trong file
- **Success**: Số câu hỏi import thành công
- **Failed**: Số câu hỏi thất bại
- **Imported**: Danh sách câu hỏi đã import thành công
- **Errors**: Chi tiết lỗi cho các câu hỏi thất bại

## 💡 Tips

1. **Test file nhỏ trước**: Import vài câu hỏi trước để test format
2. **Kiểm tra Question ID**: Đảm bảo không trùng với câu hỏi đã có
3. **Validate JSON**: Dùng JSON validator online trước khi upload
4. **Backup**: Lưu file JSON gốc để có thể import lại nếu cần

---

**Ví dụ file mẫu:** `examples/test-questions-sample.json`

