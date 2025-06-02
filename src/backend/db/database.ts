// src/backend/db/database.ts
import { Sequelize, DataTypes, Model } from 'sequelize';
import path from 'path';
import fs from 'fs';

// Interfaces for type-safety
export interface UserAttributes {
  id: string;
  name: string;
  did: string;
  userType: 'admin' | 'technician';
  publicKey: string; 
}

export interface AssetAttributes {
  id: string;
  name: string;
  did: string;
  assetType: string; 
  vc?: string; // asset JWT
}

export interface WorkOrderAttributes {
  id: string;
  description: string;
  status: 'pending' | 'open' | 'in_progress' | 'completed' | 'cancelled';
  userId: string;
}

export interface WorkOrderAssetAttributes {
  id: string;
  workOrderId: string;
  assetId: string;
}

export interface CredentialAttributes {
  id: string;
  vcId: string; 
  credentialType: string; // 'type' from the VC, can be comma-separated or first type
  sub: string; // subject DID
  iss: string; // issuer DID
  nbf: Date; // not before / issuanceDate
  exp?: Date; // expirationDate, optional
  kid?: string; // key ID (VC header), optional
  isRevoked: boolean;
  revocationDate?: Date;
  revocationReason?: string;
}

export interface RevocationEntryAttributes {
  id: string;
  credentialId: string;
  revokeDate: Date;
  justification?: string;
}

export interface UserModel extends Model<UserAttributes>, UserAttributes {}
export interface AssetModel extends Model<AssetAttributes>, AssetAttributes {}
export interface WorkOrderModel extends Model<WorkOrderAttributes>, WorkOrderAttributes {}
export interface WorkOrderAssetModel extends Model<WorkOrderAssetAttributes>, WorkOrderAssetAttributes {}
export interface CredentialModel extends Model<CredentialAttributes>, CredentialAttributes {}
export interface RevocationEntryModel extends Model<RevocationEntryAttributes>, RevocationEntryAttributes {}


// Determine storage based on environment
const isTestEnvironment = process.env.NODE_ENV === 'test';
const DATABASE_PATH = isTestEnvironment ? ':memory:' : path.join(__dirname, '../../data', 'issuer.sqlite');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: DATABASE_PATH,
  logging: process.env.NODE_ENV === 'development' ? console.log : false, // Log SQL in dev
});

// Model definitions
export const User = sequelize.define<UserModel>('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  did: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  userType: { 
    type: DataTypes.ENUM('admin', 'technician'),
    allowNull: false,
  },
  publicKey: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

export const Asset = sequelize.define<AssetModel>('Asset', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  did: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  assetType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  vc: {
    type: DataTypes.TEXT, 
    allowNull: true, // Asset may not have a VC (initially)
  },
});

export const WorkOrder = sequelize.define<WorkOrderModel>('WorkOrder', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'open', 'in_progress', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
});

export const WorkOrderAsset = sequelize.define<WorkOrderAssetModel>('WorkOrderAsset', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  workOrderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: WorkOrder,
      key: 'id',
    },
  },
  assetId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Asset,
      key: 'id',
    },
  }
}, {
  // Ensure a work order cannot be linked to the same asset multiple times
  indexes: [{ unique: true, fields: ['workOrderId', 'assetId'] }]
});

export const Credential = sequelize.define<CredentialModel>('Credential', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  vcId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  credentialType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sub: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  iss: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  nbf: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  exp: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  kid: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isRevoked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  revocationDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  revocationReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
});

export const RevocationEntry = sequelize.define<RevocationEntryModel>('RevocationEntry', { // Renamed table from revocation_list
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  credentialId: { 
    type: DataTypes.UUID, 
    allowNull: false,
    references: {
      model: Credential,
      key: 'id',
    },
  },
  revokeDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  justification: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});


// Model associations
// User (Technician/Admin) and WorkOrder
User.hasMany(WorkOrder, { foreignKey: 'userId', as: 'workOrders' });
WorkOrder.belongsTo(User, { foreignKey: 'userId', as: 'user' }); // Changed 'technician' to 'user' for clarity

// WorkOrder and Asset (Many-to-Many)
WorkOrder.belongsToMany(Asset, {
  through: WorkOrderAsset,
  foreignKey: 'workOrderId',
  otherKey: 'assetId',
  as: 'assets',
  onDelete: 'CASCADE', // Add cascade delete
});
Asset.belongsToMany(WorkOrder, {
  through: WorkOrderAsset,
  foreignKey: 'assetId',
  otherKey: 'workOrderId',
  as: 'workOrders',
  onDelete: 'CASCADE', // Add cascade delete
});

// Credential and RevocationEntry (One-to-Many, though usually One-to-One logical for active revocation)
Credential.hasMany(RevocationEntry, { foreignKey: 'credentialId', as: 'revocationEntries', onDelete: 'CASCADE' });
RevocationEntry.belongsTo(Credential, { foreignKey: 'credentialId', as: 'credential' });


// DB initialization function
export async function initializeDatabase(): Promise<void> {
  try {
    if (!isTestEnvironment) {
      // Ensure the 'data' directory exists for non-test environments
      const dataDir = path.dirname(DATABASE_PATH as string);  // Cast to string to avoid TypeScript error
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`Created database directory: ${dataDir}`);
      }
    }

    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Sync all models. { alter: true } is suitable for development and testing.
    // For production, consider using migrations.
    await sequelize.sync({ alter: true });
    console.log('All models were synchronized successfully.');

  } catch (error) {
    console.error('Unable to connect to the database or sync models:', error);
    // Gracefully exit if DB initialization fails, critical for app startup
    process.exit(1);
  }
}

export default sequelize;
