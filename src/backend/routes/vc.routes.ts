import express from 'express';
import { sessions } from '../server';

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

    if (type !== 'Employee') {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Currently only "Employee" type is supported.'
      });
    }

    session.expires = Date.now() + (24 * 60 * 60 * 1000);

    return res.status(200).json({
      success: true,
      message: 'Request received successfully',
      requestedType: type,
      userId: session.userId
    });
  } catch (error) {
    console.error('Error processing VC request:', error);
    return res.status(500).json({
      success: false,
      message: `Error processing request: ${error}`
    });
  }
});

export default router;
