import express from 'express';
import { VPVerification } from '../utils/vp-verification';

const router = express.Router();

// @ts-ignore
router.post('/', async (req, res) => {
  try {
    const { presentation: verifiablePresentation } = req.body;

    if (!verifiablePresentation) {
      return res.status(400).json({
        success: false,
        message: 'No verifiable presentation provided'
      });
    }

    const verificationResult = await VPVerification.verifyPresentation(verifiablePresentation, "abc123");

    return res.status(200).json({
      success: true,
      verified: verificationResult.verified,
      verificationResult: verificationResult
    });
  } catch (error) {
    console.error('Error verifying presentation:', error);
    return res.status(500).json({
      success: false,
      message: `Error verifying presentation: ${error}`
    });
  }
});

export default router;
