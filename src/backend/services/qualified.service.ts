import { Resolver } from 'did-resolver';
import { 
  verifyCredential as verifyCredentialJwt, 
  verifyPresentation as verifyPresentationJwt,
  validateJwtCredentialPayload,
  validateCredentialPayload,
  validateJwtPresentationPayload,
  validatePresentationPayload
} from 'did-jwt-vc';
import { VerificationResult } from './credential.service';
import { signatureService } from './signature.service';
import { 
  parseJwt, 
  isJwt, 
  isVpJwt, 
  isVcJwt,
  b64urlToUtf8, 
  getJwtRawParts,
} from '../utils/jwt.utils';

export class QualifiedService {
  private resolver: Resolver;

  constructor(resolver: Resolver) {
    this.resolver = resolver;
  }

  async verifyVC(credential: string): Promise<VerificationResult> {
    if (!isJwt(credential)) {
      try {
        credential = JSON.parse(credential);
      } catch (error) {
        console.error('Failed to parse credential as JSON:', error);
        return { 
          issuedByUs: false,
          isValid: false, 
          errors: ['Invalid credential format: not a JWT or valid JSON'] 
        };
      }
    }

    if (isJwt(credential)) {
      const jwtToVerify = credential;
      try {
        const parsedJwt = parseJwt(jwtToVerify);
        if (!parsedJwt) {
          console.error('Failed to parse JWT');
          return { issuedByUs: false, isValid: false, errors: ['Invalid JWT format'] };
        }

        if (isVpJwt(parsedJwt)) {
          console.error('Expected a VC but received a VP');
          return { issuedByUs: false, isValid: false, errors: ['Expected a VC but received a VP'] };
        }

        if (parsedJwt.header.alg === 'RS256' && parsedJwt.header.x5c) {
          const signatureResult = signatureService.verifyRS256Signature(jwtToVerify);
          if (!signatureResult.isValid) {
            console.error('RS256 signature verification failed for credential');
            return { issuedByUs: false, isValid: false, errors: ['Invalid RS256 signature'] };
          }

          const certificateInfo = signatureResult.certificateInfo;

          try {
            if (parsedJwt.payload.vc) {
              validateJwtCredentialPayload(parsedJwt.payload);
            } else {
              validateCredentialPayload(parsedJwt.payload);
            }
          } catch (error) {
            console.error('Invalid credential structure (W3C):', error);
            return {
              issuedByUs: false,
              isValid: false,
              errors: ['Invalid VC structure (W3C): ' + error],
            };
          }

          return {
            issuedByUs: false,
            isValid: true,
            subject: {
              did: '',
            },
            isQualified: true,
            certificateInfo
          };
        } 

        try {
          const result = await verifyCredentialJwt(jwtToVerify, this.resolver);

          const vc = result.verifiableCredential;

          try {
            const rawParts = getJwtRawParts(result.jwt);
            if (rawParts) {
              const decodedPayload = JSON.parse(b64urlToUtf8(rawParts.payloadB64));
              validateJwtCredentialPayload(decodedPayload);
            } else {
              validateCredentialPayload(vc);
            }
          } catch (error) {
            console.error('Qualified VC schema validation failed:', error);
          }

          return {
            issuedByUs: false,
            isValid: true,
            subject: {
              did: vc.credentialSubject.id || '',
              ...vc.credentialSubject,
            },
            isQualified: true,
          };
        } catch (error) {
          console.error('did-jwt-vc credential verification failed:', error);
          return {
            issuedByUs: false,
            isValid: false,
            errors: ['Error verifying credential: ' + error],
          };
        }
      } catch (error) {
        console.error('Error verifying JWT credential:', error);
        return {
          issuedByUs: false,
          isValid: false,
          errors: ['Error verifying credential: ' + error],
        };
      }
    }

    console.error('Unable to validate qualified credential');
    return { issuedByUs: false, isValid: false, errors: ['Unable to validate qualified credential'] };
  }

