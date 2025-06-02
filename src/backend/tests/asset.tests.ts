import { Asset, AssetAttributes, AssetModel } from '../db/database';
import { AssetService } from '../services/asset.service';
import sequelize from '../db/database';  // For database cleanup and initialization

describe('AssetService Tests', () => {
  let assetService: AssetService;

  beforeAll(async () => {
    // Initialize the service and ensure the database is ready
    assetService = new AssetService();
    await sequelize.sync({ force: true });  // Reset the database for tests
  });

  beforeEach(async () => {
    // Clean up all assets before each test
    await Asset.destroy({ where: {}, truncate: true });  // Deletes all records and resets auto-increment if any
  });

  afterAll(async () => {
    await sequelize.close();  // Close the database connection after all tests
  });

  test('createAsset should create a new asset successfully', async () => {
    const testAsset: AssetAttributes = {
      name: 'Dummy HVAC',
      did: 'did:asset:dummy_hvac',
      assetType: 'TestAssetType',
      vc: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',  // Example JWT string
    };

    const createdAsset: AssetModel = await assetService.createAsset(testAsset);

    expect(createdAsset).toBeDefined();
    expect(createdAsset.id).toBeDefined();  // ID should be generated
    expect(createdAsset.name).toBe(testAsset.name);
    expect(createdAsset.did).toBe(testAsset.did);
    expect(createdAsset.assetType).toBe(testAsset.assetType);
    expect(createdAsset.vc).toBe(testAsset.vc);

    const allAssets: AssetModel[] = await Asset.findAll();
    expect(allAssets.length).toBe(1);
    expect(allAssets[0].id).toBe(createdAsset.id);
  });

  test('getAssetById should retrieve an asset by ID', async () => {
    const testAsset: AssetAttributes = {
      name: 'Dummy HVAC',
      did: 'did:asset:dummy_hvac',
      assetType: 'TestAssetType',
      vc: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    };

    const createdAsset: AssetModel = await Asset.create(testAsset);

    const foundAsset: AssetModel | null = await assetService.getAssetById(createdAsset.id);

    expect(foundAsset).toBeDefined();
    expect(foundAsset?.id).toBe(createdAsset.id);
    expect(foundAsset?.name).toBe(testAsset.name);
    expect(foundAsset?.did).toBe(testAsset.did);
  });

  test('getAssetById should return null for non-existent ID', async () => {
    const foundAsset: AssetModel | null = await assetService.getAssetById('non-existent-id');

    expect(foundAsset).toBeNull();
  });

  test('getAssetByDid should retrieve an asset by DID', async () => {
    const testAsset: AssetAttributes = {
      name: 'Dummy HVAC',
      did: 'did:asset:dummy_hvac',
      assetType: 'TestAssetType',
      vc: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    };

    const createdAsset: AssetModel = await Asset.create(testAsset);

    const foundAsset: AssetModel | null = await assetService.getAssetByDid('did:asset:dummy_hvac');

    expect(foundAsset).toBeDefined();
    expect(foundAsset?.id).toBe(createdAsset.id);
    expect(foundAsset?.name).toBe(testAsset.name);
  });

  test('getAssetByDid should return null for non-existent DID', async () => {
    const foundAsset: AssetModel | null = await assetService.getAssetByDid('did:non-existent');

    expect(foundAsset).toBeNull();
  });

  test('getAllAssets should retrieve all assets with optional filtering', async () => {
    const testAsset1: AssetAttributes = {
      name: 'Asset 1',
      did: 'did:asset:1',
      assetType: 'TypeA',
    };

    const testAsset2: AssetAttributes = {
      name: 'Asset 2',
      did: 'did:asset:2',
      assetType: 'TypeB',
    };

    await Asset.create(testAsset1);
    await Asset.create(testAsset2);

    const allAssets: AssetModel[] = await assetService.getAllAssets();
    expect(allAssets.length).toBe(2);

    const filteredAssets: AssetModel[] = await assetService.getAllAssets('TypeA');
    expect(filteredAssets.length).toBe(1);
    expect(filteredAssets[0].assetType).toBe('TypeA');
  });

  test('updateAsset should update an existing asset successfully', async () => {
    const testAsset: AssetAttributes = {
      name: 'Original Name',
      did: 'did:asset:update_test',
      assetType: 'OriginalType',
    };

    const createdAsset: AssetModel = await Asset.create(testAsset);

    const updateData: Partial<Omit<AssetAttributes, 'id' | 'did'>> = {
      name: 'Updated Name',
      assetType: 'UpdatedType',
    };

    const updatedAsset: AssetModel | null = await assetService.updateAsset(createdAsset.id, updateData);

    expect(updatedAsset).toBeDefined();
    expect(updatedAsset?.name).toBe('Updated Name');
    expect(updatedAsset?.assetType).toBe('UpdatedType');
    expect(updatedAsset?.did).toBe(testAsset.did);  // DID should not change
  });

  test('updateAsset should return null for non-existent ID', async () => {
    const updateData: Partial<Omit<AssetAttributes, 'id' | 'did'>> = {
      name: 'Non Existent Update',
    };

    const updatedAsset: AssetModel | null = await assetService.updateAsset('non-existent-id', updateData);

    expect(updatedAsset).toBeNull();
  });

  test('setAssetVc should set the VC for an existing asset', async () => {
    const testAsset: AssetAttributes = {
      name: 'Asset for VC',
      did: 'did:asset:vc_test',
      assetType: 'TypeVC',
    };

    const createdAsset: AssetModel = await Asset.create(testAsset);

    const updatedAsset: AssetModel | null = await assetService.setAssetVc(createdAsset.id, 'new_vc_jwt_string');

    expect(updatedAsset).toBeDefined();
    expect(updatedAsset?.vc).toBe('new_vc_jwt_string');
  });

  test('setAssetVc should return null for non-existent ID', async () => {
    const updatedAsset: AssetModel | null = await assetService.setAssetVc('non-existent-id', 'some_jwt');

    expect(updatedAsset).toBeNull();
  });

  test('deleteAsset should delete an existing asset successfully', async () => {
    const testAsset: AssetAttributes = {
      name: 'Asset to Delete',
      did: 'did:asset:delete_test',
      assetType: 'DeleteType',
    };

    const createdAsset: AssetModel = await Asset.create(testAsset);

    const deleted: boolean = await assetService.deleteAsset(createdAsset.id);

    expect(deleted).toBe(true);

    const foundAsset: AssetModel | null = await Asset.findByPk(createdAsset.id);
    expect(foundAsset).toBeNull();
  });

  test('deleteAsset should return false for non-existent ID', async () => {
    const deleted: boolean = await assetService.deleteAsset('non-existent-id');

    expect(deleted).toBe(false);
  });
});
