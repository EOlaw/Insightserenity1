/**
 * @file Marketing Service
 * @description Service layer for public-facing marketing content
 */

const Testimonial = require('./testimonial-model');
const SEOService = require('./seo-service');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const fileService = require('../services/file-service');
const emailService = require('../services/email-service');
const config = require('../config');

/**
 * Marketing Service
 * Handles all marketing-related business logic
 */
class MarketingService {
  /**
   * Get marketing page content
   * @param {string} pageName - Page name (home, about, services, etc.)
   * @returns {Object} Page content
   */
  static async getPageContent(pageName) {
    try {
      // Check if we have the Page model
      const Page = mongoose.models.Page || null;
      let pageContent = null;
      
      if (Page) {
        // Try to get from database
        pageContent = await Page.findOne({ slug: pageName, status: 'published' }).lean();
      }
      
      // If not found in database, use default content
      if (!pageContent) {
        pageContent = this.getDefaultPageContent(pageName);
      }
      
      // Add testimonials
      if (['home', 'about', 'services'].includes(pageName)) {
        const testimonials = await Testimonial.findByLocation(pageName, 3);
        pageContent.testimonials = testimonials;
      }
      
      // Add services (for home and services pages)
      if (['home', 'services'].includes(pageName)) {
        const Service = mongoose.models.Service;
        if (Service) {
          const featuredServices = await Service.find({ 
            status: 'published',
            featured: true 
          })
            .limit(pageName === 'home' ? 3 : 6)
            .sort({ displayOrder: 1 })
            .lean();
          
          pageContent.services = featuredServices;
        }
      }
      
      // Add case studies (for home page)
      if (pageName === 'home') {
        const CaseStudy = mongoose.models.CaseStudy;
        if (CaseStudy) {
          const featuredCaseStudies = await CaseStudy.find({ 
            status: 'published',
            featured: true 
          })
            .limit(3)
            .sort({ createdAt: -1 })
            .lean();
          
          pageContent.caseStudies = featuredCaseStudies;
        }
      }
      
      // Add team members (for about page)
      if (pageName === 'about') {
        const User = mongoose.models.User;
        if (User) {
          const teamMembers = await User.find({
            'role': { $in: ['admin', 'consultant'] },
            'security.accountStatus': 'active'
          })
            .select('profile.firstName profile.lastName profile.avatarUrl profile.bio role')
            .sort({ 'profile.lastName': 1 })
            .lean();
          
          pageContent.team = teamMembers;
        }
      }
      
      // Generate SEO meta tags
      pageContent.seo = SEOService.generateMetaTags({
        title: pageContent.title,
        description: pageContent.description,
        url: `${config.app.url}/${pageName === 'home' ? '' : pageName}`,
        image: pageContent.featuredImage
      });
      
      return pageContent;
    } catch (error) {
      logger.error(`Error fetching marketing page content for ${pageName}:`, error);
      throw error;
    }
  }

