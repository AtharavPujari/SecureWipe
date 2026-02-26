import crypto from 'crypto';

// Generate a unique certificate ID
export function generateCertificateId(): string {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(4).toString('hex');
  return `CERT-${timestamp}-${random}`;
}

// Generate a digital signature for data
export function generateSignature(data: string, privateKey: string): string {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(data);
  return sign.sign(privateKey, 'base64');
}

// Verify a digital signature
export function verifySignature(data: string, signature: string, publicKey: string): boolean {
  try {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(data);
    return verify.verify(publicKey, signature, 'base64');
  } catch (error) {
    return false;
  }
}

// Generate hash of data
export function generateHash(data: string, algorithm: string = 'sha256'): string {
  return crypto.createHash(algorithm).update(data).digest('hex');
}

// Generate RSA key pair
export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  return { publicKey, privateKey };
}

// Generate QR code data (simplified - in production you'd use a proper QR library)
export function generateQRCodeData(certificate: any): string {
  const qrData = {
    id: certificate.certificateId,
    verify: certificate.verification.verificationUrl,
    hash: certificate.verification.certificateHash,
    timestamp: certificate.timestamp
  };
  return Buffer.from(JSON.stringify(qrData)).toString('base64');
}

// Generate verification URL
export function generateVerificationUrl(certificateId: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/certificates/verify/${certificateId}`;
}

// Create tamper-proof certificate hash
export function createCertificateHash(certificateData: any): string {
  // Create a canonical string representation of the certificate data
  const canonicalData = JSON.stringify({
    certificateId: certificateData.certificateId,
    wipeId: certificateData.wipeId,
    timestamp: certificateData.timestamp,
    deviceInfo: {
      name: certificateData.deviceInfo.name,
      serial: certificateData.deviceInfo.serial,
      sizeBytes: certificateData.deviceInfo.sizeBytes
    },
    wipeDetails: {
      method: certificateData.wipeDetails.method,
      startTime: certificateData.wipeDetails.startTime,
      endTime: certificateData.wipeDetails.endTime,
      passes: certificateData.wipeDetails.passes
    }
  }, Object.keys(certificateData).sort());
  
  return generateHash(canonicalData);
}

// Verify certificate integrity
export function verifyCertificateIntegrity(certificate: any): boolean {
  try {
    // Recreate the hash from the certificate data
    const recreatedHash = createCertificateHash(certificate);
    
    // Compare with the stored hash
    return recreatedHash === certificate.verification.certificateHash;
  } catch (error) {
    return false;
  }
}

// Generate a unique wipe ID
export function generateWipeId(): string {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(4).toString('hex');
  return `wipe-${timestamp}-${random}`;
}