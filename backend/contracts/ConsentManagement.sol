// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ConsentManagement is Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _consentIdCounter;

    // Struct to store consent data
    struct Consent {
        uint256 consentId;
        string employeeDid;
        address walletAddress;
        string consentType;
        string purpose;
        uint256 issuedAt;
        uint256 expiresAt;
        bool isActive;
        string ipfsHash; // Hash of detailed consent document on IPFS
    }

    // Mapping from consentId to Consent
    mapping(uint256 => Consent) public consents;

    // Mapping from employeeDid to array of consentIds
    mapping(string => uint256[]) public employeeConsents;

    // Mapping from walletAddress to array of consentIds
    mapping(address => uint256[]) public walletConsents;

    // Events
    event ConsentGiven(uint256 indexed consentId, string employeeDid, address walletAddress);
    event ConsentRevoked(uint256 indexed consentId, string employeeDid);
    event ConsentExpired(uint256 indexed consentId, string employeeDid);

    constructor() {}

    /**
     * @dev Give consent for data processing
     * @param employeeDid Employee's DID
     * @param consentType Type of consent (e.g., "data_processing", "marketing")
     * @param purpose Purpose of data processing
     * @param duration Duration in seconds (0 for permanent)
     * @param ipfsHash IPFS hash of detailed consent document
     */
    function giveConsent(
        string memory employeeDid,
        string memory consentType,
        string memory purpose,
        uint256 duration,
        string memory ipfsHash
    ) external returns (uint256) {
        require(bytes(employeeDid).length > 0, "Employee DID cannot be empty");
        require(bytes(consentType).length > 0, "Consent type cannot be empty");
        require(bytes(purpose).length > 0, "Purpose cannot be empty");

        _consentIdCounter.increment();
        uint256 consentId = _consentIdCounter.current();

        uint256 expiresAt = duration > 0 ? block.timestamp + duration : 0;

        consents[consentId] = Consent({
            consentId: consentId,
            employeeDid: employeeDid,
            walletAddress: msg.sender,
            consentType: consentType,
            purpose: purpose,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            isActive: true,
            ipfsHash: ipfsHash
        });

        employeeConsents[employeeDid].push(consentId);
        walletConsents[msg.sender].push(consentId);

        emit ConsentGiven(consentId, employeeDid, msg.sender);

        return consentId;
    }

    /**
     * @dev Revoke consent
     * @param consentId ID of the consent to revoke
     */
    function revokeConsent(uint256 consentId) external {
        Consent storage consent = consents[consentId];
        require(consent.consentId != 0, "Consent does not exist");
        require(consent.walletAddress == msg.sender || owner() == msg.sender, "Not authorized to revoke");
        require(consent.isActive, "Consent already revoked");

        consent.isActive = false;

        emit ConsentRevoked(consentId, consent.employeeDid);
    }

    /**
     * @dev Check if consent is valid and active
     * @param consentId ID of the consent
     */
    function isConsentValid(uint256 consentId) external view returns (bool) {
        Consent memory consent = consents[consentId];
        if (consent.consentId == 0) return false;
        if (!consent.isActive) return false;
        if (consent.expiresAt > 0 && block.timestamp > consent.expiresAt) return false;
        return true;
    }

    /**
     * @dev Check if employee has active consent for specific type
     * @param employeeDid Employee's DID
     * @param consentType Type of consent
     */
    function hasActiveConsent(string memory employeeDid, string memory consentType) external view returns (bool) {
        uint256[] memory consentIds = employeeConsents[employeeDid];

        for (uint256 i = 0; i < consentIds.length; i++) {
            Consent memory consent = consents[consentIds[i]];
            if (keccak256(bytes(consent.consentType)) == keccak256(bytes(consentType)) &&
                consent.isActive &&
                (consent.expiresAt == 0 || block.timestamp <= consent.expiresAt)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @dev Get all consents for an employee
     * @param employeeDid Employee's DID
     */
    function getEmployeeConsents(string memory employeeDid) external view returns (uint256[] memory) {
        return employeeConsents[employeeDid];
    }

    /**
     * @dev Get all consents for a wallet address
     * @param walletAddress Wallet address
     */
    function getWalletConsents(address walletAddress) external view returns (uint256[] memory) {
        return walletConsents[walletAddress];
    }

    /**
     * @dev Get consent details
     * @param consentId ID of the consent
     */
    function getConsent(uint256 consentId) external view returns (Consent memory) {
        require(consents[consentId].consentId != 0, "Consent does not exist");
        return consents[consentId];
    }

    /**
     * @dev Admin function to expire consents that have passed their expiry date
     */
    function expireConsents() external onlyOwner {
        // This would be called by a scheduled job or manually
        // In a production system, you might want to implement a more efficient way
        for (uint256 i = 1; i <= _consentIdCounter.current(); i++) {
            Consent storage consent = consents[i];
            if (consent.isActive && consent.expiresAt > 0 && block.timestamp > consent.expiresAt) {
                consent.isActive = false;
                emit ConsentExpired(i, consent.employeeDid);
            }
        }
    }
}
