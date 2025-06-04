import express from 'express';
import crypto from 'crypto';
import { VPVerification } from '../utils/vp-verification';
import { sessions, SESSION_EXPIRATION } from '../server';

const router = express.Router();

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

// @ts-ignore
router.get('/', (_req, res): Promise<void> => {
  try {
    const nonce = crypto.randomBytes(16).toString('hex');
    const challenge = `challenge-${nonce}`;
    const challengeId = crypto.randomBytes(8).toString('hex');

    challenges.set(challengeId, {
      challenge,
      expires: Date.now() + CHALLENGE_EXPIRATION
    });

    res.json({challengeId, challenge});

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

    const challengeData = challenges.get(challengeId);
    if (!challengeData) {
      res.status(400).json({
        isAuthenticated: false,
        errors: ['Invalid or expired challenge']
      });
      return;
    }

    const { challenge } = challengeData;

    let verificationResult;
    let isValid = false;
    let vp;

    try {
      verificationResult = await VPVerification.verifyPresentation(presentation, challenge);
      isValid = verificationResult && verificationResult.verified === true;

      if (isValid) {
        vp = VPVerification.extractVpData(verificationResult);
      } else {
        throw new Error('Presentation verification failed');
      }
    } catch (error) {
      console.error('Error verifying presentation:', error);
      res.status(400).json({
        isAuthenticated: false,
        errors: [error || 'Unknown verification error']
      });
      return;
    }

    challenges.delete(challengeId);

    const sessionToken = crypto.randomBytes(32).toString('hex');

    let userId = 'anonymous';
    if (vp && vp.verifiableCredential && vp.verifiableCredential.length > 0) {
      const credential = vp.verifiableCredential[0];
      if (credential.credentialSubject && credential.credentialSubject.id) {
        userId = credential.credentialSubject.id;
      }
    }

    sessions.set(sessionToken, {
      userId,
      expires: Date.now() + SESSION_EXPIRATION,
      vp: verificationResult.originalPresentation || vp
    });

    res.json({
      isAuthenticated: true,
      message: 'Authentication successful',
      sessionToken
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
