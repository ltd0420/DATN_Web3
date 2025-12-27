const VotingPeriod = require('../models/VotingPeriod');
const VotingCandidate = require('../models/VotingCandidate');
const VotingVote = require('../models/VotingVote');
const DepartmentWeb3 = require('../models/DepartmentWeb3');

// Create voting period
const createVotingPeriod = async (req, res) => {
  try {
    const { departmentId, durationInDays } = req.body;
    
    // Check department exists
    const department = await DepartmentWeb3.findOne({ department_id: departmentId });
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }
    
    // Check if there's an active period
    const activePeriod = await VotingPeriod.findOne({
      department_id: departmentId,
      is_active: true,
      is_ended: false
    });
    
    if (activePeriod) {
      return res.status(400).json({ message: 'There is already an active voting period' });
    }
    
    // Get next period ID
    const lastPeriod = await VotingPeriod.findOne({ department_id: departmentId })
      .sort({ period_id: -1 });
    const periodId = lastPeriod ? lastPeriod.period_id + 1 : 1;
    
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationInDays * 24 * 60 * 60 * 1000);
    
    const votingPeriod = new VotingPeriod({
      department_id: departmentId,
      period_id: periodId,
      start_time: startTime,
      end_time: endTime,
      is_active: true,
      is_ended: false
    });
    
    await votingPeriod.save();
    
    res.status(201).json({
      success: true,
      votingPeriod,
      message: 'Voting period created successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Register candidate
const registerCandidate = async (req, res) => {
  try {
    const { departmentId, periodId, employeeDid, walletAddress } = req.body;
    
    // Check period exists and is active
    const period = await VotingPeriod.findOne({
      department_id: departmentId,
      period_id: periodId
    });
    
    if (!period) {
      return res.status(404).json({ message: 'Voting period not found' });
    }
    
    if (!period.is_active || period.is_ended) {
      return res.status(400).json({ message: 'Voting period is not active' });
    }
    
    const now = new Date();
    if (now < period.start_time || now > period.end_time) {
      return res.status(400).json({ message: 'Outside voting period' });
    }
    
    // Check if already registered
    const existing = await VotingCandidate.findOne({
      department_id: departmentId,
      period_id: periodId,
      employee_did: employeeDid
    });
    
    if (existing) {
      return res.status(400).json({ message: 'Already registered as candidate' });
    }
    
    const candidate = new VotingCandidate({
      department_id: departmentId,
      period_id: periodId,
      employee_did: employeeDid,
      wallet_address: walletAddress,
      votes: 0
    });
    
    await candidate.save();
    
    res.status(201).json({
      success: true,
      candidate,
      message: 'Candidate registered successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Vote for candidate
const vote = async (req, res) => {
  try {
    const { departmentId, periodId, candidateDid, voterAddress } = req.body;
    
    // Check period exists and is active
    const period = await VotingPeriod.findOne({
      department_id: departmentId,
      period_id: periodId
    });
    
    if (!period) {
      return res.status(404).json({ message: 'Voting period not found' });
    }
    
    if (!period.is_active || period.is_ended) {
      return res.status(400).json({ message: 'Voting period is not active' });
    }
    
    const now = new Date();
    if (now < period.start_time || now > period.end_time) {
      return res.status(400).json({ message: 'Outside voting period' });
    }
    
    // Check candidate exists
    const candidate = await VotingCandidate.findOne({
      department_id: departmentId,
      period_id: periodId,
      employee_did: candidateDid
    });
    
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    
    // Check if already voted
    const existingVote = await VotingVote.findOne({
      department_id: departmentId,
      period_id: periodId,
      voter_address: voterAddress
    });
    
    if (existingVote) {
      return res.status(400).json({ message: 'Already voted' });
    }
    
    // Create vote
    const vote = new VotingVote({
      department_id: departmentId,
      period_id: periodId,
      voter_address: voterAddress,
      candidate_did: candidateDid
    });
    
    await vote.save();
    
    // Update candidate vote count
    candidate.votes += 1;
    await candidate.save();
    
    res.status(201).json({
      success: true,
      vote,
      message: 'Vote cast successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// End voting period
const endVotingPeriod = async (req, res) => {
  try {
    const { departmentId, periodId } = req.params;
    
    const period = await VotingPeriod.findOne({
      department_id: departmentId,
      period_id: parseInt(periodId)
    });
    
    if (!period) {
      return res.status(404).json({ message: 'Voting period not found' });
    }
    
    if (period.is_ended) {
      return res.status(400).json({ message: 'Period already ended' });
    }
    
    const now = new Date();
    if (now < period.end_time) {
      return res.status(400).json({ message: 'Period has not ended yet' });
    }
    
    // Find winner
    const topCandidate = await VotingCandidate.findOne({
      department_id: departmentId,
      period_id: period.period_id
    }).sort({ votes: -1 });
    
    if (topCandidate) {
      period.winner_did = topCandidate.employee_did;
      period.winner_votes = topCandidate.votes;
      period.winner_wallet = topCandidate.wallet_address;
    }
    
    period.is_active = false;
    period.is_ended = true;
    await period.save();
    
    res.json({
      success: true,
      votingPeriod: period,
      winner: topCandidate ? {
        employeeDid: topCandidate.employee_did,
        votes: topCandidate.votes,
        wallet: topCandidate.wallet_address
      } : null,
      message: 'Voting period ended successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get voting period
const getVotingPeriod = async (req, res) => {
  try {
    const period = await VotingPeriod.findOne({
      department_id: req.params.departmentId,
      period_id: parseInt(req.params.periodId)
    });
    
    if (!period) {
      return res.status(404).json({ message: 'Voting period not found' });
    }
    
    // Get candidates with votes
    const candidates = await VotingCandidate.find({
      department_id: req.params.departmentId,
      period_id: parseInt(req.params.periodId)
    }).sort({ votes: -1 });
    
    res.json({
      ...period.toObject(),
      candidates
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get active voting period
const getActiveVotingPeriod = async (req, res) => {
  try {
    const period = await VotingPeriod.findOne({
      department_id: req.params.departmentId,
      is_active: true,
      is_ended: false
    });
    
    if (!period) {
      return res.status(404).json({ message: 'No active voting period' });
    }
    
    // Get candidates
    const candidates = await VotingCandidate.find({
      department_id: req.params.departmentId,
      period_id: period.period_id
    }).sort({ votes: -1 });
    
    res.json({
      ...period.toObject(),
      candidates
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createVotingPeriod,
  registerCandidate,
  vote,
  endVotingPeriod,
  getVotingPeriod,
  getActiveVotingPeriod
};

