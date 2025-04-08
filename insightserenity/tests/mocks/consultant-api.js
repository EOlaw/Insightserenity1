/**
 * @file Consultant API Mock
 * @description Mock implementation of external consultant API for testing
 */

const express = require('express');
const router = express.Router();

// Sample API key for testing
const VALID_API_KEY = 'test-api-key-123';

// Sample consultant data
const consultantData = {
  'CONS-001': {
    email: 'consultant1@example.com',
    firstName: 'John',
    lastName: 'Expert',
    phone: '+1234567890',
    title: 'Financial Consultant',
    summary: 'Experienced financial consultant with 10+ years in the industry.',
    yearsOfExperience: 10,
    specialty: 'financial_consulting',
    hourlyRate: 150,
    skills: [
      { name: 'Financial Analysis', level: 'expert', years: 10 },
      { name: 'Investment Planning', level: 'expert', years: 8 },
      { name: 'Tax Strategy', level: 'advanced', years: 7 }
    ]
  },
  'CONS-002': {
    email: 'consultant2@example.com',
    firstName: 'Jane',
    lastName: 'Advisor',
    phone: '+1987654321',
    title: 'Marketing Strategist',
    summary: 'Creative marketing strategist specializing in digital campaigns.',
    yearsOfExperience: 8,
    specialty: 'digital_marketing',
    hourlyRate: 120,
    skills: [
      { name: 'Digital Marketing', level: 'expert', years: 8 },
      { name: 'Social Media', level: 'expert', years: 6 },
      { name: 'Content Strategy', level: 'advanced', years: 5 }
    ]
  }
};

// Middleware to verify API key
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers.authorization?.split('Bearer ')[1];
  
  if (!apiKey || apiKey !== VALID_API_KEY) {
    return res.status(401).json({
      success: false,
      message: 'Invalid API key'
    });
  }
  
  next();
};

// Route to get consultant by ID
router.get('/consultants/:id', verifyApiKey, (req, res) => {
  const { id } = req.params;
  
  if (!consultantData[id]) {
    return res.status(404).json({
      success: false,
      message: 'Consultant not found'
    });
  }
  
  return res.status(200).json(consultantData[id]);
});

module.exports = {
  router,
  VALID_API_KEY,
  mockConsultantIds: Object.keys(consultantData)
};