  /**
   * Get default page content
   * @param {string} pageName - Page name
   * @returns {Object} Default page content
   */
  static getDefaultPageContent(pageName) {
    const content = {
      title: '',
      description: '',
      sections: [],
      featuredImage: null
    };
    
    switch(pageName) {
      case 'home':
        content.title = 'InsightSerenity | Expert Consulting Solutions';
        content.description = 'Transformative consulting services that drive business growth and operational excellence.';
        content.sections = [
          {
            type: 'hero',
            title: 'Transform Your Business Potential',
            subtitle: 'Strategic consulting solutions for sustainable growth and innovation',
            content: 'We partner with organizations to unlock new opportunities, overcome challenges, and achieve measurable results.',
            cta: {
              primary: { text: 'Get Started', url: '/contact' },
              secondary: { text: 'Our Services', url: '/services' }
            },
            background: '/img/hero-background.jpg'
          },
          {
            type: 'features',
            title: 'Why Choose InsightSerenity',
            subtitle: 'Our approach delivers real-world results',
            items: [
              {
                title: 'Expert Consultants',
                description: 'Access to industry-leading specialists with proven track records',
                icon: 'users'
              },
              {
                title: 'Data-Driven Insights',
                description: 'Evidence-based recommendations powered by advanced analytics',
                icon: 'chart-bar'
              },
              {
                title: 'Tailored Solutions',
                description: 'Customized strategies designed for your unique challenges',
                icon: 'puzzle-piece'
              },
              {
                title: 'Implementation Support',
                description: 'End-to-end guidance from strategy development to execution',
                icon: 'rocket'
              }
            ]
          },
          {
            type: 'stats',
            title: 'Our Impact',
            items: [
              { value: '200+', label: 'Clients Served' },
              { value: '94%', label: 'Client Satisfaction' },
              { value: '$500M+', label: 'Client Revenue Growth' },
              { value: '15+', label: 'Industries' }
            ]
          },
          {
            type: 'cta',
            title: 'Ready to Transform Your Business?',
            content: 'Schedule a free consultation with our experts to discuss your needs.',
            button: { text: 'Book a Consultation', url: '/contact' }
          }
        ];
        break;
        
      case 'about':
        content.title = 'About InsightSerenity | Our Story and Values';
        content.description = 'Learn about our mission, values, and the experienced team behind InsightSerenity\'s consulting services.';
        content.sections = [
          {
            type: 'header',
            title: 'About Us',
            subtitle: 'Driving business transformation through expertise and innovation',
            background: '/img/about-header.jpg'
          },
          {
            type: 'text',
            title: 'Our Story',
            content: `InsightSerenity was founded in 2018 by a team of industry veterans with a shared vision: to create a consulting firm that delivers tangible results through a combination of deep expertise, innovative thinking, and genuine partnership with clients.

            Over the years, we've grown from a small team focused on strategic consulting to a comprehensive services provider with specialists across multiple disciplines and industries. Our growth has been driven by our commitment to client success and our ability to adapt to evolving business challenges.
            
            Today, InsightSerenity serves clients ranging from emerging startups to Fortune 500 companies across the globe, helping them navigate complex challenges and capitalize on new opportunities.`
          },
          {
            type: 'values',
            title: 'Our Values',
            items: [
              {
                title: 'Excellence',
                description: 'We hold ourselves to the highest standards in everything we do, consistently delivering quality work that exceeds expectations.'
              },
              {
                title: 'Integrity',
                description: 'We operate with honesty, transparency, and ethical principles at all times, building trust with our clients and within our team.'
              },
              {
                title: 'Innovation',
                description: 'We continuously seek new perspectives and creative solutions, embracing change and technological advancement.'
              },
              {
                title: 'Partnership',
                description: 'We work collaboratively with our clients, viewing their challenges as our own and celebrating their successes.'
              },
              {
                title: 'Impact',
                description: 'We focus on delivering measurable outcomes that drive meaningful change for our clients and their stakeholders.'
              }
            ]
          },
          {
            type: 'team',
            title: 'Our Leadership Team',
            subtitle: 'Meet the experts behind InsightSerenity'
          },
          {
            type: 'cta',
            title: 'Join Our Team',
            content: 'We\'re always looking for talented professionals to join our growing team.',
            button: { text: 'View Careers', url: '/careers' }
          }
        ];
        break;
        
      case 'services':
        content.title = 'Our Services | InsightSerenity Consulting Solutions';
        content.description = 'Explore our comprehensive range of consulting services designed to address your business challenges and drive growth.';
        content.sections = [
          {
            type: 'header',
            title: 'Our Services',
            subtitle: 'Comprehensive consulting solutions tailored to your needs',
            background: '/img/services-header.jpg'
          },
          {
            type: 'text',
            content: 'At InsightSerenity, we offer a wide range of consulting services designed to help businesses overcome challenges, capitalize on opportunities, and achieve sustainable growth. Our expert consultants bring deep industry knowledge and proven methodologies to deliver tailored solutions for your unique needs.'
          },
          {
            type: 'services',
            title: 'Our Core Services',
            viewAllLink: '/services'
          },
          {
            type: 'process',
            title: 'Our Approach',
            subtitle: 'How we work with clients to deliver results',
            steps: [
              {
                number: '01',
                title: 'Discovery',
                description: 'We begin by deeply understanding your business, challenges, and goals through thorough research and stakeholder interviews.'
              },
              {
                number: '02',
                title: 'Analysis',
                description: 'Our experts analyze findings, identify key opportunities, and develop strategic recommendations based on data-driven insights.'
              },
              {
                number: '03',
                title: 'Strategy',
                description: 'We create a tailored roadmap with clear objectives, timelines, and measurable outcomes aligned with your business goals.'
              },
              {
                number: '04',
                title: 'Implementation',
                description: 'Our team works alongside yours to execute the strategy, providing guidance and support throughout the process.'
              },
              {
                number: '05',
                title: 'Evaluation',
                description: 'We continuously monitor progress, measure results against KPIs, and refine our approach to ensure optimal outcomes.'
              }
            ]
          },
          {
            type: 'cta',
            title: 'Not Sure Which Service You Need?',
            content: 'Schedule a consultation with our experts to discuss your challenges and find the right solution.',
            button: { text: 'Contact Us', url: '/contact' }
          }
        ];
        break;
        
      case 'contact':
        content.title = 'Contact Us | InsightSerenity Consulting';
        content.description = 'Get in touch with our team to discuss your business needs and how we can help you achieve your goals.';
        content.sections = [
          {
            type: 'header',
            title: 'Contact Us',
            subtitle: 'We\'re here to help with your business challenges',
            background: '/img/contact-header.jpg'
          },
          {
            type: 'contact-info',
            items: [
              {
                title: 'General Inquiries',
                value: 'contact@insightserenity.com',
                icon: 'envelope'
              },
              {
                title: 'Phone',
                value: '+1 (800) 123-4567',
                icon: 'phone'
              },
              {
                title: 'Address',
                value: '123 Business Avenue, Suite 500, Enterprise City, CA 90210',
                icon: 'map-marker'
              },
              {
                title: 'Hours',
                value: 'Monday - Friday: 9:00 AM - 5:00 PM EST',
                icon: 'clock'
              }
            ]
          },
          {
            type: 'contact-form',
            title: 'Send Us a Message',
            subtitle: 'Fill out the form below and we\'ll get back to you as soon as possible.'
          },
          {
            type: 'map',
            title: 'Our Location',
            address: '123 Business Avenue, Enterprise City, CA 90210',
            coordinates: {
              lat: 34.0522,
              lng: -118.2437
            }
          }
        ];
        break;
        
      case 'pricing':
        content.title = 'Pricing | InsightSerenity Consulting Services';
        content.description = 'Transparent pricing options for our consulting services designed to fit businesses of all sizes.';
        content.sections = [
          {
            type: 'header',
            title: 'Pricing',
            subtitle: 'Flexible options to fit your business needs',
            background: '/img/pricing-header.jpg'
          },
          {
            type: 'text',
            content: 'At InsightSerenity, we believe in transparent pricing and flexible engagement models that align with your business needs and budget. We offer several ways to work with our expert consultants to ensure you get the right level of support at a predictable cost.'
          },
          {
            type: 'pricing-models',
            title: 'Engagement Models',
            items: [
              {
                title: 'Project-Based',
                description: 'Fixed scope, timeline, and budget for specific initiatives',
                features: [
                  'Clearly defined deliverables',
                  'Predictable pricing',
                  'Dedicated project team',
                  'Regular progress updates',
                  'Post-project support'
                ],
                note: 'Ideal for defined initiatives with clear objectives'
              },
              {
                title: 'Retainer',
                description: 'Ongoing support with a set monthly investment',
                features: [
                  'Dedicated consultant(s)',
                  'Priority response times',
                  'Monthly service hours',
                  'Regular strategy sessions',
                  'Flexible allocation of hours'
                ],
                note: 'Perfect for ongoing advisory needs and continuous improvement'
              },
              {
                title: 'Hourly Consulting',
                description: 'Flexible engagement on an as-needed basis',
                features: [
                  'Pay only for time used',
                  'Access to specific expertise',
                  'No long-term commitment',
                  'Scalable up or down',
                  'Detailed time tracking'
                ],
                note: 'Best for specific advisory needs or smaller engagements'
              }
            ]
          },
          {
            type: 'pricing-tiers',
            title: 'Service Packages',
            subtitle: 'Popular options for businesses of different sizes',
            tiers: [
              {
                name: 'Startup',
                price: 'Starting at $5,000',
                description: 'Essential consulting services for emerging businesses',
                features: [
                  'Initial business assessment',
                  'Strategy development',
                  'Implementation roadmap',
                  '30 days of support',
                  'Digital adoption guidance'
                ],
                cta: 'Get Started'
              },
              {
                name: 'Growth',
                price: 'Starting at $15,000',
                description: 'Comprehensive solutions for scaling businesses',
                features: [
                  'In-depth business analysis',
                  'Customized growth strategy',
                  'Implementation support',
                  '90 days of advisory services',
                  'Performance tracking dashboard'
                ],
                featured: true,
                cta: 'Most Popular'
              },
              {
                name: 'Enterprise',
                price: 'Custom Pricing',
                description: 'Tailored consulting for complex organizations',
                features: [
                  'Enterprise-wide assessment',
                  'Multi-phase transformation strategy',
                  'Dedicated consultant team',
                  'Ongoing implementation support',
                  'Executive coaching & training'
                ],
                cta: 'Contact Sales'
              }
            ]
          },
          {
            type: 'faq',
            title: 'Pricing FAQs',
            questions: [
              {
                question: 'How do you determine pricing for custom projects?',
                answer: 'We assess the scope, complexity, timeline, and resources required for your specific needs. After an initial consultation, we provide a detailed proposal with transparent pricing.'
              },
              {
                question: 'Do you offer discounts for non-profits or startups?',
                answer: 'Yes, we offer special pricing considerations for qualified non-profit organizations and early-stage startups. Please contact us to discuss your specific situation.'
              },
              {
                question: 'What payment methods do you accept?',
                answer: 'We accept major credit cards, ACH transfers, wire transfers, and checks. For larger engagements, we typically offer installment payment options.'
              },
              {
                question: 'Is there a fee for the initial consultation?',
                answer: 'No, we offer complimentary initial consultations to understand your needs and determine if we\'re the right fit for your business.'
              }
            ]
          },
          {
            type: 'cta',
            title: 'Ready to Discuss Your Needs?',
            content: 'Contact us today for a personalized quote based on your specific requirements.',
            button: { text: 'Request a Quote', url: '/contact' }
          }
        ];
        break;
        
      default:
        content.title = 'InsightSerenity | Expert Consulting Services';
        content.description = 'InsightSerenity provides expert consulting services for businesses of all sizes.';
        content.sections = [
          {
            type: 'header',
            title: 'Welcome to InsightSerenity',
            subtitle: 'Expert consulting solutions for your business challenges'
          }
        ];
    }
    
    return content;
  }

