// src/backend/routes/user.routes.ts
import express, { Request, Response } from 'express';
import { UserService } from '../services/user.service'; // Assuming user.service.ts exists
import { UserAttributes } from '../db/database'; // For request body typing

const router = express.Router();
const userService = new UserService();

// IMPORTANT: All routes in this file manage sensitive user/technician data.
// Authentication middleware SHOULD be applied to protect these endpoints.
// Example (to be added in server.ts or here): router.use(authMiddleware);

// Corresponds to PDF A.2 POST /technician (assuming 'technician' type user)
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    // Basic validation: ensure necessary fields for a technician are present
    const { name, did, publicKey, userType } = req.body;
    if (!name || !did || !publicKey || (userType !== 'admin' && userType !== 'technician')) {
      return res.status(400).json({ message: 'Missing or invalid required fields for user creation (name, did, publicKey, userType: admin|technician).' });
    }
    const newUser = await userService.createUser(req.body as Omit<UserAttributes, 'id'>);
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error during user creation.' });
  }
});

// Corresponds to PDF A.2 GET /technician
router.get('/', async (req: Request, res: Response) => {
  try {
    const userType = req.query.userType as 'admin' | 'technician' | undefined;
    const users = await userService.getAllUsers(userType);
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error while fetching users.' });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: `User with ID ${id} not found.` });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error(`Error fetching user ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error while fetching user.' });
  }
});

router.patch('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    // Ensure 'id' and 'did' are not in req.body for update, as they are immutable or handled separately
    const { id: bodyId, did: bodyDid, ...updateData } = req.body;

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No update data provided.' });
    }

    const updatedUser = await userService.updateUser(id, updateData);
    if (!updatedUser) {
      return res.status(404).json({ message: `User with ID ${id} not found or no changes made.` });
    }
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error(`Error updating user ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error during user update.' });
  }
});

// Corresponds to PDF A.2 DELETE /technician/{id}
router.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const success = await userService.deleteUser(id);
    if (!success) {
      return res.status(404).json({ message: `User with ID ${id} not found.` });
    }
    res.status(200).json({ message: `User with ID ${id} deleted successfully.` });
  } catch (error) {
    console.error(`Error deleting user ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error during user deletion.' });
  }
});

export default router;