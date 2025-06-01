import sequelize, {
  WorkOrder,
  WorkOrderAttributes,
  WorkOrderModel,
  WorkOrderAsset,
  Asset,
  User,
  WorkOrderAssetModel,
  WorkOrderAssetAttributes
} from '../db/database'; // Assuming these are exported from database.ts

export interface WorkOrderCreationAttributes extends Omit<WorkOrderAttributes, 'id'> {
  assetIds?: string[]; // Array of Asset IDs to associate with this Work Order
}

// Only specific fields are typically updatable, e.g., description, status.
export interface WorkOrderUpdateAttributes extends Partial<Pick<WorkOrderAttributes, 'description' | 'status'>> {
}


export class WorkOrderService {
  constructor() {
    // dependencies here
  }

  /**
   * Creates a new work order and associates it with specified assets.
   * Uses a transaction to ensure atomicity.
   * @param data - Data for the new work order, including optional assetIds.
   * @returns The created work order instance, potentially with associated assets if fetched again.
   */
  public async createWorkOrder(data: WorkOrderCreationAttributes): Promise<WorkOrderModel> {
    const transaction = await sequelize.transaction(); // Start a new transaction
    try {
      const { assetIds, ...workOrderDetails } = data;
      
      const newWorkOrder = await WorkOrder.create(workOrderDetails as WorkOrderAttributes, { transaction });

      // If assetIds are provided, create entries in the WorkOrderAsset junction table
      if (assetIds && assetIds.length > 0) {
        const workOrderAssetEntries = assetIds.map(assetId => ({
          workOrderId: newWorkOrder.id,
          assetId: assetId,
        }) as WorkOrderAssetAttributes);
        await WorkOrderAsset.bulkCreate(workOrderAssetEntries, { transaction });
      }

      await transaction.commit(); // Commit the transaction if all operations succeed
      console.log(`Work Order created with ID: ${newWorkOrder.id}`);

      // Optionally, fetch the WorkOrder again with its associations to return the full object
      // This is often useful if the client expects the nested data immediately.
      const fullWorkOrder = await this.getWorkOrderById(newWorkOrder.id, true);
      if (!fullWorkOrder) {
          // This should ideally not happen if creation was successful
          throw new Error('Failed to retrieve newly created work order with associations.');
      }
      return fullWorkOrder;

    } catch (error) {
      await transaction.rollback(); // Rollback the transaction if any operation fails
      console.error('Error creating work order:', this.formatError(error));
      throw new Error('Failed to create work order.');
    }
  }

  /**
   * Retrieves a work order by its primary key (ID).
   * Can optionally include associated User (Technician) and Assets.
   * @param id - The UUID of the work order.
   * @param includeAssociations - Boolean flag to include related User and Assets.
   * @returns The work order instance if found, otherwise null.
   */
  public async getWorkOrderById(id: string, includeAssociations: boolean = false): Promise<WorkOrderModel | null> {
    try {
      const findOptions: any = {}; // Use 'any' for findOptions to allow dynamic include
      if (includeAssociations) {
        findOptions.include = [
          {
            model: User,
            as: 'user', // Must match the 'as' alias in WorkOrder.belongsTo(User)
          },
          {
            model: Asset,
            as: 'assets', // Must match the 'as' alias in WorkOrder.belongsToMany(Asset)
            through: { attributes: [] }, // Exclude attributes from the junction table itself
          },
        ];
      }
      const workOrder = await WorkOrder.findByPk(id, findOptions);
      return workOrder;
    } catch (error) {
      console.error(`Error fetching work order with ID ${id}:`, this.formatError(error));
      throw new Error('Failed to fetch work order by ID.');
    }
  }

  /**
   * Retrieves all work orders.
   * Can optionally include associated User (Technician) and Assets.
   * @param includeAssociations - Boolean flag to include related User and Assets.
   * @param filterOptions - Optional filters (e.g., status, userId).
   * @returns An array of work order instances.
   */
  public async getAllWorkOrders(
    includeAssociations: boolean = false,
    filterOptions: Partial<Pick<WorkOrderAttributes, 'status' | 'userId'>> = {}
  ): Promise<WorkOrderModel[]> {
    try {
      const findOptions: any = { where: filterOptions };
      if (includeAssociations) {
        findOptions.include = [
          { model: User, as: 'user' },
          { model: Asset, as: 'assets', through: { attributes: [] } },
        ];
      }
      const workOrders = await WorkOrder.findAll(findOptions);
      return workOrders;
    } catch (error) {
      console.error('Error fetching all work orders:', this.formatError(error));
      throw new Error('Failed to fetch all work orders.');
    }
  }

