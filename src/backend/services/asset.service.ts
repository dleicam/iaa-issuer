import { Asset, AssetAttributes, AssetModel } from '../db/database';

type AssetCreationAttributes = Omit<AssetAttributes, 'id'>;

export class AssetService {
  constructor() {
    // dependecies go here
  }

  /**
   * Creates a new asset.
   * @param data - Data for the new asset.
   * @returns The created asset instance.
   */
  public async createAsset(data: AssetCreationAttributes): Promise<AssetModel> {
    try {
      const newAsset = await Asset.create(data as AssetAttributes); // Cast as AssetAttributes for create
      console.log(`Asset created with ID: ${newAsset.id}`);
      return newAsset;
    } catch (error) {
      console.error('Error creating asset:', this.formatError(error));
      throw new Error('Failed to create asset.');
    }
  }

  /**
   * Retrieves an asset by its primary key (ID).
   * @param id - The UUID of the asset.
   * @returns The asset instance if found, otherwise null.
   */
  public async getAssetById(id: string): Promise<AssetModel | null> {
    try {
      const asset = await Asset.findByPk(id);
      return asset;
    } catch (error) {
      console.error(`Error fetching asset with ID ${id}:`, this.formatError(error));
      throw new Error('Failed to fetch asset by ID.');
    }
  }

  /**
   * Retrieves an asset by its DID.
   * @param did - The DID of the asset.
   * @returns The asset instance if found, otherwise null.
   */
  public async getAssetByDid(did: string): Promise<AssetModel | null> {
    try {
      const asset = await Asset.findOne({ where: { did } });
      return asset;
    } catch (error) {
      console.error(`Error fetching asset with DID ${did}:`, this.formatError(error));
      throw new Error('Failed to fetch asset by DID.');
    }
  }

  /**
   * Retrieves all assets, optionally filtering by asset type.
   * @param assetType - Optional filter for the asset type (e.g., 'HVAC', 'ROOM').
   * @returns An array of asset instances.
   */
  public async getAllAssets(assetType?: string): Promise<AssetModel[]> {
    try {
      const whereClause: Partial<AssetAttributes> = {};
      if (assetType) {
        whereClause.assetType = assetType;
      }
      const assets = await Asset.findAll({ where: whereClause });
      return assets;
    } catch (error) {
      console.error('Error fetching all assets:', this.formatError(error));
      throw new Error('Failed to fetch all assets.');
    }
  }

  /**
   * Updates an existing asset.
   * 'id' and 'did' are generally considered immutable or require special handling,
   * so they are omitted from the updatable fields here.
   * @param id - The ID of the asset to update.
   * @param data - An object containing the fields to update.
   * @returns The updated asset instance if found and updated, otherwise null.
   */
  public async updateAsset(id: string, data: Partial<Omit<AssetAttributes, 'id' | 'did'>>): Promise<AssetModel | null> {
    try {
      const asset = await Asset.findByPk(id);
      if (!asset) {
        console.warn(`Asset with ID ${id} not found for update.`);
        return null;
      }

      await asset.update(data);
      console.log(`Asset with ID ${id} updated.`);
      return asset.reload(); // reload to get the latest state from DB
    } catch (error) {
      console.error(`Error updating asset with ID ${id}:`, this.formatError(error));
      throw new Error('Failed to update asset.');
    }
  }

  /**
   * Updates or sets the Verifiable Credential (VC) for an asset.
   * @param id - The ID of the asset.
   * @param vcJwt - The JWT string of the Verifiable Credential.
   * @returns The updated asset instance if found, otherwise null.
   */
  public async setAssetVc(id: string, vcJwt: string): Promise<AssetModel | null> {
    try {
      const asset = await Asset.findByPk(id);
      if (!asset) {
        console.warn(`Asset with ID ${id} not found for setting VC.`);
        return null;
      }
      await asset.update({ vc: vcJwt });
      console.log(`VC set for asset with ID ${id}.`);
      return asset.reload();
    } catch (error) {
      console.error(`Error setting VC for asset with ID ${id}:`, this.formatError(error));
      throw new Error('Failed to set asset VC.');
    }
  }


  /**
   * Deletes an asset by its ID.
   * @param id - The ID of the asset to delete.
   * @returns True if the asset was deleted, false if the asset was not found.
   */
  public async deleteAsset(id: string): Promise<boolean> {
    try {
      const asset = await Asset.findByPk(id);
      if (!asset) {
        console.warn(`Asset with ID ${id} not found for deletion.`);
        return false;
      }
      await asset.destroy();
      console.log(`Asset with ID ${id} deleted.`);
      return true;
    } catch (error) {
      console.error(`Error deleting asset with ID ${id}:`, this.formatError(error));
      throw new Error('Failed to delete asset.');
    }
  }

  /**
   * Helper to format error messages for logging.
   * @param error - The error object.
   * @returns A string representation of the error message.
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      if ((error as any).errors && Array.isArray((error as any).errors)) {
        return (error as any).errors.map((e: any) => e.message).join(', ');
      }
      return error.message;
    }
    return String(error);
  }
}