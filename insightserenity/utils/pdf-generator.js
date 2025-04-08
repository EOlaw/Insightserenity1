/**
 * @file PDF Generator
 * @description Utility for generating contract PDFs
 */

const PDFDocument = require('pdfkit');
const moment = require('moment');
const logger = require('./logger');

/**
 * Generate PDF from contract data
 * @param {Object} contractData - Data for PDF generation
 * @param {string} contractData.title - Contract title
 * @param {string} contractData.contractNumber - Contract number
 * @param {string} contractData.content - Contract HTML content
 * @param {Array} contractData.parties - Contract parties
 * @param {Object} contractData.details - Additional contract details
 * @returns {Promise<Buffer>} PDF buffer
 */
const generatePdf = async (contractData) => {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document
      const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        size: 'A4',
        info: {
          Title: contractData.title,
          Author: 'InsightSerenity Contracts',
          Subject: `Contract ${contractData.contractNumber}`,
          Keywords: 'contract, legal, agreement'
        }
      });

      // Set up document buffer
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Add contract header
      addHeader(doc, contractData);
      
      // Add contract parties
      addParties(doc, contractData.parties);
      
      // Add contract details section
      addDetails(doc, contractData.details);
      
      // Add contract content (main body)
      addContent(doc, contractData.content);
      
      // Add signature section
      addSignatureSection(doc, contractData.parties);
      
      // Add footer
      addFooter(doc, contractData);
      
      // Finalize PDF
      doc.end();
    } catch (error) {
      logger.error('Error generating PDF:', error);
      reject(error);
    }
  });
};

/**
 * Add contract header to PDF
 * @param {PDFDocument} doc - PDF document
 * @param {Object} contractData - Contract data
 */
const addHeader = (doc, contractData) => {
  // Company logo (if available)
  // doc.image('path/to/logo.png', 50, 45, { width: 150 });
  
  // Title
  doc.font('Helvetica-Bold')
     .fontSize(20)
     .text('CONTRACT AGREEMENT', { align: 'center' });
  
  doc.moveDown(0.5);
  
  // Contract number and date
  doc.font('Helvetica')
     .fontSize(12)
     .text(`Contract Number: ${contractData.contractNumber}`, { align: 'center' });
  
  const currentDate = moment().format('MMMM D, YYYY');
  doc.text(`Date: ${currentDate}`, { align: 'center' });
  
  doc.moveDown(1.5);
  
  // Contract title
  doc.font('Helvetica-Bold')
     .fontSize(16)
     .text(contractData.title, { align: 'center' });
  
  doc.moveDown(2);
};

/**
 * Add contract parties to PDF
 * @param {PDFDocument} doc - PDF document
 * @param {Array} parties - Contract parties
 */
const addParties = (doc, parties) => {
  doc.font('Helvetica-Bold')
     .fontSize(14)
     .text('PARTIES TO THE AGREEMENT', { underline: true });
  
  doc.moveDown(0.5);
  
  // Group parties by role
  const clientParties = parties.filter(p => p.role === 'client');
  const consultantParties = parties.filter(p => p.role === 'consultant');
  const organizationParties = parties.filter(p => p.role === 'organization');
  const thirdPartyParties = parties.filter(p => p.role === 'third_party');
  
  // Add parties by group
  if (clientParties.length > 0) {
    addPartyGroup(doc, 'CLIENT', clientParties);
  }
  
  if (consultantParties.length > 0) {
    addPartyGroup(doc, 'CONSULTANT', consultantParties);
  }
  
  if (organizationParties.length > 0) {
    addPartyGroup(doc, 'ORGANIZATION', organizationParties);
  }
  
  if (thirdPartyParties.length > 0) {
    addPartyGroup(doc, 'THIRD PARTY', thirdPartyParties);
  }
  
  doc.moveDown(1);
};

/**
 * Add a group of parties to PDF
 * @param {PDFDocument} doc - PDF document
 * @param {string} groupTitle - Party group title
 * @param {Array} parties - Parties in this group
 */
const addPartyGroup = (doc, groupTitle, parties) => {
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .text(groupTitle);
  
  doc.moveDown(0.5);
  
  parties.forEach((party, index) => {
    doc.font('Helvetica')
       .fontSize(10)
       .text(`${party.name}`);
    
    if (party.address && party.address.street) {
      const addressParts = [];
      if (party.address.street) addressParts.push(party.address.street);
      
      if (party.address.city || party.address.state || party.address.zipCode) {
        const cityStateZip = [party.address.city, party.address.state, party.address.zipCode]
                             .filter(Boolean)
                             .join(', ');
        addressParts.push(cityStateZip);
      }
      
      if (party.address.country) addressParts.push(party.address.country);
      
      doc.text(addressParts.join('\n'));
    }
    
    doc.text(`Email: ${party.email}`);
    
    // Add signatory information if available
    if (party.signatory && party.signatory.name) {
      doc.text(`Signatory: ${party.signatory.name}${party.signatory.title ? `, ${party.signatory.title}` : ''}`);
    }
    
    if (index < parties.length - 1) {
      doc.moveDown(0.5);
    }
  });
  
  doc.moveDown(1);
};