  /**
   * Submit contact form
   * @param {Object} formData - Form data
   * @returns {boolean} Success status
   */
  static async submitContactForm(formData) {
    try {
      const {
        name,
        email,
        phone,
        company,
        subject,
        message,
        service,
        budget,
        timeline,
        hearAbout,
        newsletter
      } = formData;
      
      // Validate required fields
      if (!name || !email || !message) {
        throw new Error('Name, email, and message are required');
      }
      
      // Save to database if Lead model exists
      const Lead = mongoose.models.Lead || null;
      if (Lead) {
        const lead = new Lead({
          name,
          email,
          phone,
          company,
          message,
          subject: subject || 'Contact Form Submission',
          service,
          budget,
          timeline,
          source: {
            type: 'contact_form',
            details: hearAbout
          },
          status: 'new',
          newsletterOptIn: newsletter === true
        });
        
        await lead.save();
      }
      
      // Send notification email to admin
      await emailService.sendAdminNotification(
        'New Contact Form Submission',
        `
          <h2>New contact form submission received</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Company:</strong> ${company || 'Not provided'}</p>
          <p><strong>Subject:</strong> ${subject || 'Contact Form Submission'}</p>
          <p><strong>Message:</strong></p>
          <p>${message}</p>
          ${service ? `<p><strong>Service of Interest:</strong> ${service}</p>` : ''}
          ${budget ? `<p><strong>Budget:</strong> ${budget}</p>` : ''}
          ${timeline ? `<p><strong>Timeline:</strong> ${timeline}</p>` : ''}
          ${hearAbout ? `<p><strong>How they heard about us:</strong> ${hearAbout}</p>` : ''}
          <p><strong>Newsletter Opt-In:</strong> ${newsletter ? 'Yes' : 'No'}</p>
        `
      );
      
      // Send confirmation email to user
      await emailService.sendContactConfirmation(email, name);
      
      // Subscribe to newsletter if opted in
      if (newsletter === true) {
        // Add to newsletter list (implementation depends on email service)
        try {
          await emailService.addToNewsletter(email, name);
        } catch (newsletterError) {
          logger.error('Error adding contact to newsletter:', newsletterError);
          // Continue despite newsletter error
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Error submitting contact form:', error);
      throw error;
    }
  }

  /**
   * Subscribe to newsletter
   * @param {Object} data - Subscription data
   * @returns {boolean} Success status
   */
  static async subscribeNewsletter(data) {
    try {
      const { email, name, source } = data;
      
      // Validate email
      if (!email) {
        throw new Error('Email is required');
      }
      
      // Add to newsletter list (implementation depends on email service)
      await emailService.addToNewsletter(email, name);
      
      // Save to database if NewsletterSubscriber model exists
      const NewsletterSubscriber = mongoose.models.NewsletterSubscriber || null;
      if (NewsletterSubscriber) {
        // Check if already subscribed
        const existing = await NewsletterSubscriber.findOne({ email });
        
        if (!existing) {
          const subscriber = new NewsletterSubscriber({
            email,
            name: name || '',
            source: source || 'website',
            status: 'subscribed'
          });
          
          await subscriber.save();
        } else if (existing.status === 'unsubscribed') {
          // Reactivate subscription
          existing.status = 'subscribed';
          existing.updatedAt = new Date();
          await existing.save();
        }
      }
      
      // Send confirmation email
      await emailService.sendNewsletterConfirmation(email, name || '');
      
      return true;
    } catch (error) {
      logger.error('Error subscribing to newsletter:', error);
      throw error;
    }
  }

  /**
   * Get testimonials
   * @param {Object} options - Query options
   * @returns {Array} Testimonials
   */
  static async getTestimonials(options = {}) {
    try {
      const {
        location,
        limit = 3,
        featured = false,
        service,
        consultant,
        industry
      } = options;
      
      let query = { status: 'approved' };
      
      // Add filters
      if (featured) {
        query.featured = true;
      }
      
      if (location) {
        query.displayLocation = location;
      }
      
      if (service) {
        query.service = service;
      }
      
      if (consultant) {
        query.consultant = consultant;
      }
      
      if (industry) {
        query['client.industry'] = industry;
      }
      
      // Execute query
      const testimonials = await Testimonial.find(query)
        .sort({ featured: -1, displayOrder: 1, createdAt: -1 })
        .limit(limit);
      
      return testimonials;
    } catch (error) {
      logger.error('Error fetching testimonials:', error);
      throw error;
    }
  }

  /**
   * Submit testimonial
   * @param {Object} testimonialData - Testimonial data
   * @param {string} userId - Submitting user ID
   * @returns {Object} Created testimonial
   */
  static async submitTestimonial(testimonialData, userId) {
    try {
      // Create new testimonial
      const testimonial = new Testimonial({
        ...testimonialData,
        status: 'pending',
        createdBy: userId
      });
      
      await testimonial.save();
      
      // Send notification to admin
      await emailService.sendAdminNotification(
        'New Testimonial Submission',
        `
          <h2>New testimonial submission received</h2>
          <p><strong>Client:</strong> ${testimonial.client.name} (${testimonial.client.company})</p>
          <p><strong>Quote:</strong> ${testimonial.quote.short}</p>
          <p><strong>Rating:</strong> ${testimonial.rating.value}/5</p>
          <p>Please review this testimonial in the admin dashboard.</p>
        `
      );
      
      return testimonial;
    } catch (error) {
      logger.error('Error submitting testimonial:', error);
      throw error;
    }
  }

  /**
   * Approve or reject testimonial
   * @param {string} testimonialId - Testimonial ID
   * @param {string} status - New status (approved, rejected)
   * @param {string} userId - Admin user ID
   * @returns {Object} Updated testimonial
   */
  static async updateTestimonialStatus(testimonialId, status, userId) {
    try {
      if (!['approved', 'rejected', 'archived'].includes(status)) {
        throw new Error('Invalid status. Must be approved, rejected, or archived.');
      }
      
      const testimonial = await Testimonial.findById(testimonialId);
      
      if (!testimonial) {
        throw new Error('Testimonial not found');
      }
      
      testimonial.status = status;
      testimonial.updatedBy = userId;
      
      // If approving, verify the testimonial
      if (status === 'approved') {
        testimonial.verification = {
          isVerified: true,
          method: 'admin',
          verifiedAt: new Date(),
          verifiedBy: userId
        };
      }
      
      await testimonial.save();
      
      return testimonial;
    } catch (error) {
      logger.error(`Error updating testimonial status ${testimonialId}:`, error);
      throw error;
    }
  }

  /**
   * Upload client logo or avatar
   * @param {string} testimonialId - Testimonial ID
   * @param {Object} file - Image file
   * @param {string} type - Image type (avatar, logo)
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated testimonial
   */
  static async uploadTestimonialImage(testimonialId, file, type, userId) {
    try {
      const testimonial = await Testimonial.findById(testimonialId);
      
      if (!testimonial) {
        throw new Error('Testimonial not found');
      }
      
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.');
      }
      
      // Upload file to storage service
      const uploadResult = await fileService.uploadFile(file, 'testimonials');
      
      // Update testimonial based on image type
      if (type === 'avatar') {
        testimonial.client.avatar = uploadResult.url;
      } else if (type === 'logo') {
        testimonial.client.logo = uploadResult.url;
      } else {
        throw new Error('Invalid image type. Must be avatar or logo.');
      }
      
      testimonial.updatedBy = userId;
      
      await testimonial.save();
      
      return testimonial;
    } catch (error) {
      logger.error(`Error uploading testimonial image ${testimonialId}:`, error);
      throw error;
    }
  }

  /**
   * Get marketing statistics
   * @returns {Object} Marketing statistics
   */
  static async getMarketingStats() {
    try {
      const stats = {
        testimonials: {},
        inquiries: {},
        pageViews: {},
        conversions: {}
      };
      
      // Testimonial stats
      const Testimonial = mongoose.model('Testimonial');
      stats.testimonials.total = await Testimonial.countDocuments();
      stats.testimonials.approved = await Testimonial.countDocuments({ status: 'approved' });
      stats.testimonials.pending = await Testimonial.countDocuments({ status: 'pending' });
      stats.testimonials.featured = await Testimonial.countDocuments({ featured: true });
      
      // Calculate average rating
      const ratingResult = await Testimonial.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, averageRating: { $avg: '$rating.value' } } }
      ]);
      
      stats.testimonials.averageRating = ratingResult.length > 0 
        ? parseFloat(ratingResult[0].averageRating.toFixed(1)) 
        : 0;
      
      // Industry breakdown
      const industryResult = await Testimonial.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: '$client.industry', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      stats.testimonials.byIndustry = industryResult.map(item => ({
        industry: item._id,
        count: item.count
      }));
      
      // Inquiry stats (if Lead model exists)
      const Lead = mongoose.models.Lead || null;
      if (Lead) {
        stats.inquiries.total = await Lead.countDocuments();
        stats.inquiries.new = await Lead.countDocuments({ status: 'new' });
        stats.inquiries.inProgress = await Lead.countDocuments({ status: 'in_progress' });
        stats.inquiries.converted = await Lead.countDocuments({ status: 'converted' });
        
        // Source breakdown
        const sourceResult = await Lead.aggregate([
          { $group: { _id: '$source.type', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]);
        
        stats.inquiries.bySources = sourceResult.map(item => ({
          source: item._id,
          count: item.count
        }));
        
        // Service interest breakdown
        const serviceResult = await Lead.aggregate([
          { $match: { service: { $exists: true, $ne: null } } },
          { $group: { _id: '$service', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]);
        
        if (serviceResult.length > 0) {
          // Get service names if Service model exists
          const Service = mongoose.models.Service || null;
          if (Service) {
            const serviceIds = serviceResult.map(item => item._id);
            const services = await Service.find({ _id: { $in: serviceIds } })
              .select('_id name')
              .lean();
            
            const serviceMap = {};
            services.forEach(service => {
              serviceMap[service._id] = service.name;
            });
            
            stats.inquiries.byServices = serviceResult.map(item => ({
              service: serviceMap[item._id] || item._id,
              count: item.count
            }));
          } else {
            stats.inquiries.byServices = serviceResult;
          }
        } else {
          stats.inquiries.byServices = [];
        }
      }
      
      // Get newsletter subscriber count
      const NewsletterSubscriber = mongoose.models.NewsletterSubscriber || null;
      if (NewsletterSubscriber) {
        stats.subscriptions = {};
        stats.subscriptions.total = await NewsletterSubscriber.countDocuments({ status: 'subscribed' });
        
        // Subscription trend (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const monthlySubscriptions = await NewsletterSubscriber.aggregate([
          { 
            $match: { 
              createdAt: { $gte: sixMonthsAgo },
              status: 'subscribed'
            } 
          },
          {
            $group: {
              _id: { 
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
        
        stats.subscriptions.trend = monthlySubscriptions.map(item => ({
          period: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
          count: item.count
        }));
      }
      
      return stats;
    } catch (error) {
      logger.error('Error getting marketing stats:', error);
      throw error;
    }
  }

  /**
   * Generate sitemap
   * @returns {string} Sitemap XML
   */
  static async generateSitemap() {
    try {
      const entries = await SEOService.generateSitemapData();
      
      // Format as XML
      const xmlItems = entries.map(entry => `
        <url>
          <loc>${entry.url}</loc>
          <lastmod>${entry.lastmod}</lastmod>
          <changefreq>${entry.changefreq}</changefreq>
          <priority>${entry.priority}</priority>
        </url>
      `).join('');
      
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          ${xmlItems}
        </urlset>
      `;
      
      return xml;
    } catch (error) {
      logger.error('Error generating sitemap:', error);
      throw error;
    }
  }

  /**
   * Generate robots.txt
   * @returns {string} Robots.txt content
   */
  static generateRobotsTxt() {
    try {
      return SEOService.generateRobotsTxt();
    } catch (error) {
      logger.error('Error generating robots.txt:', error);
      throw error;
    }
  }
}

module.exports = MarketingService;