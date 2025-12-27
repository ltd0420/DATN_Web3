const cspHeader = (req, res, next) => {
  // Set secure CSP header that allows ethers.js and web3 libraries
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' https://cdn.jsdelivr.net https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https:",
      "connect-src 'self' https://sepolia.infura.io https://mainnet.infura.io https://localhost:8545 https://polygon-rpc.com https://rpc-mumbai.maticvigil.com https://bsc-dataseed.binance.org https://data-seed-prebsc-1-s1.binance.org wss://*",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  )

  // Additional security headers
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("X-XSS-Protection", "1; mode=block")
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")

  next()
}

module.exports = cspHeader