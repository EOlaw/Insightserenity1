/**
 * @file Proposal Controller
 * @description Controller for handling proposal-related HTTP requests
 */

const ProposalService = require('./proposal-service');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

/**
 * Proposal Controller
 * Handles HTTP requests related to project proposals
 */
class ProposalController {
  /**
   * Submit proposal
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async submitProposal(req, res) {
    try {
      const { projectId } = req.params;
      
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }
        
        req.flash('error', errors.array().map(e => e.msg).join(', '));
        return res.redirect(`/projects/${projectId}`);
      }
      
      // Submit proposal
      const proposal = await ProposalService.createProposal(projectId, req.user.id, req.body);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(201).json({
          success: true,
          message: 'Proposal submitted successfully',
          proposalId: proposal._id
        });
      }
      
      req.flash('success', 'Proposal submitted successfully');
      res.redirect(`/consultants/proposals`);
    } catch (error) {
      logger.error('Error submitting proposal:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error submitting proposal'
        });
      }
      
      req.flash('error', error.message || 'Error submitting proposal');
      res.redirect(`/projects/${req.params.projectId}`);
    }
  }

  /**
   * Get proposal details
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getProposal(req, res) {
    try {
      const { proposalId } = req.params;
      
      const proposal = await ProposalService.getProposalById(proposalId, req.user.id);
      
      if (!proposal) {
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(404).json({
            success: false,
            message: 'Proposal not found'
          });
        }
        
        req.flash('error', 'Proposal not found');
        return res.redirect('/dashboard');
      }
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          proposal
        });
      }
      
      // Determine which view to render based on user role
      const viewTemplate = req.user.role === 'client' ? 'proposals/client-view' : 'proposals/consultant-view';
      
      res.render(viewTemplate, {
        title: 'Proposal Details',
        proposal,
        pageContext: req.user.role === 'client' ? 'client-projects' : 'consultant-proposals',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      logger.error('Error getting proposal:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(500).json({
          success: false,
          message: 'An error occurred while retrieving the proposal'
        });
      }
      
      req.flash('error', 'An error occurred while loading the proposal');
      res.redirect('/dashboard');
    }
  }

  /**
   * Update proposal status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateProposalStatus(req, res) {
    try {
      const { proposalId } = req.params;
      const { status, feedback } = req.body;
      
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }
        
        req.flash('error', errors.array().map(e => e.msg).join(', '));
        return res.redirect(`/proposals/${proposalId}`);
      }
      
      // Update proposal status
      const proposal = await ProposalService.updateProposalStatus(proposalId, status, req.user.id, feedback);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: `Proposal ${status.replace('_', ' ')} successfully`,
          status: proposal.status
        });
      }
      
      req.flash('success', `Proposal ${status.replace('_', ' ')} successfully`);
      
      // If accepting a proposal, redirect to the project
      if (status === 'accepted') {
        return res.redirect(`/projects/${proposal.project}`);
      }
      
      // Otherwise, redirect to proposals list
      res.redirect('/clients/projects');
    } catch (error) {
      logger.error('Error updating proposal status:', error);
      
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Error updating proposal status'
        });
      }
      
      req.flash('error', error.message || 'Error updating proposal status');
      res.redirect(`/proposals/${req.params.proposalId}`);
    }
  }
}

module.exports = ProposalController;