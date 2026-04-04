/**
 * Cloudflare R2 Service
 * Gestion du stockage et des signed URLs pour Cloudflare R2 (S3-compatible)
 */

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config/env');
const { Readable } = require('stream');

// Initialize S3 client with R2 endpoint
let s3Client = null;

/**
 * Initialize R2 client
 */
function getClient() {
  if (!s3Client) {
    // Check if R2 is configured
    if (!config.r2.endpoint || !config.r2.accessKeyId || !config.r2.secretAccessKey) {
      console.warn('⚠️  R2 not configured - using placeholder signed URLs');
      return null;
    }

    s3Client = new S3Client({
      region: 'auto', // Cloudflare R2 uses 'auto' region
      endpoint: config.r2.endpoint,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });

    console.log('✅ R2 client initialized');
  }

  return s3Client;
}

/**
 * Generate presigned URL for downloading a file from R2
 * @param {string} fileKey - File key in R2 (e.g., "contents/abc-123.epub")
 * @param {number} expiresIn - Expiration time in seconds (default: 900 = 15 minutes)
 * @param {string} bucket - Bucket name (default: content bucket)
 * @returns {Promise<string>} Presigned URL
 */
async function generatePresignedUrl(fileKey, expiresIn = 900, bucket = null) {
  const client = getClient();

  // If R2 not configured, return placeholder URL
  if (!client) {
    const placeholderUrl = `https://cdn.papyri.com/${fileKey}?expires=${Date.now() + expiresIn * 1000}&placeholder=true`;
    console.warn(`⚠️  R2 not configured - returning placeholder URL: ${placeholderUrl}`);
    return placeholderUrl;
  }

  try {
    const bucketName = bucket || config.r2.bucketContent;

    // Create GetObject command
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
    });

    // Generate presigned URL
    const signedUrl = await getSignedUrl(client, command, {
      expiresIn,
    });

    return signedUrl;
  } catch (error) {
    console.error('❌ Error generating presigned URL:', error);
    throw new Error('Failed to generate signed URL for content');
  }
}

/**
 * Generate presigned URL for uploading a file to R2
 * @param {string} fileKey - File key in R2
 * @param {number} expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @param {string} contentType - MIME type of the file
 * @param {string} bucket - Bucket name (default: content bucket)
 * @returns {Promise<string>} Presigned URL for upload
 */
async function generateUploadUrl(fileKey, expiresIn = 3600, contentType = 'application/octet-stream', bucket = null) {
  const client = getClient();

  if (!client) {
    throw new Error('R2 not configured - cannot generate upload URL');
  }

  try {
    const bucketName = bucket || config.r2.bucketContent;

    // Create PutObject command
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      ContentType: contentType,
    });

    // Generate presigned URL
    const signedUrl = await getSignedUrl(client, command, {
      expiresIn,
    });

    return signedUrl;
  } catch (error) {
    console.error('❌ Error generating upload URL:', error);
    throw new Error('Failed to generate upload URL');
  }
}

/**
 * Download an object from R2 as Buffer
 * @param {string} fileKey
 * @param {string|null} bucket
 * @returns {Promise<{buffer: Buffer, contentType: string|null, contentLength: number|null}>}
 */
async function getObjectBuffer(fileKey, bucket = null) {
  const client = getClient();
  if (!client) {
    throw new Error('R2_NOT_CONFIGURED');
  }

  const bucketName = bucket || config.r2.bucketContent;
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
  });

  const response = await client.send(command);
  const bytes = await bodyToBuffer(response.Body);

  return {
    buffer: bytes,
    contentType: response.ContentType || null,
    contentLength: response.ContentLength || null,
  };
}

/**
 * Normalize AWS SDK v3 Body into a Node Buffer across runtimes.
 * Supports: Buffer, Uint8Array, Node Readable, Web ReadableStream, and transformToByteArray.
 */
async function bodyToBuffer(body) {
  if (!body) return Buffer.alloc(0);

  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  // Web ReadableStream (Node 18+ fetch style)
  if (typeof body.getReader === 'function') {
    const reader = body.getReader();
    const chunks = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  // Node.js stream.Readable
  if (typeof body.pipe === 'function' || body instanceof Readable) {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  throw new Error('UNSUPPORTED_R2_BODY_TYPE');
}

/**
 * Upload a buffer to R2
 * @param {Buffer|Uint8Array} body
 * @param {string} fileKey
 * @param {Object} options
 * @param {string|null} options.bucket
 * @param {string} options.contentType
 * @param {string|null} options.cacheControl
 * @returns {Promise<{key: string, bucket: string}>}
 */
async function uploadBuffer(body, fileKey, options = {}) {
  const client = getClient();
  if (!client) {
    throw new Error('R2_NOT_CONFIGURED');
  }

  const bucketName = options.bucket || config.r2.bucketContent;
  const contentType = options.contentType || 'application/octet-stream';
  const cacheControl = options.cacheControl || null;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
    Body: body,
    ContentType: contentType,
    ...(cacheControl ? { CacheControl: cacheControl } : {}),
  });

  await client.send(command);

  return {
    key: fileKey,
    bucket: bucketName,
  };
}

/**
 * Get public URL for a file (for covers bucket)
 * @param {string} fileKey - File key in R2
 * @param {string} bucket - Bucket name (default: covers bucket)
 * @returns {string} Public URL
 */
function getPublicUrl(fileKey, bucket = null) {
  const bucketName = bucket || config.r2.bucketCovers;

  // If CDN domain configured, use it
  if (config.r2.cdnDomain) {
    return `${config.r2.cdnDomain}/${fileKey}`;
  }

  // Otherwise, use R2 public URL format
  const accountId = config.r2.accountId;
  if (!accountId) {
    return `https://cdn.papyri.com/${fileKey}`; // Placeholder
  }

  return `https://pub-${accountId}.r2.dev/${bucketName}/${fileKey}`;
}

/**
 * Check if R2 is configured
 * @returns {boolean}
 */
function isConfigured() {
  return !!(config.r2.endpoint && config.r2.accessKeyId && config.r2.secretAccessKey);
}

module.exports = {
  generatePresignedUrl,
  generateUploadUrl,
  getObjectBuffer,
  uploadBuffer,
  getPublicUrl,
  isConfigured,
  getClient,
};
