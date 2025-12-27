# 🚀 Quick Start - Deploy lên Sepolia Testnet

## Bước 1: Cập nhật .env

Thêm vào file `backend/.env`:

```env
# Sepolia Testnet
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
DEPARTMENT_MANAGEMENT_PRIVATE_KEY=f596f9e97e9b0d3e614cd8a65c9eda5e9c553a80d67656f4cc116db12ef95bef
TOKEN_ADDRESS=0x052bd64b3f565698270f3fcdf98d7502d21f2377
```

## Bước 2: Deploy Contracts

```bash
cd backend
npx hardhat run scripts/deploy-department-to-sepolia.js --network sepolia
```

## Bước 3: Cập nhật .env với Addresses

Sau khi deploy, copy các addresses từ output và thêm vào `.env`:

```env
DEPARTMENT_MANAGEMENT_ADDRESS=0x...  # Từ output
SIMPLE_TEST_MANAGEMENT_ADDRESS=0x...  # Từ output
TUSD_TOKEN_ADDRESS=0x052bd64b3f565698270f3fcdf98d7502d21f2377
```

## Bước 4: Start Backend

```bash
npm start
```

Xem log để confirm:
```
[Server] Department Contract Service initialized successfully
```

## ✅ Done!

Bây giờ hệ thống đã chạy on-chain trên Sepolia testnet!

Xem chi tiết trong [DEPLOY_SEPOLIA.md](./DEPLOY_SEPOLIA.md)

