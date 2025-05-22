import express from 'express';
import {
    verifyCredential,
    verifyPresentation,
} from '../services/credential.service';
import {CredentialService} from '../services/credential.service';

const router = express.Router();

router.post('/', async (req, res): Promise<void> => {
    try {
        const {credential} = req.body;

        if (!credential) {
            res.status(400).json({message: 'Credential is required'});
            return;
        }

        const credentialService = new CredentialService();
        const analysis = await credentialService.analyzeCredential(credential);

        let verificationResult;
        if (analysis.isVP) {
            verificationResult = await verifyPresentation(credential);
        } else {
            verificationResult = await verifyCredential(credential);
        }

        res.status(200).json({
            isValid: verificationResult.isValid,
            errors: verificationResult.errors,
            subject: verificationResult.subject,
            isQualified: verificationResult.isQualified,
            certificateInfo: verificationResult.certificateInfo,
            ...(verificationResult.issuedByUs !== undefined && {
                issuedByUs: verificationResult.issuedByUs,
            }),
        });
        return;
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({message: 'Server error during verification'});
        return;
    }
});

export default router;
