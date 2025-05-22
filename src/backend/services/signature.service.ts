import crypto from 'crypto';
import { CertificateInfo } from './credential.service';

export class SignatureService {

  verifyRS256Signature(jwt: string): { isValid: boolean; errors?: string[]; certificateInfo?: CertificateInfo } {
    try {
      const parts = jwt.split('.');
      const [headerB64, payloadB64, signatureB64] = parts;

      if (!headerB64 || !payloadB64 || !signatureB64) {
        console.error('Missing JWT parts for signature verification');
        return { isValid: false, errors: ['Missing JWT parts for signature verification'] };
      }

      let header;
      try {
        header = JSON.parse(this.b64urlToUtf8(headerB64));
      } catch (error) {
        console.error('Failed to parse JWT header for signature verification:', error);
        return { isValid: false, errors: ['Failed to parse JWT header for signature verification'] };
      }

      if (!header.x5c || !Array.isArray(header.x5c) || !header.x5c[0]) {
        console.error('Missing or invalid x5c in JWT header');

        return { isValid: false, errors: ['Missing or invalid x5c in JWT header'] };
      }

      const certBase64 = header.x5c[0];

      try {
        const certPEM = this.formatCertificateAsPEM(certBase64);

        let cert;
        try {
          cert = new crypto.X509Certificate(certPEM);
        } catch (certError) {
          console.error('Failed to create certificate object:', certError);

          try {
            const derBuffer = this.base64ToBuffer(certBase64);
            cert = new crypto.X509Certificate(derBuffer);
          } catch (derError) {
            console.error('Failed to create certificate object using DER format:', derError);
            throw new Error(`Cannot parse certificate: ${certError}`);
          }
        }

        const certificateInfo = this.extractCertificateInfo(cert);

        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(`${headerB64}.${payloadB64}`);
        verify.end();

        const signature = Buffer.from(signatureB64, 'base64url');
        const signatureValid = verify.verify(certPEM, signature);

        certificateInfo.signatureValid = signatureValid;
        certificateInfo.isValid = certificateInfo.isValid && signatureValid;

        return { 
          isValid: signatureValid, 
          certificateInfo 
        };
      } catch (error) {
        console.error('Error during signature verification process:', error);
        this.logDetailedError(error);
        return { isValid: false, errors: [`Certificate validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`] };
      }
    } catch (error) {
      console.error('Unexpected error in RS256 signature verification:', error);
      this.logDetailedError(error);
      return { isValid: false, errors: [`Signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`] };
    }
  }

  private b64urlToUtf8(str: string): string {
    return Buffer.from(str, 'base64url').toString();
  }

  private formatCertificateAsPEM(certBase64: string): string {
    let standardBase64 = certBase64.replace(/-/g, '+').replace(/_/g, '/');

    while (standardBase64.length % 4 !== 0) {
      standardBase64 += '=';
    }

    // @ts-ignore
    return `-----BEGIN CERTIFICATE-----\n${standardBase64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
  }

  private base64ToBuffer(base64: string): Buffer {
    let standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');

    while (standardBase64.length % 4 !== 0) {
      standardBase64 += '=';
    }

    return Buffer.from(standardBase64, 'base64');
  }


  private extractCertificateInfo(cert: crypto.X509Certificate): CertificateInfo {
    const now = new Date();
    const validFrom = new Date(cert.validFrom);
    const validTo = new Date(cert.validTo);
    const isTimeValid = now >= validFrom && now <= validTo;

    const issuer = cert.issuer;
    const subject = cert.subject;

    let chainValid = false;
    try {
      chainValid = true; //TODO
    } catch (chainError) {
      console.error('Error validating certificate chain:', chainError);
    }

    const isRevoked = false;

    return {
      isValid: isTimeValid && !isRevoked,
      validFrom,
      validTo,
      chainValid,
      isRevoked,
      issuer,
      subject,
      signatureValid: false
    };
  }

  private logDetailedError(error: unknown): void {
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      if (error.stack) {
        console.error('Error stack:', error.stack);
      }
    }
  }
}

export const signatureService = new SignatureService();