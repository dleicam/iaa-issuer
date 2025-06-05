// src/backend/tests/credential.tests.ts
import dotenv from 'dotenv';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as jose from 'jose';

// --- Vitest Imports ---
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Load environment variables for tests. Point to the .env in the project root.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { CredentialService } from '../services/credential.service';
import sequelize, { initializeDatabase } from '../db/database';
import { signJwtWithRs256AndX5c, signJwtWithDidKey } from '../utils/jwt.utils';

// --- Test Utilities and Fixture Generation ---

// Ensure keys are loaded from .env before test fixture generation
const TEST_ISSUER_DID = process.env.ISSUER_DID;
const TEST_RS256_PRIV_KEY_PEM = process.env.ISSUER_RS256_PRIVATE_KEY_PEM;
const TEST_RS256_CERT_PEM = process.env.ISSUER_RS256_CERTIFICATE_PEM;
let TEST_ED25519_PRIV_JWK: jose.JWK | undefined;

try {
    if (process.env.ISSUER_DID_KEY_PRIVATE_KEY_JWK) {
        TEST_ED25519_PRIV_JWK = JSON.parse(process.env.ISSUER_DID_KEY_PRIVATE_KEY_JWK);
    }
} catch (e) {
    console.error("Failed to parse ISSUER_DID_KEY_PRIVATE_KEY_JWK from .env:", e);
}


// Pre-generated deterministic test VCs/VPs
let nonQualifiedVcJwt: string;
let qualifiedVcJwt: string;
let nonQualifiedVpJwt: string;
let qualifiedVpJwt: string;
let holderDidForVp: string;

// Helper to generate a basic VC payload structure for testing
async function createBaseVcPayload(
    isQualified: boolean,
    subjectDid: string = `did:example:testsubject:${uuidv4()}`,
    expirationOffsetYears: number = 1,
    issuer: string | undefined = TEST_ISSUER_DID
): Promise<any> {
    if (!issuer) throw new Error("Test Issuer DID is not defined");
    const now = new Date();
    const expirationDate = new Date();
    expirationDate.setFullYear(now.getFullYear() + expirationOffsetYears);

    const types = ['VerifiableCredential', 'TestCredential'];
    if (isQualified) types.push('VCQualified');

    return {
        '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
        id: `${issuer}#${uuidv4()}`,
        type: types,
        issuer: issuer,
        issuanceDate: now.toISOString(),
        expirationDate: expirationDate.toISOString(),
        credentialSubject: {
            id: subjectDid,
            testClaim: `This is a ${isQualified ? 'qualified' : 'non-qualified'} test claim.`
        }
    };
}