  /**
   * Updates an existing work order's description or status.
   * @param id - The ID of the work order to update.
   * @param data - An object containing 'description' or 'status' to update.
   * @returns The updated work order instance if found and updated, otherwise null.
   */
  public async updateWorkOrder(id: string, data: WorkOrderUpdateAttributes): Promise<WorkOrderModel | null> {
    try {
      const workOrder = await WorkOrder.findByPk(id);
      if (!workOrder) {
        console.warn(`Work Order with ID ${id} not found for update.`);
        return null;
      }

      await workOrder.update(data);
      console.log(`Work Order with ID ${id} updated.`);
      return workOrder.reload({ // Reload to get potentially updated associations if they were part of update logic
        include: [
            { model: User, as: 'user' },
            { model: Asset, as: 'assets', through: { attributes: [] } }
        ]
      });
    } catch (error) {
      console.error(`Error updating work order with ID ${id}:`, this.formatError(error));
      throw new Error('Failed to update work order.');
    }
  }

  /**
   * Deletes a work order by its ID.
   * This will also delete associated entries in the WorkOrderAsset junction table
   * if `onDelete: 'CASCADE'` is set up for the foreign keys in WorkOrderAsset,
   * or if handled manually here.
   * @param id - The ID of the work order to delete.
   * @returns True if the work order was deleted, false if it was not found.
   */
  public async deleteWorkOrder(id: string): Promise<boolean> {
    const transaction = await sequelize.transaction();
    try {
      const workOrder = await WorkOrder.findByPk(id, { transaction });
      if (!workOrder) {
        await transaction.rollback();
        console.warn(`Work Order with ID ${id} not found for deletion.`);
        return false;
      }

      // Manually delete related WorkOrderAsset entries before deleting the WorkOrder
      // This is good practice if cascade delete isn't relied upon or for more control.
      await WorkOrderAsset.destroy({ where: { workOrderId: id }, transaction });

      await workOrder.destroy({ transaction }); // Delete the WorkOrder itself
      
      await transaction.commit();
      console.log(`Work Order with ID ${id} and its asset associations deleted.`);
      return true;
    } catch (error) {
      await transaction.rollback();
      console.error(`Error deleting work order with ID ${id}:`, this.formatError(error));
      throw new Error('Failed to delete work order.');
    }
  }

  // --- Methods for managing assets associated with a work order ---

  /**
   * Adds an asset to an existing work order.
   * @param workOrderId The ID of the work order.
   * @param assetId The ID of the asset to add.
   * @returns The WorkOrderAsset junction table entry if successful, null otherwise.
   */
  public async addAssetToWorkOrder(workOrderId: string, assetId: string): Promise<WorkOrderAssetModel | null> {
    try {
      // Check if WorkOrder and Asset exist
      const workOrderExists = await WorkOrder.findByPk(workOrderId);
      const assetExists = await Asset.findByPk(assetId);

      if (!workOrderExists || !assetExists) {
        console.warn('WorkOrder or Asset not found for association.');
        return null;
      }

      // Create the association in the junction table
      // findOrCreate can prevent duplicates if there's a unique constraint on (workOrderId, assetId)
      const [workOrderAsset, created] = await WorkOrderAsset.findOrCreate({
        where: { workOrderId, assetId },
      });

      if (created) {
        console.log(`Asset ${assetId} added to Work Order ${workOrderId}.`);
      } else {
        console.log(`Asset ${assetId} already associated with Work Order ${workOrderId}.`);
      }
      return workOrderAsset;
    } catch (error) {
      console.error(`Error adding asset ${assetId} to work order ${workOrderId}:`, this.formatError(error));
      throw new Error('Failed to add asset to work order.');
    }
  }

  /**
   * Removes an asset from an existing work order.
   * @param workOrderId The ID of the work order.
   * @param assetId The ID of the asset to remove.
   * @returns True if the association was removed, false otherwise (e.g., not found).
   */
  public async removeAssetFromWorkOrder(workOrderId: string, assetId: string): Promise<boolean> {
    try {
      const result = await WorkOrderAsset.destroy({
        where: { workOrderId, assetId }
      });
      
      if (result > 0) {
        console.log(`Asset ${assetId} removed from Work Order ${workOrderId}.`);
        return true;
      } else {
        console.warn(`Association between Work Order ${workOrderId} and Asset ${assetId} not found.`);
        return false;
      }
    } catch (error) {
      console.error(`Error removing asset ${assetId} from work order ${workOrderId}:`, this.formatError(error));
      throw new Error('Failed to remove asset from work order.');
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