  async verifyVP(presentation: string | object): Promise<VerificationResult> {
    if (typeof presentation === 'string' && !isJwt(presentation)) {
      try {
        presentation = JSON.parse(presentation);
      } catch (error) {
        console.error('Failed to parse presentation as JSON:', error);
        return { 
          issuedByUs: false,
          isValid: false, 
          errors: ['Invalid presentation format: not a JWT or valid JSON'] 
        };
      }
    }

    if (typeof presentation === 'string' && isJwt(presentation)) {
      const jwtToVerify = presentation;
      try {
        const parsedJwt = parseJwt(jwtToVerify);
        if (!parsedJwt) {
          console.error('Failed to parse JWT');
          return { issuedByUs: false, isValid: false, errors: ['Invalid JWT format'] };
        }

        if (isVcJwt(parsedJwt) && !isVpJwt(parsedJwt)) {
          console.error('Expected a VP but received a VC');
          return { issuedByUs: false, isValid: false, errors: ['Expected a VP but received a VC'] };
        }

        if (parsedJwt.header.alg === 'RS256' && parsedJwt.header.x5c) {
          const signatureResult = signatureService.verifyRS256Signature(jwtToVerify);
          if (!signatureResult.isValid) {
            console.error('RS256 signature verification failed');
            return { issuedByUs: false, isValid: false, errors: ['Invalid RS256 signature in VP'] };
          }

          const certificateInfo = signatureResult.certificateInfo;

          const vp = parsedJwt.payload.vp || parsedJwt.payload;

          try {
            if (parsedJwt.payload.vp) {
              validateJwtPresentationPayload(parsedJwt.payload);
            } else {
              validatePresentationPayload(vp);
            }
          } catch (error) {
            console.error('Invalid VP structure (W3C):', error);
            return { issuedByUs: false, isValid: false, errors: ['Invalid VP structure (W3C): ' + error] };
          }

          const credentials = Array.isArray(vp.verifiableCredential) 
            ? vp.verifiableCredential 
            : [vp.verifiableCredential];

          const { verifyCredential } = await import('./credential.service');

          for (let i = 0; i < credentials.length; i++) {
            const cred = credentials[i];
            const result = await verifyCredential(cred);

            if (!result.isValid) {
              console.error(`Credential ${i+1} verification failed:`, result.errors);
              return { 
                issuedByUs: false,
                isValid: false, 
                errors: [`Invalid credential in VP: ${(result.errors || []).join(', ')}`] 
              };
            }
          }

          return { 
            issuedByUs: false,
            isValid: true, 
            subject: {}, 
            isQualified: true,
            certificateInfo 
          };
        } 

        try {
          const result = await verifyPresentationJwt(jwtToVerify, this.resolver);

          return { issuedByUs: false, isValid: result.verified, subject: {}, isQualified: true };
        } catch (error) {
          console.error('did-jwt-vc verification failed:', error);

          if (parsedJwt.header.x5c && parsedJwt.header.alg === 'RS256') {
            const signatureResult = signatureService.verifyRS256Signature(jwtToVerify);
            if (!signatureResult.isValid) {
              console.error('RS256 signature verification failed');
              return { issuedByUs: false, isValid: false, errors: ['Invalid RS256 signature'] };
            }

            const certificateInfo = signatureResult.certificateInfo;
            const vp = parsedJwt.payload.vp || parsedJwt.payload;

            try {
              if (parsedJwt.payload.vp) {
                validateJwtPresentationPayload(parsedJwt.payload);
              } else {
                validatePresentationPayload(vp);
              }
            } catch (error) {
              console.error('Invalid VP structure (W3C):', error);
              return { issuedByUs: false, isValid: false, errors: ['Invalid VP structure (W3C): ' + error] };
            }

            const credentials = Array.isArray(vp.verifiableCredential) 
              ? vp.verifiableCredential 
              : [vp.verifiableCredential];

            const { verifyCredential } = await import('./credential.service');

            for (let i = 0; i < credentials.length; i++) {
              const cred = credentials[i];

              const result = await verifyCredential(cred);

              if (!result.isValid) {
                console.error(`Credential ${i+1} verification failed:`, result.errors);
                return { 
                  issuedByUs: false,
                  isValid: false, 
                  errors: [`Invalid credential in VP: ${(result.errors || []).join(', ')}`] 
                };
              }
            }

            return { 
              issuedByUs: false,
              isValid: true, 
              subject: {}, 
              isQualified: true,
              certificateInfo 
            };
          }

          console.error('All verification methods failed');
          return { issuedByUs: false, isValid: false, errors: [`Error verifying presentation: ${error}`] };
        }
      } catch (error) {
        console.error('Unexpected error during JWT verification:', error);
        return { issuedByUs: false, isValid: false, errors: ['Error verifying presentation: ' + error] };
      }
    }
    console.error('Unable to validate qualified VP');
    return { issuedByUs: false, isValid: false, errors: ['Unable to validate qualified VP'] };
  }
}