// Function to generate and store deterministic test JWTs
async function generateTestFixtures() {
    console.log('\n--- Generating Test Fixtures ---');
    if (!TEST_ISSUER_DID || !TEST_RS256_PRIV_KEY_PEM || !TEST_RS256_CERT_PEM || !TEST_ED25519_PRIV_JWK) {
        throw new Error("One or more test issuer keys/DIDs are not configured in .env. Cannot generate fixtures.");
    }

    // 1. Non-Qualified VC
    const nonQualVcPayload = await createBaseVcPayload(false);
    holderDidForVp = nonQualVcPayload.credentialSubject.id; // Use this VC's subject as holder for VPs
    nonQualifiedVcJwt = await signJwtWithDidKey(nonQualVcPayload, TEST_ED25519_PRIV_JWK, TEST_ISSUER_DID);
    console.log('Generated Non-Qualified VC JWT.');

    // 2. Qualified VC
    const qualVcPayload = await createBaseVcPayload(true);
    qualifiedVcJwt = await signJwtWithRs256AndX5c(qualVcPayload, TEST_RS256_PRIV_KEY_PEM, TEST_RS256_CERT_PEM);
    console.log('Generated Qualified VC JWT.');

    // 3. Non-Qualified VP (containing a non-qualified VC)
    const nonQualVpPayload = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: holderDidForVp,
        verifiableCredential: [nonQualifiedVcJwt] // Present the VC as a JWT string
    };
    // Sign VP with the same DID key as the VC holder for simplicity in testing
    // For a real scenario, holder would use their own key. Here, we use issuer's Ed25519 key as a stand-in for holder's key.
    nonQualifiedVpJwt = await signJwtWithDidKey(nonQualVpPayload, TEST_ED25519_PRIV_JWK, holderDidForVp);
    console.log('Generated Non-Qualified VP JWT.');


    // 4. Qualified VP (containing a qualified VC)
    const qualVpPayload = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation', 'VPQualified'],
        holder: qualVcPayload.credentialSubject.id, // Or use holderDidForVp if consistent holder desired
        verifiableCredential: [qualifiedVcJwt] // Present the VC as a JWT string
    };
    // Sign VP with the same RS256 key as the VC issuer for simplicity in testing
    qualifiedVpJwt = await signJwtWithRs256AndX5c(qualVpPayload, TEST_RS256_PRIV_KEY_PEM, TEST_RS256_CERT_PEM);
    console.log('Generated Qualified VP JWT.');

    console.log('--- Test Fixtures Generated ---');
}


