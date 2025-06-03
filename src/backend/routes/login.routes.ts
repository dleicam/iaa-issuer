import express from 'express';
import * as vc from '@digitalbazaar/vc';
import { Ed25519Signature2020 } from '@digitalbazaar/ed25519-signature-2020';
import { DataIntegrityProof } from '@digitalbazaar/data-integrity';
import { getDocumentLoader } from '../utils/document-loader';
import * as jose from 'jose';
import crypto from 'crypto';

const router = express.Router();

/**
 * Extracts the VP data from a verification result
 * @param verificationResult - The verification result
 * @returns The presentation data or null if verification failed
 */
function extractVpData(verificationResult: any) {
  if (!verificationResult || !verificationResult.verified) {
    return null;
  }

  // Extract the VP data from the verification result
  const { presentation } = verificationResult;

  if (!presentation) {
    return null;
  }

  return presentation;
}

/**
 * Checks if a challenge is present in a VP
 * @param vp - The verifiable presentation
 * @param challenge - The challenge to check for
 * @returns Whether the challenge is present
 */
function isChallengePresent(vp: any, challenge: string): boolean {
  if (!vp || !challenge) {
    return false;
  }

  // Check for challenge in the VP
  if (vp.challenge === challenge || vp.nonce === challenge || vp.domain === challenge) {
    return true;
  }

  // Check in the credentials if not found at top level
  if (vp.verifiableCredential && Array.isArray(vp.verifiableCredential)) {
    for (const vc of vp.verifiableCredential) {
      if (vc.challenge === challenge || vc.nonce === challenge || vc.domain === challenge) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Verifies a verifiable presentation
 * @param presentation - The verifiable presentation to verify
 * @param challenge - The challenge that should be included in the presentation
 * @param unsignedPresentation - Whether to treat the presentation as unsigned (skip proof verification)
 * @param useDataIntegrity - Whether to use DataIntegrityProof for verification (for ECDSA)
 * @returns The verification result
 */
async function verifyPresentation(
  presentation: any, 
  challenge?: string, 
  unsignedPresentation?: boolean,
  useDataIntegrity?: boolean
) {
  try {
    let verifyingSuite;

    // Choose the appropriate verification suite based on the proof type or explicit parameter
    if (useDataIntegrity) {
      // Setup verification suite for DataIntegrityProof (used for ECDSA)
      verifyingSuite = new DataIntegrityProof();
      console.log('Using DataIntegrityProof for verification');
    } else {
      // Default to Ed25519Signature2020
      verifyingSuite = new Ed25519Signature2020();
      console.log('Using Ed25519Signature2020 for verification');
    }

    // Get the document loader
    const documentLoader = await getDocumentLoader();

    // Verify the presentation
    // If unsignedPresentation is explicitly set, use that value
    // Otherwise, if no challenge is provided, set unsignedPresentation to true to allow verification without a challenge
    const verificationResult = await vc.verify({
      presentation,
      challenge,
      suite: verifyingSuite,
      documentLoader,
      unsignedPresentation: unsignedPresentation !== undefined ? unsignedPresentation : !challenge
    });

    // Log verification result for debugging
    console.log('Verification result:', JSON.stringify(verificationResult, null, 2));

    // Check if verification was successful
    if (verificationResult.verified) {
      return verificationResult;
    }

    // If verification failed, try the other suite if not explicitly specified
    if (!verificationResult.verified && useDataIntegrity === undefined) {
      console.log('Verification failed with default suite, trying alternative suite...');
      return verifyPresentation(presentation, challenge, unsignedPresentation, !useDataIntegrity);
    }

    // If verification failed, log the error
    if (verificationResult.error) {
      console.error('Verification error:', verificationResult.error);
      if (verificationResult.error.errors && verificationResult.error.errors.length > 0) {
        console.error('Error details:', verificationResult.error.errors[0].stack);
      }
    }

    return verificationResult;
  } catch (error) {
    console.error('Error during verification:', error);
    throw error;
  }
}

const challenges = new Map<string, { challenge: string, expires: number }>();

const CHALLENGE_EXPIRATION = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, data] of challenges.entries()) {
    if (data.expires < now) {
      challenges.delete(id);
    }
  }
}, 60 * 1000);

