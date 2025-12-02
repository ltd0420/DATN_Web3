const HoSoNhanVien = require('../models/HoSoNhanVien');
const DanhMucPhongBan = require('../models/DanhMucPhongBan');

// Optional model - only require if it exists
let DanhGiaKpi;
try {
  DanhGiaKpi = require('../models/DanhGiaKpi');
} catch (e) {
  DanhGiaKpi = null;
}

// Get KPI statistics overview
exports.getKpiOverviewStats = async (req, res) => {
  try {
    if (!DanhGiaKpi) {
      return res.json({
        totalKpiCriteria: 0,
        totalEvaluations: 0,
        averageScore: 0,
        outstandingEmployees: 0,
        departmentStats: [],
        topPerformers: []
      });
    }

    const [
      totalEvaluations,
      evaluationsData,
      employeesData,
      departmentsData
    ] = await Promise.all([
      DanhGiaKpi.countDocuments(),
      DanhGiaKpi.find(),
      HoSoNhanVien.find(),
      DanhMucPhongBan.find()
    ]);
    const totalCriteria = 0;

    // Calculate average score
    const averageScore = evaluationsData.length > 0
      ? evaluationsData.reduce((sum, evaluation) => sum + (evaluation.diem_so || 0), 0) / evaluationsData.length
      : 0;

    // Count outstanding employees
    const outstandingEmployees = evaluationsData.filter(evaluation => evaluation.diem_so >= 90).length;

    // Department statistics
    const departmentStats = departmentsData.map(dept => {
      const deptEmployees = employeesData.filter(emp => emp.phong_ban_id === dept.phong_ban_id);
      const deptEvaluations = evaluationsData.filter(evaluation =>
        deptEmployees.some(emp => emp.employee_did === evaluation.employee_did)
      );
      const avgScore = deptEvaluations.length > 0
        ? deptEvaluations.reduce((sum, evaluation) => sum + (evaluation.diem_so || 0), 0) / deptEvaluations.length
        : 0;

      return {
        department_id: dept.phong_ban_id,
        name: dept.ten_phong_ban,
        employees: deptEmployees.length,
        evaluations: deptEvaluations.length,
        averageScore: Math.round(avgScore * 100) / 100
      };
    });

    // Top performers
    const employeeScores = {};
    evaluationsData.forEach(evaluation => {
      if (!employeeScores[evaluation.employee_did]) {
        employeeScores[evaluation.employee_did] = { total: 0, count: 0 };
      }
      employeeScores[evaluation.employee_did].total += evaluation.diem_so || 0;
      employeeScores[evaluation.employee_did].count += 1;
    });

    const topPerformers = Object.entries(employeeScores)
      .map(([did, scores]) => {
        const employee = employeesData.find(emp => emp.employee_did === did);
        return {
          employee_did: did,
          name: employee?.ho_ten || did,
          department: employee?.phong_ban_id || '',
          averageScore: Math.round((scores.total / scores.count) * 100) / 100,
          totalEvaluations: scores.count
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10);

    res.json({
      totalKpiCriteria: totalCriteria,
      totalEvaluations,
      averageScore: Math.round(averageScore * 100) / 100,
      outstandingEmployees,
      departmentStats,
      topPerformers
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get KPI trends over time
exports.getKpiTrends = async (req, res) => {
  try {
    if (!DanhGiaKpi) {
      return res.json([]);
    }

    const { months = 6 } = req.query;
    const currentDate = new Date();
    const trends = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' });

      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthEvaluations = await DanhGiaKpi.find({
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

      const avgScore = monthEvaluations.length > 0
        ? monthEvaluations.reduce((sum, evaluation) => sum + (evaluation.diem_so || 0), 0) / monthEvaluations.length
        : 0;

      trends.push({
        month: monthName,
        averageScore: Math.round(avgScore * 100) / 100,
        evaluations: monthEvaluations.length,
        outstanding: monthEvaluations.filter(evaluation => evaluation.diem_so >= 90).length
      });
    }

    res.json(trends);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get KPI statistics by department
exports.getKpiStatsByDepartment = async (req, res) => {
  try {
    if (!DanhGiaKpi) {
      return res.status(404).json({ message: 'KPI model not available' });
    }

    const { departmentId } = req.params;

    const employees = await HoSoNhanVien.find({ phong_ban_id: departmentId });
    const [department, evaluations] = await Promise.all([
      DanhMucPhongBan.findOne({ phong_ban_id: departmentId }),
      DanhGiaKpi.find({
        employee_did: { $in: employees.map(emp => emp.employee_did) }
      })
    ]);

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Calculate statistics
    const totalEmployees = employees.length;
    const totalEvaluations = evaluations.length;
    const averageScore = totalEvaluations > 0
      ? evaluations.reduce((sum, evaluation) => sum + (evaluation.diem_so || 0), 0) / totalEvaluations
      : 0;

    // Group by KPI criteria
    const kpiStats = {};
    evaluations.forEach(evaluation => {
      if (!kpiStats[evaluation.kpi_id]) {
        kpiStats[evaluation.kpi_id] = { total: 0, count: 0 };
      }
      kpiStats[evaluation.kpi_id].total += evaluation.diem_so || 0;
      kpiStats[evaluation.kpi_id].count += 1;
    });

    const kpiCriteriaStats = await Promise.all(
      Object.entries(kpiStats).map(async ([kpiId, stats]) => {
        return {
          kpi_id: kpiId,
          name: kpiId,
          averageScore: Math.round((stats.total / stats.count) * 100) / 100,
          evaluations: stats.count
        };
      })
    );

    // Employee performance ranking
    const employeePerformance = employees.map(emp => {
      const empEvaluations = evaluations.filter(evaluation => evaluation.employee_did === emp.employee_did);
      const avgScore = empEvaluations.length > 0
        ? empEvaluations.reduce((sum, evaluation) => sum + (evaluation.diem_so || 0), 0) / empEvaluations.length
        : 0;

      return {
        employee_did: emp.employee_did,
        name: emp.ho_ten,
        averageScore: Math.round(avgScore * 100) / 100,
        evaluations: empEvaluations.length
      };
    }).sort((a, b) => b.averageScore - a.averageScore);

    res.json({
      department: {
        id: department.phong_ban_id,
        name: department.ten_phong_ban
      },
      summary: {
        totalEmployees,
        totalEvaluations,
        averageScore: Math.round(averageScore * 100) / 100
      },
      kpiCriteriaStats,
      employeePerformance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get KPI statistics by period
exports.getKpiStatsByPeriod = async (req, res) => {
  try {
    if (!DanhGiaKpi) {
      return res.status(404).json({ message: 'KPI model not available' });
    }

    const { ky_danh_gia } = req.params;

    const evaluations = await DanhGiaKpi.find({ ky_danh_gia });

    const totalEvaluations = evaluations.length;
    const averageScore = totalEvaluations > 0
      ? evaluations.reduce((sum, evaluation) => sum + (evaluation.diem_so || 0), 0) / totalEvaluations
      : 0;

    // Group by department
    const departmentStats = {};
    const employeeDetails = await HoSoNhanVien.find({
      employee_did: { $in: evaluations.map(evaluation => evaluation.employee_did) }
    });

    evaluations.forEach(evaluation => {
      const employee = employeeDetails.find(emp => emp.employee_did === evaluation.employee_did);
      const deptId = employee?.phong_ban_id || 'unknown';

      if (!departmentStats[deptId]) {
        departmentStats[deptId] = { total: 0, count: 0, employees: new Set() };
      }
      departmentStats[deptId].total += evaluation.diem_so || 0;
      departmentStats[deptId].count += 1;
      departmentStats[deptId].employees.add(evaluation.employee_did);
    });

    const departmentPerformance = await Promise.all(
      Object.entries(departmentStats).map(async ([deptId, stats]) => {
        const department = await DanhMucPhongBan.findOne({ phong_ban_id: deptId });
        return {
          department_id: deptId,
          name: department?.ten_phong_ban || deptId,
          averageScore: Math.round((stats.total / stats.count) * 100) / 100,
          evaluations: stats.count,
          employees: stats.employees.size
        };
      })
    );

    res.json({
      period: ky_danh_gia,
      summary: {
        totalEvaluations,
        averageScore: Math.round(averageScore * 100) / 100,
        departments: departmentPerformance.length
      },
      departmentPerformance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get general KPI stats
exports.getKpiStats = async (req, res) => {
  try {
    if (!DanhGiaKpi) {
      return res.json({
        totalKpiCriteria: 0,
        totalEvaluations: 0,
        averageScore: 0,
        outstandingEmployees: 0
      });
    }

    const [
      totalEvaluations,
      evaluationsData
    ] = await Promise.all([
      DanhGiaKpi.countDocuments(),
      DanhGiaKpi.find()
    ]);
    const totalCriteria = 0;

    // Calculate average score
    const averageScore = evaluationsData.length > 0
      ? evaluationsData.reduce((sum, evaluation) => sum + (evaluation.diem_so || 0), 0) / evaluationsData.length
      : 0;

    // Count outstanding employees
    const outstandingEmployees = evaluationsData.filter(evaluation => evaluation.diem_so >= 90).length;

    res.json({
      totalKpiCriteria: totalCriteria,
      totalEvaluations,
      averageScore: Math.round(averageScore * 100) / 100,
      outstandingEmployees
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    if (!DanhGiaKpi) {
      return res.json({
        totalKpiCriteria: 0,
        totalEvaluations: 0,
        averageScore: 0,
        outstandingEmployees: 0,
        departmentStats: [],
        topPerformers: []
      });
    }

    const [
      totalEvaluations,
      evaluationsData,
      employeesData,
      departmentsData
    ] = await Promise.all([
      DanhGiaKpi.countDocuments(),
      DanhGiaKpi.find(),
      HoSoNhanVien.find(),
      DanhMucPhongBan.find()
    ]);
    const totalCriteria = 0;

    // Calculate average score
    const averageScore = evaluationsData.length > 0
      ? evaluationsData.reduce((sum, evaluation) => sum + (evaluation.diem_so || 0), 0) / evaluationsData.length
      : 0;

    // Count outstanding employees
    const outstandingEmployees = evaluationsData.filter(evaluation => evaluation.diem_so >= 90).length;

    // Department statistics
    const departmentStats = departmentsData.map(dept => {
      const deptEmployees = employeesData.filter(emp => emp.phong_ban_id === dept.phong_ban_id);
      const deptEvaluations = evaluationsData.filter(evaluation =>
        deptEmployees.some(emp => emp.employee_did === evaluation.employee_did)
      );
      const avgScore = deptEvaluations.length > 0
        ? deptEvaluations.reduce((sum, evaluation) => sum + (evaluation.diem_so || 0), 0) / deptEvaluations.length
        : 0;

      return {
        department_id: dept.phong_ban_id,
        name: dept.ten_phong_ban,
        employees: deptEmployees.length,
        evaluations: deptEvaluations.length,
        averageScore: Math.round(avgScore * 100) / 100
      };
    });

    // Top performers
    const employeeScores = {};
    evaluationsData.forEach(evaluation => {
      if (!employeeScores[evaluation.employee_did]) {
        employeeScores[evaluation.employee_did] = { total: 0, count: 0 };
      }
      employeeScores[evaluation.employee_did].total += evaluation.diem_so || 0;
      employeeScores[evaluation.employee_did].count += 1;
    });

    const topPerformers = Object.entries(employeeScores)
      .map(([did, scores]) => {
        const employee = employeesData.find(emp => emp.employee_did === did);
        return {
          employee_did: did,
          name: employee?.ho_ten || did,
          department: employee?.phong_ban_id || '',
          averageScore: Math.round((scores.total / scores.count) * 100) / 100,
          totalEvaluations: scores.count
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10);

    res.json({
      totalKpiCriteria: totalCriteria,
      totalEvaluations,
      averageScore: Math.round(averageScore * 100) / 100,
      outstandingEmployees,
      departmentStats,
      topPerformers
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