/**
 * Add contract details to PDF
 * @param {PDFDocument} doc - PDF document
 * @param {Object} details - Contract details
 */
const addDetails = (doc, details) => {
  doc.font('Helvetica-Bold')
     .fontSize(14)
     .text('CONTRACT DETAILS', { underline: true });
  
  doc.moveDown(0.5);
  
  doc.font('Helvetica')
     .fontSize(10);
  
  // Status
  if (details.status) {
    doc.font('Helvetica-Bold').text('Status: ', { continued: true });
    doc.font('Helvetica').text(capitalizeFirstLetter(details.status));
  }
  
  // Creation date
  if (details.created) {
    doc.font('Helvetica-Bold').text('Created: ', { continued: true });
    doc.font('Helvetica').text(moment(details.created).format('MMMM D, YYYY'));
  }
  
  // Template
  if (details.template) {
    doc.font('Helvetica-Bold').text('Template: ', { continued: true });
    doc.font('Helvetica').text(details.template);
  }
  
  // Project
  if (details.project) {
    doc.font('Helvetica-Bold').text('Project: ', { continued: true });
    doc.font('Helvetica').text(details.project);
  }
  
  doc.moveDown(1.5);
};

/**
 * Add contract content to PDF
 * @param {PDFDocument} doc - PDF document
 * @param {string} content - Contract content (HTML)
 */
const addContent = (doc, content) => {
  doc.font('Helvetica-Bold')
     .fontSize(14)
     .text('CONTRACT TERMS AND CONDITIONS', { underline: true });
  
  doc.moveDown(0.5);
  
  // Convert HTML content to plain text (basic conversion)
  const plainTextContent = content
    .replace(/<\/?[^>]+(>|$)/g, '')  // Remove HTML tags
    .replace(/&nbsp;/g, ' ')         // Replace non-breaking spaces
    .replace(/&amp;/g, '&')          // Replace ampersands
    .replace(/&lt;/g, '<')           // Replace less than
    .replace(/&gt;/g, '>')           // Replace greater than
    .trim();
  
  doc.font('Helvetica')
     .fontSize(10)
     .text(plainTextContent, {
       paragraphGap: 5,
       align: 'justify'
     });
  
  doc.moveDown(2);
};

/**
 * Add signature section to PDF
 * @param {PDFDocument} doc - PDF document
 * @param {Array} parties - Contract parties
 */
const addSignatureSection = (doc, parties) => {
  doc.font('Helvetica-Bold')
     .fontSize(14)
     .text('SIGNATURES', { underline: true });
  
  doc.moveDown(1);
  
  // Add signature lines for each party
  parties.forEach(party => {
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .text(`For ${party.name}:`);
    
    doc.moveDown(0.5);
    
    // If already signed, show signature
    if (party.signed && party.signatureImage) {
      doc.image(party.signatureImage, { width: 150 });
      doc.moveDown(0.2);
      doc.text(`Signed by: ${party.signatory ? party.signatory.name : party.name}`);
      doc.text(`Date: ${moment(party.signedAt).format('MMMM D, YYYY')}`);
    } else {
      // Draw signature line
      const currentY = doc.y;
      doc.moveTo(100, currentY)
         .lineTo(400, currentY)
         .stroke();
      
      doc.moveDown(0.2);
      doc.fontSize(8)
         .text('Signature', 100);
      
      // Add date line
      doc.moveDown(0.8);
      const dateY = doc.y;
      doc.moveTo(100, dateY)
         .lineTo(400, dateY)
         .stroke();
      
      doc.moveDown(0.2);
      doc.text('Date', 100);
    }
    
    doc.moveDown(2);
  });
};

/**
 * Add footer to PDF
 * @param {PDFDocument} doc - PDF document
 * @param {Object} contractData - Contract data
 */
const addFooter = (doc, contractData) => {
  const totalPages = doc.bufferedPageRange().count;
  
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    
    // Save current position
    const originalY = doc.y;
    
    // Move to bottom of page
    doc.page.margins.bottom = 50;
    doc.y = doc.page.height - doc.page.margins.bottom;
    
    // Add page number
    doc.font('Helvetica')
       .fontSize(8)
       .text(
         `Page ${i + 1} of ${totalPages} | Contract #${contractData.contractNumber}`,
         { align: 'center' }
       );
    
    // Restore position
    doc.y = originalY;
  }
};

/**
 * Helper: Capitalize first letter of a string
 * @param {string} string - Input string
 * @returns {string} String with first letter capitalized
 */
const capitalizeFirstLetter = (string) => {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
};

module.exports = {
  generatePdf
};