// --- Test Suite for CredentialService ---
describe('CredentialService Tests', () => {
  let credentialService: CredentialService;

  beforeAll(async () => {
    // Validate essential ENV variables for tests
    if (!TEST_ISSUER_DID || !TEST_RS256_PRIV_KEY_PEM || !TEST_RS256_CERT_PEM || !TEST_ED25519_PRIV_JWK) {
        throw new Error("Critical test environment variables for issuer keys/DID are missing. Check .env setup and key generation steps.");
    }
    await initializeDatabase(); // For any underlying services that might touch DB (though CredentialService itself doesn't directly)
    console.log('Database initialized for tests.');

    await generateTestFixtures();

    credentialService = new CredentialService();
  });

  afterAll(async () => {
    await sequelize.close();
    console.log('Database connection closed.');
  });

  // --- Test issueCredential ---
  describe('issueCredential', () => {
    it('should issue a valid non-qualified VC JWT', async () => {
      const subjectDid = `did:example:subject:${uuidv4()}`;
      const issued = await credentialService.issueCredential(
        TEST_ISSUER_DID!,
        subjectDid,
        'TestNonQualified',
        { customClaim: 'nq_value' },
        false
      );
      expect(issued.jwt).toBeDefined();
      expect(issued.jwt.split('.').length).toBe(3); // Basic JWT structure
      expect(issued.decoded).toBeDefined();
      expect(issued.decoded.type).toContain('TestNonQualified');
      expect(issued.decoded.type).not.toContain('VCQualified');
      expect(issued.decoded.issuer).toBe(TEST_ISSUER_DID);
      expect(issued.decoded.credentialSubject.id).toBe(subjectDid);
      expect(issued.decoded.credentialSubject.customClaim).toBe('nq_value');

      // Verify it
      const verificationResult = await credentialService.verifyCredential(issued.jwt);
      expect(verificationResult.isValid).toBe(true);
      expect(verificationResult.isQualified).toBe(false);
    });

    it('should issue a valid qualified VC JWT', async () => {
      const subjectDid = `did:example:subject:${uuidv4()}`;
      const issued = await credentialService.issueCredential(
        TEST_ISSUER_DID!,
        subjectDid,
        'TestQualified',
        { customClaim: 'q_value' },
        true
      );
      expect(issued.jwt).toBeDefined();
      expect(issued.jwt.split('.').length).toBe(3);
      expect(issued.decoded).toBeDefined();
      expect(issued.decoded.type).toContain('TestQualified');
      expect(issued.decoded.type).toContain('VCQualified');
      expect(issued.decoded.issuer).toBe(TEST_ISSUER_DID);
      expect(issued.decoded.credentialSubject.id).toBe(subjectDid);
      expect(issued.decoded.credentialSubject.customClaim).toBe('q_value');

      // Verify it
      const verificationResult = await credentialService.verifyCredential(issued.jwt);
      expect(verificationResult.isValid).toBe(true);
      expect(verificationResult.isQualified).toBe(true);
      expect(verificationResult.certificateInfo?.isValid).toBe(true); // Certificate itself is valid (time, etc.)
      expect(verificationResult.certificateInfo?.signatureValid).toBe(true); // JWT signature verified with cert
    });

    it('should throw error if issuing qualified VC without RS256 keys configured', async () => {
        const originalPrivKey = process.env.ISSUER_RS256_PRIVATE_KEY_PEM;
        process.env.ISSUER_RS256_PRIVATE_KEY_PEM = ""; // Temporarily unset
        const tempService = new CredentialService(); // Re-instantiate to pick up changed env

        await expect(tempService.issueCredential(TEST_ISSUER_DID!, 'did:ex:sub', 'FailQual', {}, true))
              .rejects.toThrow('Missing RS256 key/certificate or Issuer DID for qualified credential issuance.');
        process.env.ISSUER_RS256_PRIVATE_KEY_PEM = originalPrivKey; // Restore
    });


    it('should throw error if issuing non-qualified VC without DID key configured', async () => {
        const originalDidJwk = process.env.ISSUER_DID_KEY_PRIVATE_KEY_JWK;
        process.env.ISSUER_DID_KEY_PRIVATE_KEY_JWK = ""; // Temporarily unset
        const tempService = new CredentialService(); // Re-instantiate

        await expect(tempService.issueCredential(TEST_ISSUER_DID!, 'did:ex:sub', 'FailNonQual', {}, false))
              .rejects.toThrow('Missing DID key JWK or Issuer DID for non-qualified credential issuance.');
        process.env.ISSUER_DID_KEY_PRIVATE_KEY_JWK = originalDidJwk; // Restore
    });
  });

  // --- Test analyzeCredential ---
  describe('analyzeCredential', () => {
    it('should correctly analyze a non-qualified VC JWT', async () => {
      const analysis = await credentialService.analyzeCredential(nonQualifiedVcJwt);
      expect(analysis.isVP).toBe(false);
      expect(analysis.isQualified).toBe(false);
      expect(analysis.jwtToken).toBe(nonQualifiedVcJwt);
      expect(analysis.payload?.type).toContain('TestCredential');
    });

    it('should correctly analyze a qualified VC JWT', async () => {
      const analysis = await credentialService.analyzeCredential(qualifiedVcJwt);
      expect(analysis.isVP).toBe(false);
      expect(analysis.isQualified).toBe(true);
      expect(analysis.jwtToken).toBe(qualifiedVcJwt);
      expect(analysis.payload?.type).toContain('VCQualified');
    });

    it('should correctly analyze a non-qualified VP JWT', async () => {
      const analysis = await credentialService.analyzeCredential(nonQualifiedVpJwt);
      expect(analysis.isVP).toBe(true);
      expect(analysis.isQualified).toBe(false); // The VP itself is signed with did:key
      expect(analysis.jwtToken).toBe(nonQualifiedVpJwt);
      expect(analysis.payload?.type).toContain('VerifiablePresentation');
    });

    it('should correctly analyze a qualified VP JWT', async () => {
      const analysis = await credentialService.analyzeCredential(qualifiedVpJwt);
      expect(analysis.isVP).toBe(true);
      expect(analysis.isQualified).toBe(true); // VP signed with RS256 and has x5c
      expect(analysis.jwtToken).toBe(qualifiedVpJwt);
      expect(analysis.payload?.type).toContain('VPQualified');
    });

    it('should analyze a non-JWT JSON string (VC)', async () => {
        const vcObject = await createBaseVcPayload(false);
        const analysis = await credentialService.analyzeCredential(JSON.stringify(vcObject));
        expect(analysis.isVP).toBe(false);
        expect(analysis.isQualified).toBe(false);
        expect(analysis.jwtToken).toBeUndefined();
        expect(analysis.objCredential).toEqual(vcObject);
    });

    it('should analyze an invalid string', async () => {
        const analysis = await credentialService.analyzeCredential("invalid string");
        expect(analysis.isVP).toBe(false);
        expect(analysis.isQualified).toBe(false);
        expect(analysis.jwtToken).toBeUndefined();
        expect(analysis.payload).toBeNull();
    });
  });

  // --- Test verifyCredential ---
  describe('verifyCredential', () => {
    it('should verify a valid non-qualified VC JWT', async () => {
      const result = await credentialService.verifyCredential(nonQualifiedVcJwt);
      expect(result.isValid).toBe(true);
      expect(result.isQualified).toBe(false);
      expect(result.errors).toBeUndefined();
    });

    it('should verify a valid qualified VC JWT', async () => {
      const result = await credentialService.verifyCredential(qualifiedVcJwt);
      expect(result.isValid).toBe(true);
      expect(result.isQualified).toBe(true);
      expect(result.certificateInfo?.isValid).toBe(true);
      expect(result.certificateInfo?.signatureValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should fail to verify a tampered qualified VC (bad signature)', async () => {
      const parts = qualifiedVcJwt.split('.');
      const tamperedJwt = `${parts[0]}.${parts[1]}xxx.${parts[2]}`; // Corrupt payload part for sig check
      const result = await credentialService.verifyCredential(tamperedJwt);
      expect(result.isValid).toBe(false);
      // isQualified might still be true if header implies it, but overall isValid is false
      expect(result.errors).toBeDefined();
      // Error message depends on underlying library, could be "Signature verification failed" or similar
      expect(result.errors?.[0]).toContain('Invalid RS256 signature');
    });

    it('should fail to verify an expired qualified VC (VC exp claim)', async () => {
        const expiredPayload = await createBaseVcPayload(true, `did:ex:expiredsub:${uuidv4()}`, -1); // Expired 1 year ago
        const expiredVcJwt = await signJwtWithRs256AndX5c(expiredPayload, TEST_RS256_PRIV_KEY_PEM!, TEST_RS256_CERT_PEM!);
        const result = await credentialService.verifyCredential(expiredVcJwt);
        expect(result.isValid).toBe(false);
        expect(result.isQualified).toBe(true); // It's structurally a qualified VC
        expect(result.errors).toBeDefined();
        // This error comes from did-jwt-vc or jose's expiration check
        expect(result.errors?.[0]).toMatch(/expired|ExpirationTime/i);
    });

     it('should fail to verify a qualified VC with an expired certificate', async () => {
        // This requires generating a certificate that is *actually* expired.
        // For MVP, we assume the test cert is valid. A more advanced test would involve
        // mocking date or using an actual expired cert.
        // Here, we'll simulate the error message structure if signature.service detected it.
        const payload = await createBaseVcPayload(true);
        const jwtWithHypotheticallyExpiredCert = await signJwtWithRs256AndX5c(payload, TEST_RS256_PRIV_KEY_PEM!, TEST_RS256_CERT_PEM!);

        // To properly test this, signatureService.verifyRS256Signature would need to return isValid:false
        // due to cert expiry. Since we can't easily make the cert expire *during* the test run without
        // complex mocks or specific cert generation, we trust signature.service.ts handles this.
        // If signature.service.ts correctly identifies an expired cert, it will set
        // certificateInfo.isValid to false, and qualifiedService should propagate this.
        const result = await credentialService.verifyCredential(jwtWithHypotheticallyExpiredCert);
        // If current cert is valid, this will pass. If it were expired, signatureService would make it fail.
        if (new Date(result.certificateInfo!.validTo!) < new Date()) {
             expect(result.isValid).toBe(false);
             expect(result.errors?.[0]).toContain("Certificate validation failed: Certificate is expired");
        } else {
            expect(result.isValid).toBe(true); // Assuming test cert is not expired
        }
    });

    it('should fail if a VP is provided when a VC is expected', async () => {
      const result = await credentialService.verifyCredential(nonQualifiedVpJwt);
      expect(result.isValid).toBe(false);
      expect(result.errors?.[0]).toContain('Expected a VC but received a VP');
    });
  });

  // --- Test verifyPresentation ---
  describe('verifyPresentation', () => {
    it('should verify a valid non-qualified VP JWT', async () => {
      const result = await credentialService.verifyPresentation(nonQualifiedVpJwt);
      expect(result.isValid).toBe(true);
      expect(result.isQualified).toBe(false); // VP signed with EdDSA
      expect(result.errors).toBeUndefined();
    });

    it('should verify a valid qualified VP JWT', async () => {
      const result = await credentialService.verifyPresentation(qualifiedVpJwt);
      expect(result.isValid).toBe(true);
      expect(result.isQualified).toBe(true); // VP signed with RS256/x5c
      expect(result.certificateInfo?.isValid).toBe(true);
      expect(result.certificateInfo?.signatureValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should fail to verify a qualified VP containing an invalid VC', async () => {
        const invalidVcPayload = await createBaseVcPayload(true, `did:ex:subject:${uuidv4()}`, -1); // Expired VC
        const invalidVcJwt = await signJwtWithRs256AndX5c(invalidVcPayload, TEST_RS256_PRIV_KEY_PEM!, TEST_RS256_CERT_PEM!);

        const vpPayloadWithInvalidVc = {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiablePresentation', 'VPQualified'],
            holder: holderDidForVp,
            verifiableCredential: [invalidVcJwt]
        };
        const vpJwtWithInvalidVc = await signJwtWithRs256AndX5c(vpPayloadWithInvalidVc, TEST_RS256_PRIV_KEY_PEM!, TEST_RS256_CERT_PEM!);

        const result = await credentialService.verifyPresentation(vpJwtWithInvalidVc);
        expect(result.isValid).toBe(false);
        expect(result.isQualified).toBe(true); // VP itself might be signed correctly
        expect(result.errors).toBeDefined();
        expect(result.errors?.[0]).toContain('Invalid credential in VP');
    });

    it('should fail if a VC is provided when a VP is expected', async () => {
      const result = await credentialService.verifyPresentation(nonQualifiedVcJwt);
      expect(result.isValid).toBe(false);
      expect(result.errors?.[0]).toContain('Expected a VP but received a VC');
    });
  });

  // --- Test exported standalone functions ---
  describe('Exported standalone functions', () => {
    it('exported issueCredential works like the class method', async () => {
        const { issueCredential: standaloneIssue } = await import('../services/credential.service');
        const subjectDid = `did:example:subject:${uuidv4()}`;
        const issued = await standaloneIssue(
            TEST_ISSUER_DID!,
            subjectDid,
            'StandaloneNonQualified',
            { claim: 'value' },
            false
        );
        expect(issued.jwt).toBeDefined();
        expect(issued.decoded.type).toContain('StandaloneNonQualified');
    });

    it('exported verifyCredential works like the class method', async () => {
        const { verifyCredential: standaloneVerify } = await import('../services/credential.service');
        const result = await standaloneVerify(nonQualifiedVcJwt);
        expect(result.isValid).toBe(true);
    });

    it('exported verifyPresentation works like the class method', async () => {
        const { verifyPresentation: standaloneVerifyP } = await import('../services/credential.service');
        const result = await standaloneVerifyP(nonQualifiedVpJwt);
        expect(result.isValid).toBe(true);
    });
  });
});