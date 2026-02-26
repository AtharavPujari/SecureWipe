import { NextRequest, NextResponse } from 'next/server';
import { CertificateData, CertificateVerificationResult } from '@/lib/certificate';
import { createHash, createVerify } from 'crypto';

// In-memory storage for certificates (in production, use a database)
const certificates = new Map<string, CertificateData>();

export async function GET(
  request: NextRequest,
  { params }: { params: { certificateId: string } }
) {
  try {
    const { certificateId } = params;
    
    // Retrieve certificate
    const certificate = certificates.get(certificateId);
    
    if (!certificate) {
      return NextResponse.json(
        { 
          isValid: false,
          error: 'Certificate not found'
        },
        { status: 404 }
      );
    }

    // Perform comprehensive verification
    const verificationResult = await verifyCertificate(certificate);
    
    return NextResponse.json(verificationResult);

  } catch (error) {
    console.error('Certificate verification error:', error);
    return NextResponse.json(
      { 
        isValid: false,
        error: 'Failed to verify certificate'
      },
      { status: 500 }
    );
  }
}

async function verifyCertificate(certificate: CertificateData): Promise<CertificateVerificationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  let integrityValid = false;
  let signatureValid = false;
  let timestampValid = false;
  let deviceInfoValid = true;

  try {
    // 1. Verify data integrity using hash
    const dataString = JSON.stringify({
      deviceId: certificate.deviceId,
      deviceInfo: certificate.deviceInfo,
      wipeMethod: certificate.wipeMethod,
      wipeSecurityLevel: certificate.wipeSecurityLevel,
      wipeDate: certificate.wipeDate,
      wipeDuration: certificate.wipeDuration,
      verificationStatus: certificate.verificationStatus
    });

    const computedHash = createHash('sha256').update(dataString).digest('hex');
    integrityValid = computedHash === certificate.hash;
    
    if (!integrityValid) {
      errors.push('Data integrity check failed - certificate may have been tampered with');
    }

    // 2. Verify digital signature
    const verify = createVerify('RSA-SHA256');
    verify.update(dataString);
    signatureValid = verify.verify(certificate.publicKey, certificate.signature, 'hex');
    
    if (!signatureValid) {
      errors.push('Digital signature verification failed - certificate authenticity compromised');
    }

    // 3. Verify timestamp (not too old or in the future)
    const wipeDate = new Date(certificate.wipeDate);
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    
    timestampValid = wipeDate >= oneYearAgo && wipeDate <= now;
    
    if (!timestampValid) {
      if (wipeDate > now) {
        errors.push('Certificate timestamp is in the future');
      } else {
        warnings.push('Certificate timestamp is over one year old');
      }
    }

    // 4. Verify device information completeness
    const requiredDeviceInfoFields = ['manufacturer', 'model', 'serialNumber', 'type', 'capacity'];
    for (const field of requiredDeviceInfoFields) {
      if (!certificate.deviceInfo[field as keyof typeof certificate.deviceInfo]) {
        deviceInfoValid = false;
        errors.push(`Missing device information: ${field}`);
      }
    }

    // 5. Check compliance standards
    if (certificate.complianceStandards.length === 0) {
      warnings.push('No compliance standards specified');
    }

    // 6. Check verification status
    if (certificate.verificationStatus !== 'Success') {
      warnings.push(`Wipe verification status: ${certificate.verificationStatus}`);
    }

    // Overall validation
    const isValid = integrityValid && signatureValid && timestampValid && deviceInfoValid;

    let message = '';
    if (isValid) {
      message = 'Certificate is valid and authentic';
      if (warnings.length > 0) {
        message += ' (with warnings)';
      }
    } else {
      message = 'Certificate validation failed';
    }

    return {
      isValid,
      integrity: integrityValid,
      signature: signatureValid,
      timestamp: timestampValid,
      deviceInfo: deviceInfoValid,
      details: {
        message,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    };

  } catch (error) {
    console.error('Verification process error:', error);
    return {
      isValid: false,
      integrity: false,
      signature: false,
      timestamp: false,
      deviceInfo: false,
      details: {
        message: 'Verification process encountered an error',
        errors: ['Internal verification error']
      }
    };
  }
}
