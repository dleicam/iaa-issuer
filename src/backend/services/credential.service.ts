import { Resolver } from 'did-resolver';
import { getResolver as getWebResolver } from 'web-did-resolver';
import * as jose from 'jose'; // Import jose for key parsing
import { v4 as uuidv4 } from 'uuid'; // NEW: Import UUID generator

import { signJwtWithRs256AndX5c, signJwtWithDidKey } from '../utils/jwt.utils'; // Import the new signing helpers

import { QualifiedService } from './qualified.service';
import { NonQualifiedService } from './non-qualified.service';

export interface CertificateInfo {
  isValid: boolean;
  validFrom?: Date;
  validTo?: Date;
  chainValid?: boolean;
  isRevoked?: boolean;
  issuer?: string;
  subject?: string;
  signatureValid?: boolean;
}

export interface VerificationResult {
  issuedByUs: boolean;
  isValid: boolean;
  errors?: string[];
  subject?: any;
  isQualified?: boolean;
  certificateInfo?: CertificateInfo;
}

export interface IssuedCredential {
  jwt: string;
  decoded: any;
}

export function b64urlToUtf8(str: string) {
  return Buffer.from(str, 'base64url').toString();
}

export class CredentialService {
  private resolver: Resolver;
  private qualifiedService: QualifiedService;
  private nonQualifiedService: NonQualifiedService;

  // NEW: Key material for Issuer, loaded once
  private issuerRs256PrivateKey: string | undefined;
  private issuerRs256Certificate: string | undefined;
  private issuerDidKeyPrivateKeyJwk: jose.JWK | undefined;
  private issuerDid: string | undefined;


  constructor() {
    this.resolver = new Resolver({ ...getWebResolver() });
    this.qualifiedService = new QualifiedService(this.resolver);
    this.nonQualifiedService = new NonQualifiedService(this.resolver);

    // NEW: Load key material from environment variables
    this.issuerRs256PrivateKey = process.env.ISSUER_RS256_PRIVATE_KEY_PEM;
    this.issuerRs256Certificate = process.env.ISSUER_RS256_CERTIFICATE_PEM;
    this.issuerDid = process.env.ISSUER_DID;
    try {
        if (process.env.ISSUER_DID_KEY_PRIVATE_KEY_JWK) {
            this.issuerDidKeyPrivateKeyJwk = JSON.parse(process.env.ISSUER_DID_KEY_PRIVATE_KEY_JWK);
        }
    } catch (e) {
        console.error("Failed to parse ISSUER_DID_KEY_PRIVATE_KEY_JWK:", e);
    }

    // Assert that necessary keys are available for issuing
    if (!this.issuerDid) {
      console.error("CRITICAL: ISSUER_DID environment variable is not set. Credential issuance will fail.");
    }
    // Note: These checks are for convenience. The actual throw happens during issueCredential if keys are missing.
    if (!this.issuerRs256PrivateKey || !this.issuerRs256Certificate) {
      console.warn("WARNING: RS256 private key or certificate PEM not fully set. Qualified credential issuance might fail.");
    }
    if (!this.issuerDidKeyPrivateKeyJwk) {
        console.warn("WARNING: DID Key JWK not set. Non-qualified credential issuance might fail.");
    }
  }

  // ... (analyzeCredential, verifyCredential, verifyPresentation methods remain unchanged) ...

  /**
   * Generates a Verifiable Credential JWT and its decoded payload, cryptographically signed.
   * This method handles the actual signing process based on the `isQualified` flag.
   * This method is intended purely for credential *generation* and does not
   * handle storage or persistence to a database. Database persistence
   * is handled by the IssuerService.
   *
   * @param issuerDid The DID of the issuer (from parameters, or use class default if provided).
   * @param subjectDid The DID of the credential subject.
   * @param type The type of the credential.
   * @param claims An object containing the credential claims.
   * @param isQualified Whether the credential is a qualified credential (affects signing method).
   * @returns A Promise resolving to an IssuedCredential object.
   */
  async issueCredential(
    issuerDid: string, // Parameter for specific issuer, or use this.issuerDid if global
    subjectDid: string,
    type: string,
    claims: any,
    isQualified: boolean = false
  ): Promise<IssuedCredential> {
    const now = new Date();
    const oneYearLater = new Date();
    oneYearLater.setFullYear(now.getFullYear() + 1);

    const types = ['VerifiableCredential', type];
    if (isQualified) {
      types.push('VCQualified');
    }

    // Construct the VC payload (the 'decoded' part)
    const credentialPayload = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://www.w3.org/2018/credentials/examples/v1' // Or a context for your specific claims
      ],
      id: `${issuerDid}#${uuidv4()}`, // NEW: Use UUIDv4 for unique ID to prevent collisions
      type: types,
      issuer: issuerDid, // Use the provided issuerDid or this.issuerDid
      issuanceDate: now.toISOString(),
      expirationDate: oneYearLater.toISOString(),
      credentialSubject: {
        id: subjectDid,
        ...claims
      }
    };

    let signedJwt: string;

    if (isQualified) {
      // Qualified Credential: Use RS256 with x5c (from Issuer's RSA key and cert)
      if (!this.issuerRs256PrivateKey || !this.issuerRs256Certificate || !this.issuerDid) {
        throw new Error("Missing RS256 key/certificate or Issuer DID for qualified credential issuance.");
      }
      signedJwt = await signJwtWithRs256AndX5c(
        credentialPayload,
        this.issuerRs256PrivateKey,
        this.issuerRs256Certificate
      );
    } else {
      // Non-Qualified Credential: Use DID-based signing (e.g., Ed25519 did:key)
      if (!this.issuerDidKeyPrivateKeyJwk || !this.issuerDid) {
        throw new Error("Missing DID key JWK or Issuer DID for non-qualified credential issuance.");
      }
      signedJwt = await signJwtWithDidKey(
        credentialPayload,
        this.issuerDidKeyPrivateKeyJwk,
        this.issuerDid // Use the configured issuer DID for the DID-based signing
      );
    }

    return {
      jwt: signedJwt,
      decoded: credentialPayload // Return the constructed payload
    };
  }
}

// ... (Exported verifyCredential, verifyPresentation, and issueCredential functions remain unchanged) ...
// The exported issueCredential function will now call the class method which performs real signing.