router.get('/', (_req, res): Promise<void> => {
  try {
    const nonce = crypto.randomBytes(16).toString('hex');

    const challenge = `challenge-${nonce}`;

    const challengeId = crypto.randomBytes(8).toString('hex');

    challenges.set(challengeId, {
      challenge,
      expires: Date.now() + CHALLENGE_EXPIRATION
    });

    res.json({
      challengeId,
      challenge
    });

  } catch (error) {
    console.error('Error generating challenge:', error);
    res.status(500).json({
      error: 'Failed to generate challenge'
    });
  }


});

router.post('/', async (req, res) => {
  try {
    const { presentation, challengeId } = req.body;

    if (!presentation) {
      res.status(400).json({
        isAuthenticated: false,
        errors: ['No presentation provided']
      });
      return;
    }

    if (!challengeId) {
      res.status(400).json({
        isAuthenticated: false,
        errors: ['No challenge ID provided']
      });
      return;
    }

    // Check if the challenge exists and hasn't expired
    const challengeData = challenges.get(challengeId);
    if (!challengeData) {
      res.status(400).json({
        isAuthenticated: false,
        errors: ['Invalid or expired challenge']
      });
      return;
    }

    const { challenge } = challengeData;

    // Verify the presentation
    let verificationResult;
    let isValid = false;
    let vp;

    try {
      // Check if the presentation is a JWT (starts with 'ey')
      if (typeof presentation === 'string' && presentation.startsWith('ey')) {
        // Verify JWT presentation using the new verification utility
        verificationResult = await verifyPresentation(presentation, challenge);
        isValid = verificationResult && verificationResult.verified === true;

        if (isValid) {
          // Extract VP data from the verification result
          vp = extractVpData(verificationResult);

          // If we couldn't extract VP data from the verification result, try decoding the JWT
          if (!vp) {
            const decoded = jose.decodeJwt(presentation);
            vp = decoded.vp || {};
          }
        }
      } else {
        // For JSON format, we would need to implement verification
        // This is a simplified implementation
        console.warn('JSON format VPs are not fully supported yet');

        // Basic validation - check if the presentation has the required fields
        const jsonVP = typeof presentation === 'string' ? JSON.parse(presentation) : presentation;

        if (!jsonVP.type || !jsonVP.type.includes('VerifiablePresentation')) {
          throw new Error('Invalid presentation format: missing type');
        }

        if (!jsonVP.verifiableCredential || !Array.isArray(jsonVP.verifiableCredential)) {
          throw new Error('Invalid presentation format: missing or invalid verifiableCredential');
        }

        // For now, we'll consider it valid if it has the right structure
        // In a production environment, you would want to verify the JSON VP as well
        isValid = true;
        vp = jsonVP;
      }
    } catch (error) {
      console.error('Error verifying presentation:', error);
      res.status(400).json({
        isAuthenticated: false,
        errors: [error.message || 'Unknown verification error']
      });
      return;
    }

    // Check if the challenge is present in the VP using the helper function
    let challengePresent = false;

    if (isValid && vp) {
      challengePresent = isChallengePresent(vp, challenge);
    }

    if (!challengePresent) {
      res.status(400).json({
        isAuthenticated: false,
        errors: ['Challenge not present in the verifiable presentation']
      });
      return;
    }

    // If we get here, the VP is valid and contains the challenge
    // Delete the challenge as it's been used
    challenges.delete(challengeId);

    // Create a session token
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Set the authentication cookie
    res.cookie('auth_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict'
    });

    // Return success response
    res.json({
      isAuthenticated: true,
      message: 'Authentication successful'
    });
  } catch (error) {
    console.error('Unexpected error during authentication:', error);
    res.status(500).json({
      isAuthenticated: false,
      errors: ['Internal server error during authentication']
    });
  }
});

export default router;
