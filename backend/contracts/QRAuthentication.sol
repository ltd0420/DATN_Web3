// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract QRAuthentication is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    // Struct to store QR token metadata
    struct QRToken {
        string qrCodeId;
        string employeeDid;
        string qrHash;
        uint256 issueDate;
        uint256 expiryDate;
        bool isActive;
        uint256 usageCount;
        uint256 lastUsed;
    }

    // Mapping from tokenId to QRToken
    mapping(uint256 => QRToken) public qrTokens;

    // Mapping from qrCodeId to tokenId
    mapping(string => uint256) public qrCodeToTokenId;

    // Mapping from employeeDid to array of tokenIds
    mapping(string => uint256[]) public employeeTokens;

    // Events
    event QRTokenMinted(uint256 indexed tokenId, string qrCodeId, string employeeDid);
    event QRTokenRevoked(uint256 indexed tokenId, string qrCodeId);
    event QRTokenUsed(uint256 indexed tokenId, string qrCodeId, uint256 usageCount);

    constructor() ERC721("QR Authentication Token", "QRAT") {}

    /**
     * @dev Mint a new QR Authentication token
     * @param to Address to mint token to
     * @param qrCodeId Unique QR code identifier
     * @param employeeDid Employee's DID
     * @param qrHash Hash of QR data
     * @param expiryDate Expiry timestamp (0 for permanent)
     */
    function mintQRToken(
        address to,
        string memory qrCodeId,
        string memory employeeDid,
        string memory qrHash,
        uint256 expiryDate
    ) external onlyOwner returns (uint256) {
        require(bytes(qrCodeId).length > 0, "QR code ID cannot be empty");
        require(bytes(employeeDid).length > 0, "Employee DID cannot be empty");
        require(bytes(qrHash).length > 0, "QR hash cannot be empty");
        require(qrCodeToTokenId[qrCodeId] == 0, "QR code ID already exists");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _mint(to, tokenId);

        qrTokens[tokenId] = QRToken({
            qrCodeId: qrCodeId,
            employeeDid: employeeDid,
            qrHash: qrHash,
            issueDate: block.timestamp,
            expiryDate: expiryDate,
            isActive: true,
            usageCount: 0,
            lastUsed: 0
        });

        qrCodeToTokenId[qrCodeId] = tokenId;
        employeeTokens[employeeDid].push(tokenId);

        emit QRTokenMinted(tokenId, qrCodeId, employeeDid);

        return tokenId;
    }

    /**
     * @dev Verify QR token ownership and validity
     * @param qrCodeId QR code identifier
     * @param qrHash Expected QR hash
     * @param employeeDid Expected employee DID
     */
    function verifyQRToken(
        string memory qrCodeId,
        string memory qrHash,
        string memory employeeDid
    ) external view returns (bool, uint256) {
        uint256 tokenId = qrCodeToTokenId[qrCodeId];
        if (tokenId == 0) return (false, 0);

        QRToken memory token = qrTokens[tokenId];

        // Check if token matches expected data
        if (keccak256(bytes(token.qrHash)) != keccak256(bytes(qrHash))) return (false, 0);
        if (keccak256(bytes(token.employeeDid)) != keccak256(bytes(employeeDid))) return (false, 0);
        if (!token.isActive) return (false, 0);

        // Check expiry
        if (token.expiryDate > 0 && block.timestamp > token.expiryDate) return (false, 0);

        return (true, tokenId);
    }

    /**
     * @dev Record QR token usage
     * @param qrCodeId QR code identifier
     */
    function recordQRUsage(string memory qrCodeId) external onlyOwner {
        uint256 tokenId = qrCodeToTokenId[qrCodeId];
        require(tokenId != 0, "QR token does not exist");

        QRToken storage token = qrTokens[tokenId];
        require(token.isActive, "QR token is not active");

        token.usageCount++;
        token.lastUsed = block.timestamp;

        emit QRTokenUsed(tokenId, qrCodeId, token.usageCount);
    }

    /**
     * @dev Revoke QR token
     * @param qrCodeId QR code identifier
     */
    function revokeQRToken(string memory qrCodeId) external onlyOwner {
        uint256 tokenId = qrCodeToTokenId[qrCodeId];
        require(tokenId != 0, "QR token does not exist");

        QRToken storage token = qrTokens[tokenId];
        require(token.isActive, "QR token already revoked");

        token.isActive = false;

        emit QRTokenRevoked(tokenId, qrCodeId);
    }

    /**
     * @dev Get QR token details
     * @param tokenId Token ID
     */
    function getQRToken(uint256 tokenId) external view returns (QRToken memory) {
        require(_exists(tokenId), "Token does not exist");
        return qrTokens[tokenId];
    }

    /**
     * @dev Get all tokens for an employee
     * @param employeeDid Employee DID
     */
    function getEmployeeTokens(string memory employeeDid) external view returns (uint256[] memory) {
        return employeeTokens[employeeDid];
    }

    /**
     * @dev Check if QR token is valid and active
     * @param qrCodeId QR code identifier
     */
    function isQRValid(string memory qrCodeId) external view returns (bool) {
        uint256 tokenId = qrCodeToTokenId[qrCodeId];
        if (tokenId == 0) return false;

        QRToken memory token = qrTokens[tokenId];
        if (!token.isActive) return false;
        if (token.expiryDate > 0 && block.timestamp > token.expiryDate) return false;

        return true;
    }

    /**
     * @dev Override tokenURI to return metadata
     * @param tokenId Token ID
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");

        QRToken memory token = qrTokens[tokenId];

        // Create metadata JSON (simplified - in production, use IPFS)
        string memory json = string(abi.encodePacked(
            '{"name": "QR Auth Token #',
            Strings.toString(tokenId),
            '", "description": "QR Authentication Token for Employee DID: ',
            token.employeeDid,
            '", "attributes": [',
            '{"trait_type": "QR Code ID", "value": "', token.qrCodeId, '"},',
            '{"trait_type": "Employee DID", "value": "', token.employeeDid, '"},',
            '{"trait_type": "Active", "value": "', token.isActive ? 'true' : 'false', '"},',
            '{"trait_type": "Usage Count", "value": "', Strings.toString(token.usageCount), '"}',
            ']}'
        ));

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    // Required override for ERC721
    function _burn(uint256 tokenId) internal override {
        super._burn(tokenId);
        delete qrTokens[tokenId];
    }
}
