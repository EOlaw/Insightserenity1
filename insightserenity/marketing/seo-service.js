/**
 * @file SEO Service
 * @description Service layer for SEO optimization and management
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * SEO Service
 * Handles SEO optimization and management
 */
class SEOService {
  /**
   * Generate meta tags for a page
   * @param {Object} options - Options for generating meta tags
   * @returns {Object} Meta tag data
   */
  static generateMetaTags(options = {}) {
    try {
      const {
        title,
        description,
        keywords,
        url,
        image,
        type,
        twitterCard,
        twitterSite,
        twitterCreator,
        ogSiteName
      } = options;

      // Default site information from configuration
      const siteConfig = config.seo || {};

      // Basic meta tags
      const metaTags = {
        title: title || siteConfig.defaultTitle || 'InsightSerenity | Consulting Services',
        description: description || siteConfig.defaultDescription || 'Expert consulting solutions designed to transform your business and drive meaningful results',
        keywords: keywords || siteConfig.defaultKeywords || 'consulting, business, services, experts, solutions',
        canonical: url || siteConfig.siteUrl || 'https://insightserenity.com',
      };

      // Social media meta tags
      metaTags.social = {
        ogTitle: title || siteConfig.defaultTitle,
        ogDescription: description || siteConfig.defaultDescription,
        ogUrl: url || siteConfig.siteUrl,
        ogImage: image || siteConfig.defaultImage,
        ogType: type || 'website',
        ogSiteName: ogSiteName || siteConfig.siteName || 'InsightSerenity',
        twitterCard: twitterCard || 'summary_large_image',
        twitterSite: twitterSite || siteConfig.twitterHandle || '@insightserenity',
        twitterCreator: twitterCreator || siteConfig.twitterHandle || '@insightserenity'
      };

      // Structured data - Basic organization
      metaTags.structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: siteConfig.siteName || 'InsightSerenity',
        url: siteConfig.siteUrl || 'https://insightserenity.com',
        logo: siteConfig.logoUrl || `${siteConfig.siteUrl}/logo.png`,
        sameAs: [
          siteConfig.socialLinks?.linkedin || 'https://linkedin.com/company/insightserenity',
          siteConfig.socialLinks?.twitter || 'https://twitter.com/insightserenity',
          siteConfig.socialLinks?.facebook || 'https://facebook.com/insightserenity'
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: siteConfig.contactPhone || '+1-800-123-4567',
          contactType: 'customer service',
          email: siteConfig.contactEmail || 'contact@insightserenity.com'
        }
      };

      return metaTags;
    } catch (error) {
      logger.error('Error generating meta tags:', error);
      throw error;
    }
  }

  /**
   * Generate structured data for different content types
   * @param {string} type - Content type (service, article, event, etc.)
   * @param {Object} data - Content data
   * @returns {Object} Structured data
   */
  static generateStructuredData(type, data) {
    try {
      const baseUrl = config.seo?.siteUrl || 'https://insightserenity.com';

      switch (type) {
        case 'service':
          return {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: data.name,
            description: data.description?.short || '',
            provider: {
              '@type': 'Organization',
              name: config.seo?.siteName || 'InsightSerenity',
              url: baseUrl
            },
            url: `${baseUrl}/services/${data.slug}`,
            serviceType: data.category
          };

        case 'article':
          return {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: data.title,
            description: data.summary || '',
            image: data.featuredImage?.url || '',
            datePublished: data.publishedAt,
            dateModified: data.updatedAt,
            author: {
              '@type': 'Person',
              name: data.author?.name || '',
              url: `${baseUrl}/blog/author/${data.author?.user}`
            },
            publisher: {
              '@type': 'Organization',
              name: config.seo?.siteName || 'InsightSerenity',
              logo: {
                '@type': 'ImageObject',
                url: config.seo?.logoUrl || `${baseUrl}/logo.png`
              }
            },
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': `${baseUrl}/blog/${data.slug}`
            }
          };

        case 'event':
          return {
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: data.title,
            description: data.description || '',
            startDate: data.startDate,
            endDate: data.endDate,
            location: data.isVirtual
              ? {
                  '@type': 'VirtualLocation',
                  url: data.virtualUrl
                }
              : {
                  '@type': 'Place',
                  name: data.venue?.name,
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: data.venue?.address,
                    addressLocality: data.venue?.city,
                    postalCode: data.venue?.zipCode,
                    addressCountry: data.venue?.country
                  }
                },
            image: data.featuredImage || '',
            organizer: {
              '@type': 'Organization',
              name: config.seo?.siteName || 'InsightSerenity',
              url: baseUrl
            },
            offers: {
              '@type': 'Offer',
              price: data.price || '0',
              priceCurrency: data.currency || 'USD',
              availability: data.isSoldOut
                ? 'https://schema.org/SoldOut'
                : 'https://schema.org/InStock',
              url: `${baseUrl}/events/${data.slug}`
            }
          };

        case 'caseStudy':
          return {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: data.title,
            description: data.summary || '',
            image: data.media?.featuredImage || '',
            datePublished: data.createdAt,
            dateModified: data.updatedAt,
            author: {
              '@type': 'Organization',
              name: config.seo?.siteName || 'InsightSerenity'
            },
            publisher: {
              '@type': 'Organization',
              name: config.seo?.siteName || 'InsightSerenity',
              logo: {
                '@type': 'ImageObject',
                url: config.seo?.logoUrl || `${baseUrl}/logo.png`
              }
            },
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': `${baseUrl}/case-studies/${data.slug}`
            }
          };

        case 'consultant':
          return {
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: `${data.profile.firstName} ${data.profile.lastName}`,
            jobTitle: data.professional?.title || 'Consultant',
            description: data.professional?.summary || '',
            image: data.profile?.avatarUrl || '',
            url: `${baseUrl}/consultants/${data._id}`,
            worksFor: {
              '@type': 'Organization',
              name: config.seo?.siteName || 'InsightSerenity'
            },
            sameAs: [
              data.profile?.socialMedia?.linkedin || '',
              data.profile?.socialMedia?.twitter || ''
            ].filter(Boolean)
          };

        case 'localBusiness':
          return {
            '@context': 'https://schema.org',
            '@type': 'ProfessionalService',
            name: config.seo?.siteName || 'InsightSerenity',
            description: config.seo?.defaultDescription || 'Expert consulting solutions',
            url: baseUrl,
            logo: config.seo?.logoUrl || `${baseUrl}/logo.png`,
            image: config.seo?.defaultImage || `${baseUrl}/office-image.jpg`,
            telephone: config.company?.phone || '+1-800-123-4567',
            email: config.company?.email || 'contact@insightserenity.com',
            address: {
              '@type': 'PostalAddress',
              streetAddress: config.company?.address?.street || '123 Business Ave',
              addressLocality: config.company?.address?.city || 'Enterprise City',
              addressRegion: config.company?.address?.state || 'CA',
              postalCode: config.company?.address?.zipCode || '90210',
              addressCountry: config.company?.address?.country || 'US'
            },
            openingHours: config.company?.openingHours || 'Mo,Tu,We,Th,Fr 09:00-17:00',
            priceRange: '$$$',
            paymentAccepted: 'Credit Card, Debit Card, Bank Transfer'
          };

        default:
          // Generic webpage structured data
          return {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: data.title || config.seo?.defaultTitle,
            description: data.description || config.seo?.defaultDescription,
            url: data.url || baseUrl
          };
      }
    } catch (error) {
      logger.error(`Error generating structured data for ${type}:`, error);
      throw error;
    }
  }

  /**
   * Generate sitemap data
   * @returns {Array} Sitemap entries
   */
  static async generateSitemapData() {
    try {
      const baseUrl = config.seo?.siteUrl || 'https://insightserenity.com';
      const entries = [];

      // Add static pages
      const staticPages = [
        { url: '/', priority: 1.0, changefreq: 'weekly' },
        { url: '/about', priority: 0.8, changefreq: 'monthly' },
        { url: '/services', priority: 0.9, changefreq: 'weekly' },
        { url: '/case-studies', priority: 0.8, changefreq: 'weekly' },
        { url: '/blog', priority: 0.8, changefreq: 'daily' },
        { url: '/contact', priority: 0.7, changefreq: 'monthly' },
        { url: '/pricing', priority: 0.7, changefreq: 'monthly' }
      ];

      entries.push(...staticPages.map(page => ({
        url: `${baseUrl}${page.url}`,
        lastmod: new Date().toISOString(),
        priority: page.priority,
        changefreq: page.changefreq
      })));

      // Add dynamic content pages
      // Services
      if (mongoose.models.Service) {
        const Service = mongoose.models.Service;
        const services = await Service.find({ status: 'published' })
          .select('slug updatedAt')
          .lean();

        entries.push(...services.map(service => ({
          url: `${baseUrl}/services/${service.slug}`,
          lastmod: service.updatedAt.toISOString(),
          priority: 0.8,
          changefreq: 'monthly'
        })));
      }

      // Blog posts
      if (mongoose.models.BlogPost) {
        const BlogPost = mongoose.models.BlogPost;
        const posts = await BlogPost.find({ status: 'published' })
          .select('slug publishedAt')
          .lean();

        entries.push(...posts.map(post => ({
          url: `${baseUrl}/blog/${post.slug}`,
          lastmod: post.publishedAt.toISOString(),
          priority: 0.7,
          changefreq: 'monthly'
        })));
      }

      // Case studies
      if (mongoose.models.CaseStudy) {
        const CaseStudy = mongoose.models.CaseStudy;
        const caseStudies = await CaseStudy.find({ status: 'published' })
          .select('slug updatedAt')
          .lean();

        entries.push(...caseStudies.map(caseStudy => ({
          url: `${baseUrl}/case-studies/${caseStudy.slug}`,
          lastmod: caseStudy.updatedAt.toISOString(),
          priority: 0.8,
          changefreq: 'monthly'
        })));
      }

      // Events
      if (mongoose.models.Event) {
        const Event = mongoose.models.Event;
        const events = await Event.find({ 
          status: 'published',
          endDate: { $gte: new Date() }
        })
          .select('slug updatedAt')
          .lean();

        entries.push(...events.map(event => ({
          url: `${baseUrl}/events/${event.slug}`,
          lastmod: event.updatedAt.toISOString(),
          priority: 0.7,
          changefreq: 'weekly'
        })));
      }

      return entries;
    } catch (error) {
      logger.error('Error generating sitemap data:', error);
      throw error;
    }
  }

  /**
   * Generate robots.txt content
   * @returns {string} Robots.txt content
   */
  static generateRobotsTxt() {
    try {
      const baseUrl = config.seo?.siteUrl || 'https://insightserenity.com';
      const environment = process.env.NODE_ENV || 'development';
      
      // Allow all in production, restrict in other environments
      const isProduction = environment === 'production';
      
      const content = [
        'User-agent: *',
        isProduction ? 'Allow: /' : 'Disallow: /',
        '',
        '# Specific disallows',
        'Disallow: /admin/',
        'Disallow: /dashboard/',
        'Disallow: /api/',
        'Disallow: /auth/',
        'Disallow: /login',
        'Disallow: /logout',
        'Disallow: /register',
        'Disallow: /reset-password',
        '',
        `Sitemap: ${baseUrl}/sitemap.xml`
      ].join('\n');
      
      return content;
    } catch (error) {
      logger.error('Error generating robots.txt:', error);
      throw error;
    }
  }

  /**
   * Analyze content for SEO optimization
   * @param {Object} content - Content to analyze
   * @param {Object} options - Analysis options
   * @returns {Object} SEO analysis results
   */
  static analyzeContent(content, options = {}) {
    try {
      const {
        title,
        description,
        keywords,
        focusKeyword,
        content: bodyContent,
        url
      } = content;
      
      const analysis = {
        score: 0,
        maxScore: 100,
        suggestions: []
      };
      
      // Check title
      if (title) {
        if (title.length < 30) {
          analysis.suggestions.push({
            type: 'warning',
            message: 'Title is too short (recommended: 30-60 characters)',
            field: 'title'
          });
        } else if (title.length > 60) {
          analysis.suggestions.push({
            type: 'warning',
            message: 'Title is too long (recommended: 30-60 characters)',
            field: 'title'
          });
        } else {
          analysis.score += 10;
        }
        
        // Check if focus keyword is in title
        if (focusKeyword && !title.toLowerCase().includes(focusKeyword.toLowerCase())) {
          analysis.suggestions.push({
            type: 'warning',
            message: `Focus keyword "${focusKeyword}" is not in the title`,
            field: 'title'
          });
        } else if (focusKeyword) {
          analysis.score += 10;
        }
      } else {
        analysis.suggestions.push({
          type: 'error',
          message: 'Title is missing',
          field: 'title'
        });
      }
      
      // Check description
      if (description) {
        if (description.length < 120) {
          analysis.suggestions.push({
            type: 'warning',
            message: 'Description is too short (recommended: 120-160 characters)',
            field: 'description'
          });
        } else if (description.length > 160) {
          analysis.suggestions.push({
            type: 'warning',
            message: 'Description is too long (recommended: 120-160 characters)',
            field: 'description'
          });
        } else {
          analysis.score += 10;
        }
        
        // Check if focus keyword is in description
        if (focusKeyword && !description.toLowerCase().includes(focusKeyword.toLowerCase())) {
          analysis.suggestions.push({
            type: 'warning',
            message: `Focus keyword "${focusKeyword}" is not in the description`,
            field: 'description'
          });
        } else if (focusKeyword) {
          analysis.score += 10;
        }
      } else {
        analysis.suggestions.push({
          type: 'error',
          message: 'Description is missing',
          field: 'description'
        });
      }
      
      // Check url/slug
      if (url) {
        if (url.includes(' ')) {
          analysis.suggestions.push({
            type: 'error',
            message: 'URL contains spaces',
            field: 'url'
          });
        } else if (url.length > 100) {
          analysis.suggestions.push({
            type: 'warning',
            message: 'URL is too long (recommended: less than 100 characters)',
            field: 'url'
          });
        } else {
          analysis.score += 10;
        }
        
        // Check if focus keyword is in URL
        if (focusKeyword && !url.toLowerCase().includes(focusKeyword.toLowerCase().replace(/\s+/g, '-'))) {
          analysis.suggestions.push({
            type: 'suggestion',
            message: `Consider including the focus keyword "${focusKeyword}" in the URL`,
            field: 'url'
          });
        } else if (focusKeyword) {
          analysis.score += 5;
        }
      }
      
      // Check content body
      if (bodyContent) {
        // Count words
        const wordCount = bodyContent.split(/\s+/).length;
        
        if (wordCount < 300) {
          analysis.suggestions.push({
            type: 'warning',
            message: 'Content is too short (recommended: at least 300 words)',
            field: 'content'
          });
        } else {
          analysis.score += 10;
        }
        
        // Check headings
        const h1Count = (bodyContent.match(/<h1[^>]*>(.*?)<\/h1>/gi) || []).length;
        const h2Count = (bodyContent.match(/<h2[^>]*>(.*?)<\/h2>/gi) || []).length;
        
        if (h1Count > 1) {
          analysis.suggestions.push({
            type: 'warning',
            message: 'Multiple H1 headings found (recommended: only one H1)',
            field: 'content'
          });
        } else if (h1Count === 0) {
          analysis.suggestions.push({
            type: 'warning',
            message: 'No H1 heading found',
            field: 'content'
          });
        } else {
          analysis.score += 10;
        }
        
        if (h2Count === 0) {
          analysis.suggestions.push({
            type: 'suggestion',
            message: 'No H2 headings found (recommended: use H2 for section headings)',
            field: 'content'
          });
        } else {
          analysis.score += 5;
        }
        
        // Check focus keyword in content
        if (focusKeyword) {
          const keywordRegex = new RegExp(focusKeyword, 'gi');
          const keywordMatches = bodyContent.match(keywordRegex) || [];
          const keywordDensity = (keywordMatches.length / wordCount) * 100;
          
          if (keywordMatches.length === 0) {
            analysis.suggestions.push({
              type: 'error',
              message: `Focus keyword "${focusKeyword}" not found in content`,
              field: 'content'
            });
          } else if (keywordDensity < 0.5) {
            analysis.suggestions.push({
              type: 'warning',
              message: `Focus keyword "${focusKeyword}" density is too low (${keywordDensity.toFixed(1)}%)`,
              field: 'content'
            });
          } else if (keywordDensity > 2.5) {
            analysis.suggestions.push({
              type: 'warning',
              message: `Focus keyword "${focusKeyword}" density is too high (${keywordDensity.toFixed(1)}%) - may appear as keyword stuffing`,
              field: 'content'
            });
          } else {
            analysis.score += 10;
          }
          
          // Check if focus keyword is in first paragraph
          const firstParagraph = bodyContent.match(/<p[^>]*>(.*?)<\/p>/i);
          if (firstParagraph && !firstParagraph[0].toLowerCase().includes(focusKeyword.toLowerCase())) {
            analysis.suggestions.push({
              type: 'suggestion',
              message: `Consider adding the focus keyword "${focusKeyword}" to the first paragraph`,
              field: 'content'
            });
          } else if (firstParagraph) {
            analysis.score += 5;
          }
        }
        
        // Check images
        const images = bodyContent.match(/<img[^>]*>/gi) || [];
        
        if (images.length === 0) {
          analysis.suggestions.push({
            type: 'suggestion',
            message: 'No images found in content (recommended: include relevant images)',
            field: 'content'
          });
        } else {
          const imagesWithoutAlt = images.filter(img => !img.includes('alt=') || img.includes('alt=""'));
          
          if (imagesWithoutAlt.length > 0) {
            analysis.suggestions.push({
              type: 'warning',
              message: `${imagesWithoutAlt.length} image(s) without alt text found`,
              field: 'content'
            });
          } else {
            analysis.score += 5;
          }
        }
        
        // Check links
        const links = bodyContent.match(/<a[^>]*>(.*?)<\/a>/gi) || [];
        
        if (links.length === 0) {
          analysis.suggestions.push({
            type: 'suggestion',
            message: 'No links found in content (recommended: include internal/external links)',
            field: 'content'
          });
        } else {
          analysis.score += 5;
        }
      } else {
        analysis.suggestions.push({
          type: 'error',
          message: 'Content is missing',
          field: 'content'
        });
      }
      
      // Check keywords
      if (keywords && Array.isArray(keywords) && keywords.length > 0) {
        if (keywords.length < 3) {
          analysis.suggestions.push({
            type: 'suggestion',
            message: 'Few keywords defined (recommended: at least 3-5 relevant keywords)',
            field: 'keywords'
          });
        } else if (keywords.length > 10) {
          analysis.suggestions.push({
            type: 'warning',
            message: 'Too many keywords defined (recommended: 5-10 most relevant keywords)',
            field: 'keywords'
          });
        } else {
          analysis.score += 5;
        }
      } else {
        analysis.suggestions.push({
          type: 'warning',
          message: 'Keywords are missing',
          field: 'keywords'
        });
      }
      
      // Calculate overall score
      if (analysis.score < 40) {
        analysis.rating = 'poor';
        analysis.color = 'red';
      } else if (analysis.score < 70) {
        analysis.rating = 'needs improvement';
        analysis.color = 'orange';
      } else if (analysis.score < 90) {
        analysis.rating = 'good';
        analysis.color = 'blue';
      } else {
        analysis.rating = 'excellent';
        analysis.color = 'green';
      }
      
      return analysis;
    } catch (error) {
      logger.error('Error analyzing content for SEO:', error);
      throw error;
    }
  }
}

module.exports = SEOService;