import express from 'express';
import { sessions } from '../server';
import { employeeVCService } from '../vc-types/employee/employee-vc';
import { graduationVCService } from '../vc-types/graduation/graduation-vc';

const router = express.Router();

// @ts-ignore
router.post('/request', async (req, res) => {
  try {
    const authToken = req.body?.sessionToken;

    if (!authToken) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid session token.'
      });
    }

    const session = sessions.get(authToken);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session token. Please login again.'
      });
    }

    if (session.expires < Date.now()) {
      sessions.delete(authToken);
      return res.status(401).json({
        success: false,
        message: 'Session has expired. Please login again.'
      });
    }

    const { type } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Type is required'
      });
    }

    if (type !== 'Employee' && type !== 'Graduation') {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Currently only "Employee" and "Graduation" types are supported.'
      });
    }

    session.expires = Date.now() + (24 * 60 * 60 * 1000);

    let result;

    if (type === 'Employee') {
      result = await employeeVCService.issueEmployeeCredentialFromVP(session.vp);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: result.message || 'Failed to issue employee credential'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Employee credential issued successfully',
        credential: result.credential
      });
    } else if (type === 'Graduation') {
      // Generate random data for graduation credential, but use the name from the VP
      result = await graduationVCService.generateRandomGraduationCredential(session.vp);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: result.message || 'Failed to issue graduation credential'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Graduation credential issued successfully',
        credential: result.credential
      });
    }
  } catch (error) {
    console.error('Error processing VC request:', error);
    return res.status(500).json({
      success: false,
      message: `Error processing request: ${error}`
    });
  }
});


export default router;
