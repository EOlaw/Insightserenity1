/**
 * @file Blog Service
 * @description Service layer for blog-related operations
 */

const BlogPost = require('./post-model');
const BlogCategory = require('./category-model');
const Comment = require('./comment-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const fileService = require('../services/file-service');

/**
 * Blog Service
 * Handles all blog-related business logic
 */
class BlogService {
  /**
   * Get blog posts with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Object} Blog posts with pagination info
   */
  static async getPosts(filters = {}, options = {}) {
    try {
      // Default options
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      const sortField = options.sortField || 'publishedAt';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortField]: sortOrder };
      
      // Create query object
      const query = {};
      
      // Only published posts by default for public requests
      if (!filters.showDrafts) {
        query.status = 'published';
        query.publishedAt = { $lte: new Date() };
      } else if (filters.status) {
        query.status = filters.status;
      }
      
      // Add category filter
      if (filters.category) {
        // If category slug is provided, find category ID first
        if (typeof filters.category === 'string' && !mongoose.Types.ObjectId.isValid(filters.category)) {
          const category = await BlogCategory.findOne({ slug: filters.category });
          if (category) {
            query.category = category._id;
          }
        } else {
          query.category = filters.category;
        }
      }
      
      // Add tag filter
      if (filters.tag) {
        query.tags = filters.tag;
      }
      
      // Add author filter
      if (filters.author) {
        query['author.user'] = filters.author;
      }
      
      // Add featured filter
      if (filters.featured === true || filters.featured === 'true') {
        query.featured = true;
      }
      
      // Add search filter
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { summary: { $regex: filters.search, $options: 'i' } },
          { content: { $regex: filters.search, $options: 'i' } },
          { tags: { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Add visibility filter
      if (filters.visibility) {
        query.visibility = filters.visibility;
      } else if (!filters.showAll) {
        // Default to public posts only
        query.visibility = 'public';
      }
      
      // Get total count
      const totalCount = await BlogPost.countDocuments(query);
      
      // Execute query with pagination
      const posts = await BlogPost.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('category', 'title slug')
        .populate('author.user', 'profile.firstName profile.lastName profile.avatarUrl')
        .lean();
      
      return {
        posts,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching blog posts:', error);
      throw error;
    }
  }

  /**
   * Get blog post by ID or slug
   * @param {string} identifier - Post ID or slug
   * @param {Object} options - Optional flags for including related data
   * @returns {Object} Blog post data
   */
  static async getPostById(identifier, options = {}) {
    try {
      let query;
      
      // Check if identifier is a MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        query = { _id: identifier };
      } else {
        // Otherwise, treat as slug
        query = { slug: identifier };
      }
      
      // Include status filter if not showing all
      if (!options.showAll) {
        query.status = 'published';
        query.publishedAt = { $lte: new Date() };
        query.visibility = 'public';
      } else if (options.status) {
        query.status = options.status;
      }
      
      // Create base query
      let postQuery = BlogPost.findOne(query);
      
      // Include related data if requested
      if (options.includeCategory) {
        postQuery = postQuery.populate('category', 'title slug description');
      }
      
      if (options.includeAuthor) {
        postQuery = postQuery.populate('author.user', 'profile.firstName profile.lastName profile.avatarUrl');
      }
      
      if (options.includeRelatedContent) {
        postQuery = postQuery.populate('relatedPosts', 'title slug summary featuredImage');
        postQuery = postQuery.populate('relatedServices', 'name slug description.short');
        postQuery = postQuery.populate('relatedCaseStudies', 'title slug summary');
      }
      
      if (options.includeComments) {
        postQuery = postQuery.populate({
          path: 'comments',
          match: { status: 'approved', parent: null },
          options: { sort: { createdAt: -1 } },
          populate: {
            path: 'author',
            select: 'profile.firstName profile.lastName profile.avatarUrl'
          }
        });
      }
      
      const post = await postQuery.exec();
      
      if (!post) {
        throw new Error('Blog post not found');
      }
      
      // Increment view count if tracking views
      if (options.trackView) {
        await post.incrementViews();
      }
      
      return post;
    } catch (error) {
      logger.error(`Error fetching blog post by identifier ${identifier}:`, error);
      throw error;
    }
  }

  /**
   * Create new blog post
   * @param {Object} postData - Blog post data
   * @param {string} userId - Creating user ID
   * @returns {Object} Created blog post
   */
  static async createPost(postData, userId) {
    try {
      // Check if slug already exists
      if (postData.slug) {
        const existingPost = await BlogPost.findOne({ slug: postData.slug });
        if (existingPost) {
          throw new Error('A blog post with this slug already exists');
        }
      }
      
      // Get user details for author info
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Prepare author data
      const author = {
        user: userId,
        name: `${user.profile.firstName} ${user.profile.lastName}`,
        bio: user.profile.bio || null,
        avatarUrl: user.profile.avatarUrl || null
      };
      
      // Create new blog post
      const post = new BlogPost({
        ...postData,
        author
      });
      
      // Set published date if publishing now
      if (post.status === 'published' && !post.publishedAt) {
        post.publishedAt = new Date();
      }
      
      await post.save();
      
      return post;
    } catch (error) {
      logger.error('Error creating blog post:', error);
      throw error;
    }
  }

  /**
   * Update blog post
   * @param {string} postId - Blog post ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated blog post
   */
  static async updatePost(postId, updateData, userId) {
    try {
      const post = await BlogPost.findById(postId);
      
      if (!post) {
        throw new Error('Blog post not found');
      }
      
      // Check permissions (user must be post author or admin)
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const isAuthor = post.author.user.equals(userId);
      const isAdmin = user.role === 'admin';
      
      if (!isAuthor && !isAdmin) {
        throw new Error('You do not have permission to update this post');
      }
      
      // Check if slug is being changed and already exists
      if (updateData.slug && updateData.slug !== post.slug) {
        const existingPost = await BlogPost.findOne({ slug: updateData.slug });
        if (existingPost && !existingPost._id.equals(postId)) {
          throw new Error('A blog post with this slug already exists');
        }
      }
      
      // Check if publishing for the first time
      const isPublishingNow = updateData.status === 'published' && post.status !== 'published';
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'author') {
          post[key] = updateData[key];
        }
      });
      
      // Set published date if publishing now
      if (isPublishingNow && !post.publishedAt) {
        post.publishedAt = new Date();
      }
      
      await post.save();
      
      return post;
    } catch (error) {
      logger.error(`Error updating blog post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Delete blog post
   * @param {string} postId - Blog post ID
   * @param {string} userId - User ID performing the deletion
   * @returns {boolean} Success status
   */
  static async deletePost(postId, userId) {
    try {
      const post = await BlogPost.findById(postId);
      
      if (!post) {
        throw new Error('Blog post not found');
      }
      
      // Check permissions (user must be post author or admin)
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const isAuthor = post.author.user.equals(userId);
      const isAdmin = user.role === 'admin';
      
      if (!isAuthor && !isAdmin) {
        throw new Error('You do not have permission to delete this post');
      }
      
      // Delete associated comments
      await Comment.deleteMany({ post: postId });
      
      // Delete the post
      await post.remove();
      
      return true;
    } catch (error) {
      logger.error(`Error deleting blog post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Upload featured image for blog post
   * @param {string} postId - Blog post ID
   * @param {Object} file - Image file
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated blog post
   */
  static async uploadFeaturedImage(postId, file, userId) {
    try {
      const post = await BlogPost.findById(postId);
      
      if (!post) {
        throw new Error('Blog post not found');
      }
      
      // Check permissions
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const isAuthor = post.author.user.equals(userId);
      const isAdmin = user.role === 'admin';
      
      if (!isAuthor && !isAdmin) {
        throw new Error('You do not have permission to update this post');
      }
      
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG and WebP images are allowed.');
      }
      
      // Upload file to storage service
      const uploadResult = await fileService.uploadFile(file, 'blog/featured-images');
      
      // Update post
      post.featuredImage = {
        url: uploadResult.url,
        alt: post.title,
        caption: ''
      };
      
      await post.save();
      
      return post;
    } catch (error) {
      logger.error(`Error uploading featured image for blog post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Add a comment to a blog post
   * @param {string} postId - Blog post ID
   * @param {Object} commentData - Comment data
   * @param {string} userId - User ID (optional for guest comments)
   * @returns {Object} Created comment
   */
  static async addComment(postId, commentData, userId = null) {
    try {
      const post = await BlogPost.findById(postId);
      
      if (!post) {
        throw new Error('Blog post not found');
      }
      
      // Check if post allows comments
      if (!post.allowComments) {
        throw new Error('Comments are not allowed on this post');
      }
      
      // Prepare comment data
      const comment = new Comment({
        post: postId,
        content: commentData.content,
        parent: commentData.parent || null
      });
      
      // Set author based on whether it's a user or guest
      if (userId) {
        comment.author = userId;
        
        // Auto-approve comments from registered users if they're the post author or admin
        const User = mongoose.model('User');
        const user = await User.findById(userId);
        
        if (user) {
          const isAuthor = post.author.user.equals(userId);
          const isAdmin = user.role === 'admin';
          
          if (isAuthor || isAdmin) {
            comment.status = 'approved';
          }
        }
      } else {
        // Guest comment
        comment.guestAuthor = {
          name: commentData.name,
          email: commentData.email,
          website: commentData.website || null
        };
      }
      
      // Add IP and user agent if provided
      if (commentData.ip) {
        comment.ip = commentData.ip;
      }
      
      if (commentData.userAgent) {
        comment.userAgent = commentData.userAgent;
      }
      
      // Set notification preference
      if (commentData.subscribeToReplies) {
        comment.notifications.subscribed = true;
      }
      
      await comment.save();
      
      // Check if this is a reply to another comment
      if (comment.parent) {
        // TODO: Send notification to parent comment author if subscribed
      }
      
      return comment;
    } catch (error) {
      logger.error(`Error adding comment to blog post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Get comments for a blog post
   * @param {string} postId - Blog post ID
   * @param {Object} options - Query options (pagination)
   * @returns {Object} Comments with pagination info
   */
  static async getComments(postId, options = {}) {
    try {
      const post = await BlogPost.findById(postId);
      
      if (!post) {
        throw new Error('Blog post not found');
      }
      
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 20;
      
      const comments = await Comment.findByPost(postId, { page, limit });
      const totalCount = await Comment.countCommentsByPost(postId);
      
      return {
        comments,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error(`Error fetching comments for blog post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Like or unlike a blog post
   * @param {string} postId - Blog post ID
   * @param {string} userId - User ID performing the action
   * @param {boolean} isLike - Whether to like (true) or unlike (false)
   * @returns {Object} Updated like count
   */
  static async toggleLike(postId, userId, isLike = true) {
    try {
      const post = await BlogPost.findById(postId);
      
      if (!post) {
        throw new Error('Blog post not found');
      }
      
      if (isLike) {
        await post.like();
      } else {
        await post.unlike();
      }
      
      return {
        likeCount: post.social.likeCount
      };
    } catch (error) {
      logger.error(`Error toggling like for blog post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Record a social share
   * @param {string} postId - Blog post ID
   * @param {string} platform - Social platform (facebook, twitter, linkedin)
   * @returns {Object} Updated share count
   */
  static async recordShare(postId, platform) {
    try {
      const post = await BlogPost.findById(postId);
      
      if (!post) {
        throw new Error('Blog post not found');
      }
      
      await post.incrementSocialShareCount(platform);
      
      return {
        shareCount: post.social.shareCount,
        platforms: post.social.platforms
      };
    } catch (error) {
      logger.error(`Error recording share for blog post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Get categories
   * @param {Object} options - Query options
   * @returns {Array} Blog categories
   */
  static async getCategories(options = {}) {
    try {
      let query;
      
      if (options.hierarchical) {
        query = BlogCategory.findWithSubcategories();
      } else if (options.withPostCounts) {
        query = BlogCategory.findWithPostCounts();
      } else if (options.onlyRoot) {
        query = BlogCategory.findRootCategories();
      } else {
        query = BlogCategory.findActiveCategories();
      }
      
      const categories = await query;
      
      return categories;
    } catch (error) {
      logger.error('Error fetching blog categories:', error);
      throw error;
    }
  }

  /**
   * Create a new category
   * @param {Object} categoryData - Category data
   * @param {string} userId - Creating user ID
   * @returns {Object} Created category
   */
  static async createCategory(categoryData, userId) {
    try {
      // Check if slug already exists
      if (categoryData.slug) {
        const existingCategory = await BlogCategory.findOne({ slug: categoryData.slug });
        if (existingCategory) {
          throw new Error('A category with this slug already exists');
        }
      }
      
      // Create new category
      const category = new BlogCategory({
        ...categoryData,
        createdBy: userId,
        updatedBy: userId
      });
      
      await category.save();
      
      return category;
    } catch (error) {
      logger.error('Error creating blog category:', error);
      throw error;
    }
  }

  /**
   * Update category
   * @param {string} categoryId - Category ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated category
   */
  static async updateCategory(categoryId, updateData, userId) {
    try {
      const category = await BlogCategory.findById(categoryId);
      
      if (!category) {
        throw new Error('Category not found');
      }
      
      // Check if slug is being changed and already exists
      if (updateData.slug && updateData.slug !== category.slug) {
        const existingCategory = await BlogCategory.findOne({ slug: updateData.slug });
        if (existingCategory && !existingCategory._id.equals(categoryId)) {
          throw new Error('A category with this slug already exists');
        }
      }
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'createdBy' && key !== 'createdAt') {
          category[key] = updateData[key];
        }
      });
      
      // Update metadata
      category.updatedBy = userId;
      
      await category.save();
      
      return category;
    } catch (error) {
      logger.error(`Error updating blog category ${categoryId}:`, error);
      throw error;
    }
  }

  /**
   * Delete category (only if no posts are using it)
   * @param {string} categoryId - Category ID
   * @returns {boolean} Success status
   */
  static async deleteCategory(categoryId) {
    try {
      const category = await BlogCategory.findById(categoryId);
      
      if (!category) {
        throw new Error('Category not found');
      }
      
      // Check if there are posts using this category
      const postsCount = await BlogPost.countDocuments({ category: categoryId });
      
      if (postsCount > 0) {
        throw new Error(`Cannot delete category that is used by ${postsCount} posts`);
      }
      
      // Check if there are subcategories
      const subcategoriesCount = await BlogCategory.countDocuments({ parent: categoryId });
      
      if (subcategoriesCount > 0) {
        throw new Error(`Cannot delete category that has ${subcategoriesCount} subcategories`);
      }
      
      await category.remove();
      
      return true;
    } catch (error) {
      logger.error(`Error deleting blog category ${categoryId}:`, error);
      throw error;
    }
  }

  /**
   * Get popular tags
   * @param {number} limit - Maximum number of tags to return
   * @returns {Array} Popular tags with counts
   */
  static async getPopularTags(limit = 10) {
    try {
      const tags = await BlogPost.aggregate([
        { $match: { status: 'published' } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit }
      ]);
      
      return tags.map(tag => ({
        name: tag._id,
        count: tag.count
      }));
    } catch (error) {
      logger.error('Error getting popular blog tags:', error);
      throw error;
    }
  }

  /**
   * Get author statistics
   * @param {string} authorId - User ID of the author
   * @returns {Object} Author statistics
   */
  static async getAuthorStats(authorId) {
    try {
      const stats = {};
      
      // Total posts
      stats.totalPosts = await BlogPost.countDocuments({ 'author.user': authorId });
      
      // Published posts
      stats.publishedPosts = await BlogPost.countDocuments({
        'author.user': authorId,
        status: 'published'
      });
      
      // Total views
      const viewsResult = await BlogPost.aggregate([
        { $match: { 'author.user': mongoose.Types.ObjectId(authorId) } },
        { $group: { _id: null, totalViews: { $sum: '$analytics.views' } } }
      ]);
      
      stats.totalViews = viewsResult.length > 0 ? viewsResult[0].totalViews : 0;
      
      // Total comments
      const postsIds = await BlogPost.find({ 'author.user': authorId }).distinct('_id');
      stats.totalComments = await Comment.countDocuments({
        post: { $in: postsIds },
        status: 'approved'
      });
      
      // Popular categories
      const categoriesResult = await BlogPost.aggregate([
        { $match: { 'author.user': mongoose.Types.ObjectId(authorId) } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);
      
      // Populate category details
      if (categoriesResult.length > 0) {
        const categoryIds = categoriesResult.map(result => result._id);
        const categories = await BlogCategory.find({ _id: { $in: categoryIds } });
        
        stats.popularCategories = categoriesResult.map(result => {
          const category = categories.find(cat => cat._id.equals(result._id));
          return {
            _id: result._id,
            title: category ? category.title : 'Unknown',
            slug: category ? category.slug : null,
            count: result.count
          };
        });
      } else {
        stats.popularCategories = [];
      }
      
      // Recent activity
      stats.recentPosts = await BlogPost.find({ 'author.user': authorId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title slug status publishedAt')
        .lean();
      
      return stats;
    } catch (error) {
      logger.error(`Error getting author stats for ${authorId}:`, error);
      throw error;
    }
  }
}

module.exports = BlogService;