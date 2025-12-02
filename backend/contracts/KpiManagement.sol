// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract KpiManagement is Ownable, AccessControl {
    using Counters for Counters.Counter;
    Counters.Counter private _kpiIdCounter;
    Counters.Counter private _evaluationIdCounter;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EVALUATOR_ROLE = keccak256("EVALUATOR_ROLE");
    bytes32 public constant EMPLOYEE_ROLE = keccak256("EMPLOYEE_ROLE");

    // Struct for KPI Criteria
    struct KpiCriteria {
        string kpiId;
        string tenKpi;
        string moTa;
        string loaiKpi; // "Định lượng", "Định tính", "Hành vi", "Kỹ năng"
        string donViDo;
        uint256 trongSo; // 0-100
        uint256 nguongDat;
        uint256 nguongXuatSac;
        string[] apDungChoChucVu;
        string chuKyDanhGia; // "Ngày", "Tuần", "Tháng", "Quý", "Năm"
        bool isActive;
        uint256 createdAt;
    }

    // Struct for KPI Evaluation
    struct KpiEvaluation {
        uint256 evaluationId;
        string employeeDid;
        string kpiId;
        string kyDanhGia;
        uint256 ngayBatDau;
        uint256 ngayKetThuc;
        uint256 giaTriThucTe;
        uint256 diemSo; // 0-100
        string xepLoai; // "Xuất sắc", "Tốt", "Đạt", "Chưa đạt"
        string nguoiDanhGiaDid;
        string nhanXet;
        string trangThai; // "Nháp", "Đã gửi", "Đã phê duyệt", "Đã đóng"
        uint256 createdAt;
        uint256 updatedAt;
    }

    // Mappings
    mapping(string => KpiCriteria) public kpiCriteria; // kpiId => KpiCriteria
    mapping(uint256 => KpiEvaluation) public kpiEvaluations; // evaluationId => KpiEvaluation
    mapping(string => uint256[]) public employeeEvaluations; // employeeDid => evaluationIds[]
    mapping(string => uint256[]) public kpiEvaluationsByCriteria; // kpiId => evaluationIds[]
    mapping(string => uint256[]) public evaluationsByPeriod; // kyDanhGia => evaluationIds[]

    // Events
    event KpiCriteriaCreated(string indexed kpiId, string tenKpi, string loaiKpi);
    event KpiCriteriaUpdated(string indexed kpiId, string tenKpi);
    event KpiCriteriaDeactivated(string indexed kpiId);
    event KpiEvaluationCreated(uint256 indexed evaluationId, string employeeDid, string kpiId, string kyDanhGia);
    event KpiEvaluationUpdated(uint256 indexed evaluationId, uint256 diemSo, string xepLoai);
    event KpiEvaluationApproved(uint256 indexed evaluationId, string nguoiDanhGiaDid);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Create new KPI criteria
     */
    function createKpiCriteria(
        string memory kpiId,
        string memory tenKpi,
        string memory moTa,
        string memory loaiKpi,
        string memory donViDo,
        uint256 trongSo,
        uint256 nguongDat,
        uint256 nguongXuatSac,
        string[] memory apDungChoChucVu,
        string memory chuKyDanhGia
    ) external onlyRole(ADMIN_ROLE) {
        require(bytes(kpiId).length > 0, "KPI ID cannot be empty");
        require(bytes(tenKpi).length > 0, "Ten KPI cannot be empty");
        require(trongSo <= 100, "Trong so must be <= 100");
        require(kpiCriteria[kpiId].createdAt == 0, "KPI criteria already exists");

        kpiCriteria[kpiId] = KpiCriteria({
            kpiId: kpiId,
            tenKpi: tenKpi,
            moTa: moTa,
            loaiKpi: loaiKpi,
            donViDo: donViDo,
            trongSo: trongSo,
            nguongDat: nguongDat,
            nguongXuatSac: nguongXuatSac,
            apDungChoChucVu: apDungChoChucVu,
            chuKyDanhGia: chuKyDanhGia,
            isActive: true,
            createdAt: block.timestamp
        });

        emit KpiCriteriaCreated(kpiId, tenKpi, loaiKpi);
    }

    /**
     * @dev Update KPI criteria
     */
    function updateKpiCriteria(
        string memory kpiId,
        string memory tenKpi,
        string memory moTa,
        string memory donViDo,
        uint256 trongSo,
        uint256 nguongDat,
        uint256 nguongXuatSac,
        string[] memory apDungChoChucVu,
        string memory chuKyDanhGia
    ) external onlyRole(ADMIN_ROLE) {
        require(kpiCriteria[kpiId].createdAt != 0, "KPI criteria does not exist");
        require(trongSo <= 100, "Trong so must be <= 100");

        KpiCriteria storage criteria = kpiCriteria[kpiId];
        criteria.tenKpi = tenKpi;
        criteria.moTa = moTa;
        criteria.donViDo = donViDo;
        criteria.trongSo = trongSo;
        criteria.nguongDat = nguongDat;
        criteria.nguongXuatSac = nguongXuatSac;
        criteria.apDungChoChucVu = apDungChoChucVu;
        criteria.chuKyDanhGia = chuKyDanhGia;

        emit KpiCriteriaUpdated(kpiId, tenKpi);
    }

    /**
     * @dev Deactivate KPI criteria
     */
    function deactivateKpiCriteria(string memory kpiId) external onlyRole(ADMIN_ROLE) {
        require(kpiCriteria[kpiId].createdAt != 0, "KPI criteria does not exist");

        kpiCriteria[kpiId].isActive = false;
        emit KpiCriteriaDeactivated(kpiId);
    }

    /**
     * @dev Create KPI evaluation
     */
    function createKpiEvaluation(
        string memory employeeDid,
        string memory kpiId,
        string memory kyDanhGia,
        uint256 ngayBatDau,
        uint256 ngayKetThuc,
        uint256 giaTriThucTe,
        string memory nguoiDanhGiaDid,
        string memory nhanXet
    ) external onlyRole(EVALUATOR_ROLE) returns (uint256) {
        require(bytes(employeeDid).length > 0, "Employee DID cannot be empty");
        require(kpiCriteria[kpiId].createdAt != 0, "KPI criteria does not exist");
        require(kpiCriteria[kpiId].isActive, "KPI criteria is not active");
        require(ngayBatDau < ngayKetThuc, "Invalid date range");

        _evaluationIdCounter.increment();
        uint256 evaluationId = _evaluationIdCounter.current();

        // Calculate score based on criteria
        uint256 diemSo = _calculateScore(kpiId, giaTriThucTe);
        string memory xepLoai = _calculateXepLoai(diemSo);

        kpiEvaluations[evaluationId] = KpiEvaluation({
            evaluationId: evaluationId,
            employeeDid: employeeDid,
            kpiId: kpiId,
            kyDanhGia: kyDanhGia,
            ngayBatDau: ngayBatDau,
            ngayKetThuc: ngayKetThuc,
            giaTriThucTe: giaTriThucTe,
            diemSo: diemSo,
            xepLoai: xepLoai,
            nguoiDanhGiaDid: nguoiDanhGiaDid,
            nhanXet: nhanXet,
            trangThai: "Nhap",
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        // Update mappings
        employeeEvaluations[employeeDid].push(evaluationId);
        kpiEvaluationsByCriteria[kpiId].push(evaluationId);
        evaluationsByPeriod[kyDanhGia].push(evaluationId);

        emit KpiEvaluationCreated(evaluationId, employeeDid, kpiId, kyDanhGia);
        return evaluationId;
    }

    /**
     * @dev Update KPI evaluation
     */
    function updateKpiEvaluation(
        uint256 evaluationId,
        uint256 giaTriThucTe,
        string memory nhanXet,
        string memory trangThai
    ) external onlyRole(EVALUATOR_ROLE) {
        require(kpiEvaluations[evaluationId].evaluationId != 0, "Evaluation does not exist");

        KpiEvaluation storage evaluation = kpiEvaluations[evaluationId];

        // Recalculate score if actual value changed
        if (evaluation.giaTriThucTe != giaTriThucTe) {
            evaluation.diemSo = _calculateScore(evaluation.kpiId, giaTriThucTe);
            evaluation.xepLoai = _calculateXepLoai(evaluation.diemSo);
        }

        evaluation.giaTriThucTe = giaTriThucTe;
        evaluation.nhanXet = nhanXet;
        evaluation.trangThai = trangThai;
        evaluation.updatedAt = block.timestamp;

        emit KpiEvaluationUpdated(evaluationId, evaluation.diemSo, evaluation.xepLoai);
    }

    /**
     * @dev Approve KPI evaluation
     */
    function approveKpiEvaluation(uint256 evaluationId) external onlyRole(ADMIN_ROLE) {
        require(kpiEvaluations[evaluationId].evaluationId != 0, "Evaluation does not exist");

        KpiEvaluation storage evaluation = kpiEvaluations[evaluationId];
        evaluation.trangThai = "Da phe duyet";
        evaluation.updatedAt = block.timestamp;

        emit KpiEvaluationApproved(evaluationId, Strings.toHexString(uint256(uint160(msg.sender)), 20));
    }

    /**
     * @dev Calculate score based on KPI criteria and actual value
     */
    function _calculateScore(string memory kpiId, uint256 giaTriThucTe) internal view returns (uint256) {
        KpiCriteria memory criteria = kpiCriteria[kpiId];

        // Simple scoring logic - can be enhanced based on KPI type
        if (keccak256(bytes(criteria.loaiKpi)) == keccak256(bytes("Dinh luong"))) {
            // Quantitative KPI: score based on achievement percentage
            if (criteria.nguongXuatSac > 0) {
                if (giaTriThucTe >= criteria.nguongXuatSac) return 100;
                if (giaTriThucTe >= criteria.nguongDat) {
                    // Linear interpolation between threshold and excellent
                    uint256 range = criteria.nguongXuatSac - criteria.nguongDat;
                    uint256 achievement = giaTriThucTe - criteria.nguongDat;
                    return 75 + (achievement * 25 / range);
                }
                if (giaTriThucTe >= (criteria.nguongDat * 8) / 10) return 50;
                return giaTriThucTe * 50 / criteria.nguongDat;
            }
        }

        // Default scoring for other types
        return giaTriThucTe >= criteria.nguongXuatSac ? 100 :
               giaTriThucTe >= criteria.nguongDat ? 75 : 50;
    }

    /**
     * @dev Calculate ranking based on score
     */
    function _calculateXepLoai(uint256 diemSo) internal pure returns (string memory) {
        if (diemSo >= 90) return "Xuat sac";
        if (diemSo >= 75) return "Tot";
        if (diemSo >= 50) return "Dat";
        return "Chua dat";
    }

    /**
     * @dev Get KPI criteria details
     */
    function getKpiCriteria(string memory kpiId) external view returns (KpiCriteria memory) {
        require(kpiCriteria[kpiId].createdAt != 0, "KPI criteria does not exist");
        return kpiCriteria[kpiId];
    }

    /**
     * @dev Get KPI evaluation details
     */
    function getKpiEvaluation(uint256 evaluationId) external view returns (KpiEvaluation memory) {
        require(kpiEvaluations[evaluationId].evaluationId != 0, "Evaluation does not exist");
        return kpiEvaluations[evaluationId];
    }

    /**
     * @dev Get all evaluations for an employee
     */
    function getEmployeeEvaluations(string memory employeeDid) external view returns (uint256[] memory) {
        return employeeEvaluations[employeeDid];
    }

    /**
     * @dev Get all evaluations for a KPI criteria
     */
    function getKpiEvaluationsByCriteria(string memory kpiId) external view returns (uint256[] memory) {
        return kpiEvaluationsByCriteria[kpiId];
    }

    /**
     * @dev Get all evaluations for a period
     */
    function getEvaluationsByPeriod(string memory kyDanhGia) external view returns (uint256[] memory) {
        return evaluationsByPeriod[kyDanhGia];
    }

    /**
     * @dev Get employee KPI summary for a period
     */
    function getEmployeeKpiSummary(string memory employeeDid, string memory kyDanhGia)
        external view returns (uint256 totalScore, uint256 evaluationCount, string memory overallRanking)
    {
        uint256[] memory evalIds = employeeEvaluations[employeeDid];
        uint256 totalWeightedScore = 0;
        uint256 totalWeight = 0;
        uint256 count = 0;

        for (uint256 i = 0; i < evalIds.length; i++) {
            KpiEvaluation memory evaluation = kpiEvaluations[evalIds[i]];
            if (keccak256(bytes(evaluation.kyDanhGia)) == keccak256(bytes(kyDanhGia)) &&
                keccak256(bytes(evaluation.trangThai)) == keccak256(bytes("Da phe duyet"))) {

                KpiCriteria memory criteria = kpiCriteria[evaluation.kpiId];
                totalWeightedScore += evaluation.diemSo * criteria.trongSo;
                totalWeight += criteria.trongSo;
                count++;
            }
        }

        if (count == 0) return (0, 0, "");

        totalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
        overallRanking = _calculateXepLoai(totalScore);

        return (totalScore, count, overallRanking);
    }

    /**
     * @dev Check if KPI criteria is active
     */
    function isKpiCriteriaActive(string memory kpiId) external view returns (bool) {
        return kpiCriteria[kpiId].isActive;
    }

    /**
     * @dev Get total KPI criteria count
     */
    function getTotalKpiCriteria() external view returns (uint256) {
        return _kpiIdCounter.current();
    }

    /**
     * @dev Get total evaluations count
     */
    function getTotalEvaluations() external view returns (uint256) {
        return _evaluationIdCounter.current();
    }

    /**
     * @dev Grant roles to addresses
     */
    function grantEvaluatorRole(address account) external onlyRole(ADMIN_ROLE) {
        grantRole(EVALUATOR_ROLE, account);
    }

    function grantEmployeeRole(address account) external onlyRole(ADMIN_ROLE) {
        grantRole(EMPLOYEE_ROLE, account);
    }
}
