# ML Service - BERT Sentiment & CNN Dimensionality Reduction

Service cung cấp:
1. **BERT Sentiment Analysis** (PhoBERT) cho phân tích cảm xúc tiếng Việt
2. **Attrition Prediction** (PCA + Logistic Regression)

## Setup

### 1. Cài đặt dependencies

```bash
cd ml-service
pip install -r requirements.txt
```

**Lưu ý**: `transformers` và `torch` có thể tốn nhiều dung lượng (~2-3GB). Nếu không có GPU, model sẽ chạy trên CPU (chậm hơn).

### 2. Khởi động service

```bash
python -m uvicorn app:app --host 0.0.0.0 --port 8001
```

Hoặc chạy nền:
```bash
nohup python -m uvicorn app:app --host 0.0.0.0 --port 8001 > uvicorn.log 2>&1 &
```

## API Endpoints

### Health Check
```bash
GET /healthz
```

### Attrition Prediction
```bash
POST /predict
Content-Type: application/json

{
  "samples": [
    {
      "components": [0.12, -0.34, ...]  # 50 PCA components
    }
  ]
}
```

### BERT Sentiment Analysis
```bash
POST /sentiment
Content-Type: application/json

{
  "text": "Tôi rất hài lòng với dịch vụ này",
  "rating": 4.5  # optional
}
```

Response:
```json
{
  "sentiment": "Tích cực",
  "sentiment_score": 0.85,
  "keywords": ["hài lòng", "dịch vụ"]
}
```

## CNN Dimensionality Reduction

Để train CNN model cho dimensionality reduction:

```bash
cd dataset
python reduce_dim_cnn.py \
  --input test.ai_model_metadata.clean.json \
  --output test.ai_model_metadata.cnn.csv \
  --components 50 \
  --epochs 50 \
  --batch-size 256
```

Output:
- `test.ai_model_metadata.cnn.csv`: Reduced features
- `cnn_encoder.h5`: Trained CNN encoder model
- `cnn_scaler.joblib`: Feature scaler
- `test.ai_model_metadata.cnn.csv.meta.json`: Metadata

## Model Information

- **BERT Model**: `vinai/phobert-base-v2` (Vietnamese BERT)
- **Attrition Model**: Logistic Regression với PCA (50 components)
- **CNN Encoder**: 1D Convolutional Autoencoder

## Troubleshooting

### BERT không load được
- Kiểm tra kết nối internet (model sẽ download lần đầu)
- Nếu thiếu RAM, giảm batch size hoặc dùng CPU
- Fallback: Service sẽ tự động dùng rule-based sentiment nếu BERT fail

### CNN training chậm
- Giảm `--epochs` hoặc `--batch-size`
- Sử dụng GPU nếu có: `pip install tensorflow-gpu`

