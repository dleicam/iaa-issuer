import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import sequelize, { User } from '../db/database';  // Import sequelize and User model
import { UserService } from '../services/user.service';  // Adjust path if necessary
import { v4 as uuidv4 } from 'uuid';  // For generating realistic UUIDs

describe('UserService', () => {
  let userService: UserService;

  beforeAll(async () => {
    // Initialize in-memory database as per project spec
    await sequelize.sync({ force: true });  // Creates tables and clears data
    userService = new UserService();
  });

  afterAll(async () => {
    await sequelize.close();  // Close connection after tests
  });

  beforeEach(async () => {
    // Ensure a clean slate for each test by truncating the User table
    await User.destroy({ where: {} });  // Delete all records
  });

  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        name: 'John Doe',
        did: 'did:example:123456789',
        userType: 'technician' as const,  // Use 'as const' for enum safety
        publicKey: '-----BEGIN PUBLIC KEY-----...',
      };

      const newUser = await userService.createUser(userData);
      
      expect(newUser).toBeDefined();
      expect(newUser.id).toBeDefined();  // Should be auto-generated UUID
      expect(newUser.name).toBe(userData.name);
      expect(newUser.did).toBe(userData.did);
      expect(newUser.userType).toBe(userData.userType);
      expect(newUser.publicKey).toBe(userData.publicKey);
    });

    it('should throw an error when required fields are missing', async () => {
      const invalidUserData = {
        // Missing 'name'
        did: 'did:example:123456789',
        userType: 'technician' as const,
        publicKey: '-----BEGIN PUBLIC KEY-----...',
      };

      await expect(userService.createUser(invalidUserData)).rejects.toThrow('Failed to create user.');
      // Verify no user was created
      const users = await User.findAll();
      expect(users.length).toBe(0);
    });

    it('should throw an error for duplicate DID', async () => {
      const userData = {
        name: 'John Doe',
        did: 'did:example:123456789',
        userType: 'technician' as const,
        publicKey: '-----BEGIN PUBLIC KEY-----...',
      };

      await userService.createUser(userData);  // First creation
      await expect(userService.createUser(userData)).rejects.toThrow('Failed to create user.');  // Duplicate DID
    });
  });

  describe('getUserById', () => {
    it('should retrieve a user by ID', async () => {
      const newUser = await userService.createUser({
        name: 'Jane Smith',
        did: 'did:example:987654321',
        userType: 'admin' as const,
        publicKey: '-----BEGIN PUBLIC KEY-----...',
      });

      const retrievedUser = await userService.getUserById(newUser.id);
      
      expect(retrievedUser).toBeDefined();
      expect(retrievedUser?.id).toBe(newUser.id);
      expect(retrievedUser?.name).toBe('Jane Smith');
    });

    it('should return null for non-existent user ID', async () => {
      const nonExistentId = uuidv4();  // Generate a random UUID
      const retrievedUser = await userService.getUserById(nonExistentId);
      
      expect(retrievedUser).toBeNull();
    });
  });

  describe('getUserByDid', () => {
    it('should retrieve a user by DID', async () => {
      const newUser = await userService.createUser({
        name: 'Alice Johnson',
        did: 'did:example:555555555',
        userType: 'technician' as const,
        publicKey: '-----BEGIN PUBLIC KEY-----...',
      });

      const retrievedUser = await userService.getUserByDid(newUser.did);
      
      expect(retrievedUser).toBeDefined();
      expect(retrievedUser?.did).toBe(newUser.did);
      expect(retrievedUser?.name).toBe('Alice Johnson');
    });

    it('should return null for non-existent DID', async () => {
      const retrievedUser = await userService.getUserByDid('did:example:nonexistent');
      
      expect(retrievedUser).toBeNull();
    });
  });

  describe('getAllUsers', () => {
    it('should retrieve all users without filter', async () => {
      await userService.createUser({
        name: 'User1',
        did: 'did:example:1',
        userType: 'technician' as const,
        publicKey: '-----BEGIN PUBLIC KEY-----...',
      });
      await userService.createUser({
        name: 'User2',
        did: 'did:example:2',
        userType: 'admin' as const,
        publicKey: '-----BEGIN PUBLIC KEY-----...',
      });

      const users = await userService.getAllUsers();
      
      expect(users.length).toBe(2);
    });

    it('should retrieve users with filter by userType', async () => {
      await userService.createUser({
        name: 'Tech User',
        did: 'did:example:3',
        userType: 'technician' as const,
        publicKey: '-----BEGIN PUBLIC KEY-----...',
      });
      await userService.createUser({
        name: 'Admin User',
        did: 'did:example:4',
        userType: 'admin' as const,
        publicKey: '-----BEGIN PUBLIC KEY-----...',
      });

      const technicians = await userService.getAllUsers('technician');
      
      expect(technicians.length).toBe(1);
      expect(technicians[0].userType).toBe('technician');
    });
  });

  describe('updateUser', () => {
    it('should update an existing user', async () => {
      const newUser = await userService.createUser({
        name: 'Bob Brown',
        did: 'did:example:666666',
        userType: 'technician' as const,
        publicKey: '-----BEGIN PUBLIC KEY-----...',
      });

      const updatedUser = await userService.updateUser(newUser.id, { name: 'Bob Brown Updated' });
      
      expect(updatedUser).toBeDefined();
      expect(updatedUser?.name).toBe('Bob Brown Updated');
      expect(updatedUser?.did).toBe('did:example:666666');  // DID should not change
    });

    it('should return null for non-existent user ID', async () => {
      const updatedUser = await userService.updateUser(uuidv4(), { name: 'Non Existent' });
      
      expect(updatedUser).toBeNull();
    });
  });

  describe('deleteUser', () => {
    it('should delete an existing user', async () => {
      const newUser = await userService.createUser({
        name: 'To Be Deleted',
        did: 'did:example:777777',
        userType: 'admin' as const,
        publicKey: '-----BEGIN PUBLIC KEY-----...',
      });

      const deleted = await userService.deleteUser(newUser.id);
      
      expect(deleted).toBe(true);
      const retrievedUser = await userService.getUserById(newUser.id);
      expect(retrievedUser).toBeNull();
    });

    it('should return false for non-existent user ID', async () => {
      const deleted = await userService.deleteUser(uuidv4());
      
      expect(deleted).toBe(false);
    });
  });
});
