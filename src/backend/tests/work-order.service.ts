import { describe, beforeAll, beforeEach, afterAll, test, expect } from 'vitest';
import sequelize, { WorkOrder, Asset, User, WorkOrderAttributes, AssetAttributes, UserAttributes } from '../db/database';
import { WorkOrderService } from '../services/work-order.service';

describe('WorkOrderService Tests', () => {
  let workOrderService: WorkOrderService;

  beforeAll(async () => {
    workOrderService = new WorkOrderService();
    await sequelize.sync({ force: true });  // Reset database for tests
  });

  beforeEach(async () => {
    // Clean up before each test
    await WorkOrder.destroy({ where: {}, truncate: true });
    await Asset.destroy({ where: {}, truncate: true });
    await User.destroy({ where: {}, truncate: true });
  });

  afterAll(async () => {
    await sequelize.close();  // Close database connection
  });

  test('createWorkOrder should create a new work order successfully with assets', async () => {
    // Create dummy user and assets first
    const dummyUser: UserAttributes = {
      id: 'user-123',
      name: 'Test Technician',
      did: 'did:user:test_tech',
      userType: 'technician',
      publicKey: 'test_public_key',
    };
    const createdUser = await User.create(dummyUser);

    const dummyAsset1: AssetAttributes = {
      id: 'asset-456',
      name: 'Dummy HVAC',
      did: 'did:asset:dummy_hvac',
      assetType: 'HVAC',
    };
    const dummyAsset2: AssetAttributes = {
      id: 'asset-789',
      name: 'Dummy Room',
      did: 'did:asset:dummy_room',
      assetType: 'ROOM',
    };
    await Asset.create(dummyAsset1);
    await Asset.create(dummyAsset2);

    const workOrderData: WorkOrderAttributes = {
      id: 'wo-001',
      description: 'Install HVAC unit',
      status: 'pending',
      userId: createdUser.id,
      assetIds: ['asset-456', 'asset-789'],  // As per WorkOrderCreationAttributes
    };

    const createdWorkOrder = await workOrderService.createWorkOrder(workOrderData);

    expect(createdWorkOrder).toBeDefined();
    expect(createdWorkOrder.id).toBe('wo-001');
    expect(createdWorkOrder.description).toBe('Install HVAC unit');
    expect(createdWorkOrder.status).toBe('pending');
    expect(createdWorkOrder.userId).toBe(createdUser.id);

    // Verify associations
    const workOrderWithAssociations = await workOrderService.getWorkOrderById('wo-001', true);
    expect(workOrderWithAssociations?.assets).toHaveLength(2);
    expect(workOrderWithAssociations?.assets[0].id).toBe('asset-456');
    expect(workOrderWithAssociations?.assets[1].id).toBe('asset-789');
  });

  test('createWorkOrder should fail if userId does not exist', async () => {
    const invalidWorkOrderData: WorkOrderAttributes = {
      id: 'wo-002',
      description: 'Invalid user test',
      status: 'pending',
      userId: 'non-existent-user-id',
    };

    await expect(workOrderService.createWorkOrder(invalidWorkOrderData)).rejects.toThrow('Failed to create work order.');
  });

  test('createWorkOrder should handle transaction rollback on error', async () => {
    const dummyUser: UserAttributes = {
      id: 'user-124',
      name: 'Test Technician',
      did: 'did:user:test_tech2',
      userType: 'technician',
      publicKey: 'test_public_key2',
    };
    await User.create(dummyUser);

    const workOrderDataWithInvalidAsset: WorkOrderAttributes = {
      id: 'wo-003',
      description: 'Test with invalid asset',
      status: 'pending',
      userId: 'user-124',
      assetIds: ['non-existent-asset-id'],  // This should cause an error in association
    };

    await expect(workOrderService.createWorkOrder(workOrderDataWithInvalidAsset)).rejects.toThrow('Failed to create work order.');

    const workOrders = await WorkOrder.findAll();
    expect(workOrders).toHaveLength(0);  // No work order should be created due to rollback
  });

  test('getWorkOrderById should retrieve a work order successfully with associations', async () => {
    const dummyUser: UserAttributes = {
      id: 'user-125',
      name: 'Test Technician',
      did: 'did:user:test_tech3',
      userType: 'technician',
      publicKey: 'test_public_key3',
    };
    const createdUser = await User.create(dummyUser);

    const dummyAsset: AssetAttributes = {
      id: 'asset-101',
      name: 'Dummy Asset',
      did: 'did:asset:dummy_asset',
      assetType: 'HVAC',
    };
    await Asset.create(dummyAsset);

    const workOrderData: WorkOrderAttributes = {
      id: 'wo-004',
      description: 'Test work order',
      status: 'pending',
      userId: createdUser.id,
    };
    const createdWorkOrder = await WorkOrder.create(workOrderData);

    // Manually add association for testing
    await workOrderService.addAssetToWorkOrder(createdWorkOrder.id, dummyAsset.id);

    const foundWorkOrder = await workOrderService.getWorkOrderById('wo-004', true);

    expect(foundWorkOrder).toBeDefined();
    expect(foundWorkOrder?.id).toBe('wo-004');
    expect(foundWorkOrder?.user?.id).toBe(createdUser.id);
    expect(foundWorkOrder?.assets).toHaveLength(1);
    expect(foundWorkOrder?.assets[0].id).toBe(dummyAsset.id);
  });

  test('getWorkOrderById should return null for non-existent ID', async () => {
    const foundWorkOrder = await workOrderService.getWorkOrderById('non-existent-id');
    expect(foundWorkOrder).toBeNull();
  });

  test('getAllWorkOrders should retrieve all work orders with filters and associations', async () => {
    const dummyUser1: UserAttributes = {
      id: 'user-126',
      name: 'Tech 1',
      did: 'did:user:tech1',
      userType: 'technician',
      publicKey: 'key1',
    };
    await User.create(dummyUser1);

    const dummyUser2: UserAttributes = {
      id: 'user-127',
      name: 'Tech 2',
      did: 'did:user:tech2',
      userType: 'technician',
      publicKey: 'key2',
    };
    await User.create(dummyUser2);

    await WorkOrder.create({ id: 'wo-005', description: 'Order 1', status: 'pending', userId: dummyUser1.id });
    await WorkOrder.create({ id: 'wo-006', description: 'Order 2', status: 'open', userId: dummyUser2.id });

    const allWorkOrders = await workOrderService.getAllWorkOrders(true, { status: 'pending' });
    expect(allWorkOrders).toHaveLength(1);
    expect(allWorkOrders[0].status).toBe('pending');
    expect(allWorkOrders[0].user?.id).toBe(dummyUser1.id);
  });

  test('updateWorkOrder should update an existing work order successfully', async () => {
    const dummyUser: UserAttributes = {
      id: 'user-128',
      name: 'Test User',
      did: 'did:user:test_user',
      userType: 'technician',
      publicKey: 'test_key',
    };
    await User.create(dummyUser);

    const workOrderData: WorkOrderAttributes = {
      id: 'wo-007',
      description: 'Original description',
      status: 'pending',
      userId: dummyUser.id,
    };
    await WorkOrder.create(workOrderData);

    const updatedWorkOrder = await workOrderService.updateWorkOrder('wo-007', { description: 'Updated description', status: 'open' });

    expect(updatedWorkOrder).toBeDefined();
    expect(updatedWorkOrder?.description).toBe('Updated description');
    expect(updatedWorkOrder?.status).toBe('open');
  });

  test('updateWorkOrder should return null for non-existent ID', async () => {
    const updatedWorkOrder = await workOrderService.updateWorkOrder('non-existent-id', { description: 'Update test' });
    expect(updatedWorkOrder).toBeNull();
  });

  test('deleteWorkOrder should delete a work order and its associations successfully', async () => {
    const dummyUser: UserAttributes = {
      id: 'user-129',
      name: 'Test User',
      did: 'did:user:test_user2',
      userType: 'technician',
      publicKey: 'test_key2',
    };
    await User.create(dummyUser);

    const dummyAsset: AssetAttributes = {
      id: 'asset-102',
      name: 'Test Asset',
      did: 'did:asset:test_asset',
      assetType: 'HVAC',
    };
    await Asset.create(dummyAsset);

    const workOrderData: WorkOrderAttributes = {
      id: 'wo-008',
      description: 'To be deleted',
      status: 'pending',
      userId: dummyUser.id,
    };
    const createdWorkOrder = await WorkOrder.create(workOrderData);
    await workOrderService.addAssetToWorkOrder(createdWorkOrder.id, dummyAsset.id);

    const deleted = await workOrderService.deleteWorkOrder('wo-008');
    expect(deleted).toBe(true);

    const foundWorkOrder = await WorkOrder.findByPk('wo-008');
    expect(foundWorkOrder).toBeNull();

    const associations = await WorkOrderAsset.findAll({ where: { workOrderId: 'wo-008' } });
    expect(associations).toHaveLength(0);
  });

  test('deleteWorkOrder should return false for non-existent ID', async () => {
    const deleted = await workOrderService.deleteWorkOrder('non-existent-id');
    expect(deleted).toBe(false);
  });

  test('addAssetToWorkOrder should add an asset successfully', async () => {
    const dummyWorkOrder: WorkOrderAttributes = {
      id: 'wo-009',
      description: 'Test order',
      status: 'pending',
      userId: 'user-130',  // Assume this user exists or create it
    };
    await WorkOrder.create(dummyWorkOrder);

    const dummyAsset: AssetAttributes = {
      id: 'asset-103',
      name: 'New Asset',
      did: 'did:asset:new_asset',
      assetType: 'ROOM',
    };
    await Asset.create(dummyAsset);

    const addedAssociation = await workOrderService.addAssetToWorkOrder('wo-009', 'asset-103');
    expect(addedAssociation).toBeDefined();
    expect(addedAssociation.workOrderId).toBe('wo-009');
    expect(addedAssociation.assetId).toBe('asset-103');
  });

  test('addAssetToWorkOrder should return null if work order or asset does not exist', async () => {
    const addedAssociation = await workOrderService.addAssetToWorkOrder('non-existent-wo-id', 'asset-103');
    expect(addedAssociation).toBeNull();
  });

  test('removeAssetFromWorkOrder should remove an asset successfully', async () => {
    const dummyWorkOrder: WorkOrderAttributes = {
      id: 'wo-010',
      description: 'Test order',
      status: 'pending',
      userId: 'user-131',
    };
    await WorkOrder.create(dummyWorkOrder);

    const dummyAsset: AssetAttributes = {
      id: 'asset-104',
      name: 'Asset to remove',
      did: 'did:asset:remove_asset',
      assetType: 'HVAC',
    };
    await Asset.create(dummyAsset);
    await workOrderService.addAssetToWorkOrder('wo-010', 'asset-104');

    const removed = await workOrderService.removeAssetFromWorkOrder('wo-010', 'asset-104');
    expect(removed).toBe(true);

    const associations = await WorkOrderAsset.findAll({ where: { workOrderId: 'wo-010', assetId: 'asset-104' } });
    expect(associations).toHaveLength(0);
  });

  test('removeAssetFromWorkOrder should return false if association does not exist', async () => {
    const removed = await workOrderService.removeAssetFromWorkOrder('wo-010', 'non-existent-asset-id');
    expect(removed).toBe(false);
  });
});
