import { z } from 'zod';
export declare const PaginationQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    sortBy?: string | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export declare const IdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type IdParam = z.infer<typeof IdParamSchema>;
export declare const RegisterSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
}, {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
}>;
export type RegisterDTO = z.infer<typeof RegisterSchema>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginDTO = z.infer<typeof LoginSchema>;
export declare const CreateFirstAdminSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
}, {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
}>;
export type CreateFirstAdminDTO = z.infer<typeof CreateFirstAdminSchema>;
export declare const NetworkAddressTypeSchema: z.ZodEnum<["ipv4", "ipv6", "cidr", "hostname"]>;
export declare const NetworkAddressCreateSchema: z.ZodObject<{
    address: z.ZodString;
    type: z.ZodDefault<z.ZodEnum<["ipv4", "ipv6", "cidr", "hostname"]>>;
    primary: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "ipv4" | "ipv6" | "cidr" | "hostname";
    address: string;
    primary: boolean;
}, {
    address: string;
    type?: "ipv4" | "ipv6" | "cidr" | "hostname" | undefined;
    primary?: boolean | undefined;
}>;
export type NetworkAddressCreateDTO = z.infer<typeof NetworkAddressCreateSchema>;
export declare const CreateAssetSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    assetTypeId: z.ZodString;
    subType: z.ZodOptional<z.ZodString>;
    manufacturer: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    serialNumber: z.ZodOptional<z.ZodString>;
    externalId: z.ZodOptional<z.ZodString>;
    organizationUnitId: z.ZodOptional<z.ZodString>;
    locationId: z.ZodOptional<z.ZodString>;
    technicalOperatorId: z.ZodOptional<z.ZodString>;
    businessOwnerId: z.ZodOptional<z.ZodString>;
    informationSecurityResponsibleId: z.ZodOptional<z.ZodString>;
    processIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    serviceIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    contractIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    licenseIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    licenseInfo: z.ZodOptional<z.ZodString>;
    contractEndsAt: z.ZodOptional<z.ZodDate>;
    licenseExpiresAt: z.ZodOptional<z.ZodDate>;
    personnelSafetyRelevance: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
    regulatoryRelevance: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
    financialDamagePotential: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
    productionDowntimeImpact: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
    lifecycleStatus: z.ZodDefault<z.ZodEnum<["planned", "ordered", "in_stock", "active", "maintenance", "isolated", "decommissioned", "disposed", "destroyed", "lost", "unknown"]>>;
    purchaseDate: z.ZodOptional<z.ZodDate>;
    commissioningDate: z.ZodOptional<z.ZodDate>;
    endOfSaleDate: z.ZodOptional<z.ZodDate>;
    endOfLifeDate: z.ZodOptional<z.ZodDate>;
    endOfSupportDate: z.ZodOptional<z.ZodDate>;
    confidentialityNeed: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
    integrityNeed: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
    availabilityNeed: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
    dataProtectionRelevance: z.ZodDefault<z.ZodBoolean>;
    criticality: z.ZodDefault<z.ZodEnum<["low", "medium", "high", "critical"]>>;
    complianceRelevance: z.ZodDefault<z.ZodBoolean>;
    networkAddresses: z.ZodOptional<z.ZodArray<z.ZodObject<{
        address: z.ZodString;
        type: z.ZodDefault<z.ZodEnum<["ipv4", "ipv6", "cidr", "hostname"]>>;
        primary: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        type: "ipv4" | "ipv6" | "cidr" | "hostname";
        address: string;
        primary: boolean;
    }, {
        address: string;
        type?: "ipv4" | "ipv6" | "cidr" | "hostname" | undefined;
        primary?: boolean | undefined;
    }>, "many">>;
    dataSource: z.ZodOptional<z.ZodString>;
    lastDetectedAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    name: string;
    assetTypeId: string;
    personnelSafetyRelevance: "low" | "high" | "medium";
    regulatoryRelevance: "low" | "high" | "medium";
    financialDamagePotential: "low" | "high" | "medium";
    productionDowntimeImpact: "low" | "high" | "medium";
    lifecycleStatus: "planned" | "ordered" | "in_stock" | "active" | "maintenance" | "isolated" | "decommissioned" | "disposed" | "destroyed" | "lost" | "unknown";
    confidentialityNeed: "low" | "high" | "medium";
    integrityNeed: "low" | "high" | "medium";
    availabilityNeed: "low" | "high" | "medium";
    dataProtectionRelevance: boolean;
    criticality: "low" | "critical" | "high" | "medium";
    complianceRelevance: boolean;
    organizationUnitId?: string | undefined;
    model?: string | undefined;
    description?: string | undefined;
    subType?: string | undefined;
    manufacturer?: string | undefined;
    serialNumber?: string | undefined;
    externalId?: string | undefined;
    locationId?: string | undefined;
    technicalOperatorId?: string | undefined;
    businessOwnerId?: string | undefined;
    informationSecurityResponsibleId?: string | undefined;
    processIds?: string[] | undefined;
    serviceIds?: string[] | undefined;
    contractIds?: string[] | undefined;
    licenseIds?: string[] | undefined;
    licenseInfo?: string | undefined;
    contractEndsAt?: Date | undefined;
    licenseExpiresAt?: Date | undefined;
    purchaseDate?: Date | undefined;
    commissioningDate?: Date | undefined;
    endOfSaleDate?: Date | undefined;
    endOfLifeDate?: Date | undefined;
    endOfSupportDate?: Date | undefined;
    networkAddresses?: {
        type: "ipv4" | "ipv6" | "cidr" | "hostname";
        address: string;
        primary: boolean;
    }[] | undefined;
    dataSource?: string | undefined;
    lastDetectedAt?: Date | undefined;
}, {
    name: string;
    assetTypeId: string;
    organizationUnitId?: string | undefined;
    model?: string | undefined;
    description?: string | undefined;
    subType?: string | undefined;
    manufacturer?: string | undefined;
    serialNumber?: string | undefined;
    externalId?: string | undefined;
    locationId?: string | undefined;
    technicalOperatorId?: string | undefined;
    businessOwnerId?: string | undefined;
    informationSecurityResponsibleId?: string | undefined;
    processIds?: string[] | undefined;
    serviceIds?: string[] | undefined;
    contractIds?: string[] | undefined;
    licenseIds?: string[] | undefined;
    licenseInfo?: string | undefined;
    contractEndsAt?: Date | undefined;
    licenseExpiresAt?: Date | undefined;
    personnelSafetyRelevance?: "low" | "high" | "medium" | undefined;
    regulatoryRelevance?: "low" | "high" | "medium" | undefined;
    financialDamagePotential?: "low" | "high" | "medium" | undefined;
    productionDowntimeImpact?: "low" | "high" | "medium" | undefined;
    lifecycleStatus?: "planned" | "ordered" | "in_stock" | "active" | "maintenance" | "isolated" | "decommissioned" | "disposed" | "destroyed" | "lost" | "unknown" | undefined;
    purchaseDate?: Date | undefined;
    commissioningDate?: Date | undefined;
    endOfSaleDate?: Date | undefined;
    endOfLifeDate?: Date | undefined;
    endOfSupportDate?: Date | undefined;
    confidentialityNeed?: "low" | "high" | "medium" | undefined;
    integrityNeed?: "low" | "high" | "medium" | undefined;
    availabilityNeed?: "low" | "high" | "medium" | undefined;
    dataProtectionRelevance?: boolean | undefined;
    criticality?: "low" | "critical" | "high" | "medium" | undefined;
    complianceRelevance?: boolean | undefined;
    networkAddresses?: {
        address: string;
        type?: "ipv4" | "ipv6" | "cidr" | "hostname" | undefined;
        primary?: boolean | undefined;
    }[] | undefined;
    dataSource?: string | undefined;
    lastDetectedAt?: Date | undefined;
}>;
export type CreateAssetDTO = z.infer<typeof CreateAssetSchema>;
export declare const UpdateAssetSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    assetTypeId: z.ZodOptional<z.ZodString>;
    subType: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    manufacturer: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    model: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    serialNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    externalId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    organizationUnitId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    locationId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    technicalOperatorId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    businessOwnerId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    informationSecurityResponsibleId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    processIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    serviceIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    contractIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    licenseIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    licenseInfo: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    contractEndsAt: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    licenseExpiresAt: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    personnelSafetyRelevance: z.ZodOptional<z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>>;
    regulatoryRelevance: z.ZodOptional<z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>>;
    financialDamagePotential: z.ZodOptional<z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>>;
    productionDowntimeImpact: z.ZodOptional<z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>>;
    lifecycleStatus: z.ZodOptional<z.ZodDefault<z.ZodEnum<["planned", "ordered", "in_stock", "active", "maintenance", "isolated", "decommissioned", "disposed", "destroyed", "lost", "unknown"]>>>;
    purchaseDate: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    commissioningDate: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    endOfSaleDate: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    endOfLifeDate: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    endOfSupportDate: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    confidentialityNeed: z.ZodOptional<z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>>;
    integrityNeed: z.ZodOptional<z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>>;
    availabilityNeed: z.ZodOptional<z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>>;
    dataProtectionRelevance: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    criticality: z.ZodOptional<z.ZodDefault<z.ZodEnum<["low", "medium", "high", "critical"]>>>;
    complianceRelevance: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    networkAddresses: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        address: z.ZodString;
        type: z.ZodDefault<z.ZodEnum<["ipv4", "ipv6", "cidr", "hostname"]>>;
        primary: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        type: "ipv4" | "ipv6" | "cidr" | "hostname";
        address: string;
        primary: boolean;
    }, {
        address: string;
        type?: "ipv4" | "ipv6" | "cidr" | "hostname" | undefined;
        primary?: boolean | undefined;
    }>, "many">>>;
    dataSource: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    lastDetectedAt: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    organizationUnitId?: string | undefined;
    model?: string | undefined;
    description?: string | undefined;
    assetTypeId?: string | undefined;
    subType?: string | undefined;
    manufacturer?: string | undefined;
    serialNumber?: string | undefined;
    externalId?: string | undefined;
    locationId?: string | undefined;
    technicalOperatorId?: string | undefined;
    businessOwnerId?: string | undefined;
    informationSecurityResponsibleId?: string | undefined;
    processIds?: string[] | undefined;
    serviceIds?: string[] | undefined;
    contractIds?: string[] | undefined;
    licenseIds?: string[] | undefined;
    licenseInfo?: string | undefined;
    contractEndsAt?: Date | undefined;
    licenseExpiresAt?: Date | undefined;
    personnelSafetyRelevance?: "low" | "high" | "medium" | undefined;
    regulatoryRelevance?: "low" | "high" | "medium" | undefined;
    financialDamagePotential?: "low" | "high" | "medium" | undefined;
    productionDowntimeImpact?: "low" | "high" | "medium" | undefined;
    lifecycleStatus?: "planned" | "ordered" | "in_stock" | "active" | "maintenance" | "isolated" | "decommissioned" | "disposed" | "destroyed" | "lost" | "unknown" | undefined;
    purchaseDate?: Date | undefined;
    commissioningDate?: Date | undefined;
    endOfSaleDate?: Date | undefined;
    endOfLifeDate?: Date | undefined;
    endOfSupportDate?: Date | undefined;
    confidentialityNeed?: "low" | "high" | "medium" | undefined;
    integrityNeed?: "low" | "high" | "medium" | undefined;
    availabilityNeed?: "low" | "high" | "medium" | undefined;
    dataProtectionRelevance?: boolean | undefined;
    criticality?: "low" | "critical" | "high" | "medium" | undefined;
    complianceRelevance?: boolean | undefined;
    networkAddresses?: {
        type: "ipv4" | "ipv6" | "cidr" | "hostname";
        address: string;
        primary: boolean;
    }[] | undefined;
    dataSource?: string | undefined;
    lastDetectedAt?: Date | undefined;
}, {
    name?: string | undefined;
    organizationUnitId?: string | undefined;
    model?: string | undefined;
    description?: string | undefined;
    assetTypeId?: string | undefined;
    subType?: string | undefined;
    manufacturer?: string | undefined;
    serialNumber?: string | undefined;
    externalId?: string | undefined;
    locationId?: string | undefined;
    technicalOperatorId?: string | undefined;
    businessOwnerId?: string | undefined;
    informationSecurityResponsibleId?: string | undefined;
    processIds?: string[] | undefined;
    serviceIds?: string[] | undefined;
    contractIds?: string[] | undefined;
    licenseIds?: string[] | undefined;
    licenseInfo?: string | undefined;
    contractEndsAt?: Date | undefined;
    licenseExpiresAt?: Date | undefined;
    personnelSafetyRelevance?: "low" | "high" | "medium" | undefined;
    regulatoryRelevance?: "low" | "high" | "medium" | undefined;
    financialDamagePotential?: "low" | "high" | "medium" | undefined;
    productionDowntimeImpact?: "low" | "high" | "medium" | undefined;
    lifecycleStatus?: "planned" | "ordered" | "in_stock" | "active" | "maintenance" | "isolated" | "decommissioned" | "disposed" | "destroyed" | "lost" | "unknown" | undefined;
    purchaseDate?: Date | undefined;
    commissioningDate?: Date | undefined;
    endOfSaleDate?: Date | undefined;
    endOfLifeDate?: Date | undefined;
    endOfSupportDate?: Date | undefined;
    confidentialityNeed?: "low" | "high" | "medium" | undefined;
    integrityNeed?: "low" | "high" | "medium" | undefined;
    availabilityNeed?: "low" | "high" | "medium" | undefined;
    dataProtectionRelevance?: boolean | undefined;
    criticality?: "low" | "critical" | "high" | "medium" | undefined;
    complianceRelevance?: boolean | undefined;
    networkAddresses?: {
        address: string;
        type?: "ipv4" | "ipv6" | "cidr" | "hostname" | undefined;
        primary?: boolean | undefined;
    }[] | undefined;
    dataSource?: string | undefined;
    lastDetectedAt?: Date | undefined;
}>;
export type UpdateAssetDTO = z.infer<typeof UpdateAssetSchema>;
export declare const LifecycleTransitionSchema: z.ZodObject<{
    newStatus: z.ZodEnum<["planned", "ordered", "in_stock", "active", "maintenance", "isolated", "decommissioned", "disposed", "destroyed", "lost", "unknown"]>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    newStatus: "planned" | "ordered" | "in_stock" | "active" | "maintenance" | "isolated" | "decommissioned" | "disposed" | "destroyed" | "lost" | "unknown";
    reason?: string | undefined;
}, {
    newStatus: "planned" | "ordered" | "in_stock" | "active" | "maintenance" | "isolated" | "decommissioned" | "disposed" | "destroyed" | "lost" | "unknown";
    reason?: string | undefined;
}>;
export type LifecycleTransitionDTO = z.infer<typeof LifecycleTransitionSchema>;
export declare const ArchiveAssetSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>;
export type ArchiveAssetDTO = z.infer<typeof ArchiveAssetSchema>;
export declare const DisposalProofSchema: z.ZodObject<{
    disposalDate: z.ZodDate;
    disposalMethod: z.ZodString;
    disposalResponsible: z.ZodString;
}, "strip", z.ZodTypeAny, {
    disposalDate: Date;
    disposalMethod: string;
    disposalResponsible: string;
}, {
    disposalDate: Date;
    disposalMethod: string;
    disposalResponsible: string;
}>;
export type DisposalProofDTO = z.infer<typeof DisposalProofSchema>;
export declare const AssetQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    assetTypeId: z.ZodOptional<z.ZodString>;
    lifecycleStatus: z.ZodOptional<z.ZodString>;
    criticality: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>;
    organizationUnitId: z.ZodOptional<z.ZodString>;
    archived: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    archived: boolean;
    organizationUnitId?: string | undefined;
    search?: string | undefined;
    assetTypeId?: string | undefined;
    lifecycleStatus?: string | undefined;
    criticality?: "low" | "critical" | "high" | "medium" | undefined;
}, {
    organizationUnitId?: string | undefined;
    search?: string | undefined;
    assetTypeId?: string | undefined;
    lifecycleStatus?: string | undefined;
    criticality?: "low" | "critical" | "high" | "medium" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    archived?: boolean | undefined;
}>;
export type AssetQueryDTO = z.infer<typeof AssetQuerySchema>;
export declare const CreateRiskSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    likelihood: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
    impact: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
    status: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    status: string;
    likelihood: "low" | "high" | "medium";
    impact: "low" | "high" | "medium";
    description?: string | undefined;
    category?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
    status?: string | undefined;
    category?: string | undefined;
    likelihood?: "low" | "high" | "medium" | undefined;
    impact?: "low" | "high" | "medium" | undefined;
}>;
export type CreateRiskDTO = z.infer<typeof CreateRiskSchema>;
export declare const UpdateRiskSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    category: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    likelihood: z.ZodOptional<z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>>;
    impact: z.ZodOptional<z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    status?: string | undefined;
    category?: string | undefined;
    likelihood?: "low" | "high" | "medium" | undefined;
    impact?: "low" | "high" | "medium" | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    status?: string | undefined;
    category?: string | undefined;
    likelihood?: "low" | "high" | "medium" | undefined;
    impact?: "low" | "high" | "medium" | undefined;
}>;
export type UpdateRiskDTO = z.infer<typeof UpdateRiskSchema>;
export declare const CreateControlSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    controlType: z.ZodOptional<z.ZodString>;
    implementationStatus: z.ZodDefault<z.ZodEnum<["not_started", "in_progress", "completed", "not_applicable"]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    implementationStatus: "in_progress" | "completed" | "not_started" | "not_applicable";
    description?: string | undefined;
    controlType?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
    implementationStatus?: "in_progress" | "completed" | "not_started" | "not_applicable" | undefined;
    controlType?: string | undefined;
}>;
export type CreateControlDTO = z.infer<typeof CreateControlSchema>;
export declare const FrameworkRequirementImportSchema: z.ZodObject<{
    key: z.ZodString;
    title: z.ZodString;
    text: z.ZodString;
    section: z.ZodOptional<z.ZodString>;
    clauseNumber: z.ZodOptional<z.ZodString>;
    parentKey: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    licenseNotice: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    key: string;
    text: string;
    sortOrder?: number | undefined;
    section?: string | undefined;
    clauseNumber?: string | undefined;
    parentKey?: string | undefined;
    licenseNotice?: string | undefined;
}, {
    title: string;
    key: string;
    text: string;
    sortOrder?: number | undefined;
    section?: string | undefined;
    clauseNumber?: string | undefined;
    parentKey?: string | undefined;
    licenseNotice?: string | undefined;
}>;
export declare const ImportFrameworkSchema: z.ZodObject<{
    framework: z.ZodObject<{
        name: z.ZodString;
        code: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        publisher: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        code: string;
        description?: string | undefined;
        publisher?: string | undefined;
    }, {
        name: string;
        code: string;
        description?: string | undefined;
        publisher?: string | undefined;
    }>;
    version: z.ZodString;
    publicationDate: z.ZodOptional<z.ZodDate>;
    source: z.ZodOptional<z.ZodString>;
    licenseInfo: z.ZodString;
    changelog: z.ZodOptional<z.ZodString>;
    requirements: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        title: z.ZodString;
        text: z.ZodString;
        section: z.ZodOptional<z.ZodString>;
        clauseNumber: z.ZodOptional<z.ZodString>;
        parentKey: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodOptional<z.ZodNumber>;
        licenseNotice: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        key: string;
        text: string;
        sortOrder?: number | undefined;
        section?: string | undefined;
        clauseNumber?: string | undefined;
        parentKey?: string | undefined;
        licenseNotice?: string | undefined;
    }, {
        title: string;
        key: string;
        text: string;
        sortOrder?: number | undefined;
        section?: string | undefined;
        clauseNumber?: string | undefined;
        parentKey?: string | undefined;
        licenseNotice?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    framework: {
        name: string;
        code: string;
        description?: string | undefined;
        publisher?: string | undefined;
    };
    licenseInfo: string;
    version: string;
    requirements: {
        title: string;
        key: string;
        text: string;
        sortOrder?: number | undefined;
        section?: string | undefined;
        clauseNumber?: string | undefined;
        parentKey?: string | undefined;
        licenseNotice?: string | undefined;
    }[];
    source?: string | undefined;
    publicationDate?: Date | undefined;
    changelog?: string | undefined;
}, {
    framework: {
        name: string;
        code: string;
        description?: string | undefined;
        publisher?: string | undefined;
    };
    licenseInfo: string;
    version: string;
    requirements: {
        title: string;
        key: string;
        text: string;
        sortOrder?: number | undefined;
        section?: string | undefined;
        clauseNumber?: string | undefined;
        parentKey?: string | undefined;
        licenseNotice?: string | undefined;
    }[];
    source?: string | undefined;
    publicationDate?: Date | undefined;
    changelog?: string | undefined;
}>;
export type ImportFrameworkDTO = z.infer<typeof ImportFrameworkSchema>;
export declare const CompareFrameworkVersionsSchema: z.ZodObject<{
    fromVersionId: z.ZodString;
    toVersionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    fromVersionId: string;
    toVersionId: string;
}, {
    fromVersionId: string;
    toVersionId: string;
}>;
export type CompareFrameworkVersionsDTO = z.infer<typeof CompareFrameworkVersionsSchema>;
export declare const ControlImplementationSchema: z.ZodEffects<z.ZodObject<{
    controlId: z.ZodString;
    scopeId: z.ZodOptional<z.ZodString>;
    organizationUnitId: z.ZodOptional<z.ZodString>;
    siteId: z.ZodOptional<z.ZodString>;
    responsibleUserId: z.ZodString;
    implementationStatus: z.ZodDefault<z.ZodString>;
    maturityLevel: z.ZodDefault<z.ZodNumber>;
    implementationDescription: z.ZodOptional<z.ZodString>;
    testMethod: z.ZodOptional<z.ZodString>;
    testFrequency: z.ZodOptional<z.ZodString>;
    lastTestDate: z.ZodOptional<z.ZodDate>;
    nextTestDate: z.ZodOptional<z.ZodDate>;
    requirementIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    findings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        severity: z.ZodOptional<z.ZodString>;
        dueDate: z.ZodOptional<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        description?: string | undefined;
        severity?: string | undefined;
        dueDate?: Date | undefined;
    }, {
        title: string;
        description?: string | undefined;
        severity?: string | undefined;
        dueDate?: Date | undefined;
    }>, "many">>;
    actions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        responsibleUserId: z.ZodOptional<z.ZodString>;
        dueDate: z.ZodOptional<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        description?: string | undefined;
        responsibleUserId?: string | undefined;
        dueDate?: Date | undefined;
    }, {
        title: string;
        description?: string | undefined;
        responsibleUserId?: string | undefined;
        dueDate?: Date | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    responsibleUserId: string;
    controlId: string;
    implementationStatus: string;
    maturityLevel: number;
    requirementIds: string[];
    organizationUnitId?: string | undefined;
    scopeId?: string | undefined;
    implementationDescription?: string | undefined;
    testMethod?: string | undefined;
    testFrequency?: string | undefined;
    nextTestDate?: Date | undefined;
    findings?: {
        title: string;
        description?: string | undefined;
        severity?: string | undefined;
        dueDate?: Date | undefined;
    }[] | undefined;
    actions?: {
        title: string;
        description?: string | undefined;
        responsibleUserId?: string | undefined;
        dueDate?: Date | undefined;
    }[] | undefined;
    siteId?: string | undefined;
    lastTestDate?: Date | undefined;
}, {
    responsibleUserId: string;
    controlId: string;
    organizationUnitId?: string | undefined;
    scopeId?: string | undefined;
    implementationStatus?: string | undefined;
    maturityLevel?: number | undefined;
    implementationDescription?: string | undefined;
    testMethod?: string | undefined;
    testFrequency?: string | undefined;
    nextTestDate?: Date | undefined;
    findings?: {
        title: string;
        description?: string | undefined;
        severity?: string | undefined;
        dueDate?: Date | undefined;
    }[] | undefined;
    actions?: {
        title: string;
        description?: string | undefined;
        responsibleUserId?: string | undefined;
        dueDate?: Date | undefined;
    }[] | undefined;
    siteId?: string | undefined;
    lastTestDate?: Date | undefined;
    requirementIds?: string[] | undefined;
}>, {
    responsibleUserId: string;
    controlId: string;
    implementationStatus: string;
    maturityLevel: number;
    requirementIds: string[];
    organizationUnitId?: string | undefined;
    scopeId?: string | undefined;
    implementationDescription?: string | undefined;
    testMethod?: string | undefined;
    testFrequency?: string | undefined;
    nextTestDate?: Date | undefined;
    findings?: {
        title: string;
        description?: string | undefined;
        severity?: string | undefined;
        dueDate?: Date | undefined;
    }[] | undefined;
    actions?: {
        title: string;
        description?: string | undefined;
        responsibleUserId?: string | undefined;
        dueDate?: Date | undefined;
    }[] | undefined;
    siteId?: string | undefined;
    lastTestDate?: Date | undefined;
}, {
    responsibleUserId: string;
    controlId: string;
    organizationUnitId?: string | undefined;
    scopeId?: string | undefined;
    implementationStatus?: string | undefined;
    maturityLevel?: number | undefined;
    implementationDescription?: string | undefined;
    testMethod?: string | undefined;
    testFrequency?: string | undefined;
    nextTestDate?: Date | undefined;
    findings?: {
        title: string;
        description?: string | undefined;
        severity?: string | undefined;
        dueDate?: Date | undefined;
    }[] | undefined;
    actions?: {
        title: string;
        description?: string | undefined;
        responsibleUserId?: string | undefined;
        dueDate?: Date | undefined;
    }[] | undefined;
    siteId?: string | undefined;
    lastTestDate?: Date | undefined;
    requirementIds?: string[] | undefined;
}>;
export type ControlImplementationDTO = z.infer<typeof ControlImplementationSchema>;
export declare const CreateSoAItemSchema: z.ZodObject<{
    requirementId: z.ZodOptional<z.ZodString>;
    controlId: z.ZodOptional<z.ZodString>;
    applicability: z.ZodDefault<z.ZodEnum<["applicable", "not_applicable", "under_review"]>>;
    justification: z.ZodString;
    implementationStatus: z.ZodDefault<z.ZodString>;
    controlImplementationIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    riskIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    evidenceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    applicability: "under_review" | "not_applicable" | "applicable";
    implementationStatus: string;
    justification: string;
    riskIds: string[];
    evidenceIds: string[];
    controlImplementationIds: string[];
    controlId?: string | undefined;
    requirementId?: string | undefined;
}, {
    justification: string;
    controlId?: string | undefined;
    applicability?: "under_review" | "not_applicable" | "applicable" | undefined;
    implementationStatus?: string | undefined;
    riskIds?: string[] | undefined;
    evidenceIds?: string[] | undefined;
    requirementId?: string | undefined;
    controlImplementationIds?: string[] | undefined;
}>;
export declare const CreateSoASchema: z.ZodObject<{
    frameworkId: z.ZodString;
    frameworkVersion: z.ZodString;
    scopeId: z.ZodString;
    items: z.ZodDefault<z.ZodArray<z.ZodObject<{
        requirementId: z.ZodOptional<z.ZodString>;
        controlId: z.ZodOptional<z.ZodString>;
        applicability: z.ZodDefault<z.ZodEnum<["applicable", "not_applicable", "under_review"]>>;
        justification: z.ZodString;
        implementationStatus: z.ZodDefault<z.ZodString>;
        controlImplementationIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        riskIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        evidenceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        applicability: "under_review" | "not_applicable" | "applicable";
        implementationStatus: string;
        justification: string;
        riskIds: string[];
        evidenceIds: string[];
        controlImplementationIds: string[];
        controlId?: string | undefined;
        requirementId?: string | undefined;
    }, {
        justification: string;
        controlId?: string | undefined;
        applicability?: "under_review" | "not_applicable" | "applicable" | undefined;
        implementationStatus?: string | undefined;
        riskIds?: string[] | undefined;
        evidenceIds?: string[] | undefined;
        requirementId?: string | undefined;
        controlImplementationIds?: string[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    scopeId: string;
    frameworkVersion: string;
    frameworkId: string;
    items: {
        applicability: "under_review" | "not_applicable" | "applicable";
        implementationStatus: string;
        justification: string;
        riskIds: string[];
        evidenceIds: string[];
        controlImplementationIds: string[];
        controlId?: string | undefined;
        requirementId?: string | undefined;
    }[];
}, {
    scopeId: string;
    frameworkVersion: string;
    frameworkId: string;
    items?: {
        justification: string;
        controlId?: string | undefined;
        applicability?: "under_review" | "not_applicable" | "applicable" | undefined;
        implementationStatus?: string | undefined;
        riskIds?: string[] | undefined;
        evidenceIds?: string[] | undefined;
        requirementId?: string | undefined;
        controlImplementationIds?: string[] | undefined;
    }[] | undefined;
}>;
export type CreateSoADTO = z.infer<typeof CreateSoASchema>;
export declare const CreateEvidenceSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    evidenceType: z.ZodString;
    source: z.ZodOptional<z.ZodString>;
    classification: z.ZodString;
    responsibleId: z.ZodString;
    fileHash: z.ZodString;
    hashAlgorithm: z.ZodDefault<z.ZodString>;
    fileName: z.ZodOptional<z.ZodString>;
    mimeType: z.ZodOptional<z.ZodString>;
    fileSize: z.ZodOptional<z.ZodNumber>;
    retentionPeriod: z.ZodOptional<z.ZodString>;
    retentionUntil: z.ZodOptional<z.ZodDate>;
    expiresAt: z.ZodOptional<z.ZodDate>;
    deleteProtected: z.ZodDefault<z.ZodBoolean>;
    links: z.ZodDefault<z.ZodArray<z.ZodObject<{
        entityType: z.ZodEnum<["Control", "Risk", "Asset", "SoAItem", "Document"]>;
        entityId: z.ZodString;
        relationType: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        entityType: "Asset" | "Risk" | "Document" | "Control" | "SoAItem";
        entityId: string;
        relationType?: string | undefined;
    }, {
        entityType: "Asset" | "Risk" | "Document" | "Control" | "SoAItem";
        entityId: string;
        relationType?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    responsibleId: string;
    evidenceType: string;
    classification: string;
    fileHash: string;
    hashAlgorithm: string;
    deleteProtected: boolean;
    links: {
        entityType: "Asset" | "Risk" | "Document" | "Control" | "SoAItem";
        entityId: string;
        relationType?: string | undefined;
    }[];
    description?: string | undefined;
    expiresAt?: Date | undefined;
    source?: string | undefined;
    fileName?: string | undefined;
    mimeType?: string | undefined;
    fileSize?: number | undefined;
    retentionPeriod?: string | undefined;
    retentionUntil?: Date | undefined;
}, {
    title: string;
    responsibleId: string;
    evidenceType: string;
    classification: string;
    fileHash: string;
    description?: string | undefined;
    expiresAt?: Date | undefined;
    source?: string | undefined;
    hashAlgorithm?: string | undefined;
    fileName?: string | undefined;
    mimeType?: string | undefined;
    fileSize?: number | undefined;
    retentionPeriod?: string | undefined;
    retentionUntil?: Date | undefined;
    deleteProtected?: boolean | undefined;
    links?: {
        entityType: "Asset" | "Risk" | "Document" | "Control" | "SoAItem";
        entityId: string;
        relationType?: string | undefined;
    }[] | undefined;
}>;
export type CreateEvidenceDTO = z.infer<typeof CreateEvidenceSchema>;
export declare const CreatePolicyDocumentSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    documentType: z.ZodString;
    ownerId: z.ZodString;
    reviewerId: z.ZodOptional<z.ZodString>;
    approverId: z.ZodOptional<z.ZodString>;
    validFrom: z.ZodOptional<z.ZodDate>;
    validUntil: z.ZodOptional<z.ZodDate>;
    nextReviewDate: z.ZodOptional<z.ZodDate>;
    reviewIntervalDays: z.ZodOptional<z.ZodNumber>;
    content: z.ZodString;
    changeLog: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    documentType: string;
    ownerId: string;
    content: string;
    validFrom?: Date | undefined;
    validUntil?: Date | undefined;
    description?: string | undefined;
    nextReviewDate?: Date | undefined;
    approverId?: string | undefined;
    reviewerId?: string | undefined;
    reviewIntervalDays?: number | undefined;
    changeLog?: string | undefined;
}, {
    title: string;
    documentType: string;
    ownerId: string;
    content: string;
    validFrom?: Date | undefined;
    validUntil?: Date | undefined;
    description?: string | undefined;
    nextReviewDate?: Date | undefined;
    approverId?: string | undefined;
    reviewerId?: string | undefined;
    reviewIntervalDays?: number | undefined;
    changeLog?: string | undefined;
}>;
export type CreatePolicyDocumentDTO = z.infer<typeof CreatePolicyDocumentSchema>;
export declare const CreateIncidentSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    detectionTime: z.ZodDate;
    knowledgeTime: z.ZodDate;
    reporterId: z.ZodOptional<z.ZodString>;
    reporterSource: z.ZodOptional<z.ZodString>;
    affectedAssetIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    affectedServiceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    affectedProcessIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    confidentialityImpact: z.ZodDefault<z.ZodEnum<["none", "low", "medium", "high"]>>;
    integrityImpact: z.ZodDefault<z.ZodEnum<["none", "low", "medium", "high"]>>;
    availabilityImpact: z.ZodDefault<z.ZodEnum<["none", "low", "medium", "high"]>>;
    operationalImpact: z.ZodOptional<z.ZodString>;
    financialImpact: z.ZodOptional<z.ZodNumber>;
    legalImpact: z.ZodOptional<z.ZodString>;
    personalDataImpact: z.ZodDefault<z.ZodBoolean>;
    affectedCustomers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    affectedThirdParties: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    suspectedCause: z.ZodOptional<z.ZodString>;
    isIntentional: z.ZodOptional<z.ZodBoolean>;
    hasCrossBorderImpact: z.ZodOptional<z.ZodBoolean>;
    indicatorsOfCompromise: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    immediateActions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    incidentManagerId: z.ZodString;
    severity: z.ZodDefault<z.ZodEnum<["low", "medium", "high", "critical"]>>;
}, "strip", z.ZodTypeAny, {
    description: string;
    title: string;
    detectionTime: Date;
    knowledgeTime: Date;
    confidentialityImpact: "none" | "low" | "high" | "medium";
    integrityImpact: "none" | "low" | "high" | "medium";
    availabilityImpact: "none" | "low" | "high" | "medium";
    personalDataImpact: boolean;
    affectedCustomers: string[];
    affectedThirdParties: string[];
    indicatorsOfCompromise: string[];
    immediateActions: string[];
    incidentManagerId: string;
    severity: "low" | "critical" | "high" | "medium";
    affectedAssetIds: string[];
    affectedProcessIds: string[];
    affectedServiceIds: string[];
    reporterId?: string | undefined;
    reporterSource?: string | undefined;
    operationalImpact?: string | undefined;
    financialImpact?: number | undefined;
    legalImpact?: string | undefined;
    suspectedCause?: string | undefined;
    isIntentional?: boolean | undefined;
    hasCrossBorderImpact?: boolean | undefined;
}, {
    description: string;
    title: string;
    detectionTime: Date;
    knowledgeTime: Date;
    incidentManagerId: string;
    reporterId?: string | undefined;
    reporterSource?: string | undefined;
    confidentialityImpact?: "none" | "low" | "high" | "medium" | undefined;
    integrityImpact?: "none" | "low" | "high" | "medium" | undefined;
    availabilityImpact?: "none" | "low" | "high" | "medium" | undefined;
    operationalImpact?: string | undefined;
    financialImpact?: number | undefined;
    legalImpact?: string | undefined;
    personalDataImpact?: boolean | undefined;
    affectedCustomers?: string[] | undefined;
    affectedThirdParties?: string[] | undefined;
    suspectedCause?: string | undefined;
    isIntentional?: boolean | undefined;
    hasCrossBorderImpact?: boolean | undefined;
    indicatorsOfCompromise?: string[] | undefined;
    immediateActions?: string[] | undefined;
    severity?: "low" | "critical" | "high" | "medium" | undefined;
    affectedAssetIds?: string[] | undefined;
    affectedProcessIds?: string[] | undefined;
    affectedServiceIds?: string[] | undefined;
}>;
export type CreateIncidentDTO = z.infer<typeof CreateIncidentSchema>;
export declare const UpdateIncidentSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    detectionTime: z.ZodOptional<z.ZodDate>;
    knowledgeTime: z.ZodOptional<z.ZodDate>;
    reporterId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    reporterSource: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    affectedAssetIds: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    affectedServiceIds: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    affectedProcessIds: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    confidentialityImpact: z.ZodOptional<z.ZodDefault<z.ZodEnum<["none", "low", "medium", "high"]>>>;
    integrityImpact: z.ZodOptional<z.ZodDefault<z.ZodEnum<["none", "low", "medium", "high"]>>>;
    availabilityImpact: z.ZodOptional<z.ZodDefault<z.ZodEnum<["none", "low", "medium", "high"]>>>;
    operationalImpact: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    financialImpact: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    legalImpact: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    personalDataImpact: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    affectedCustomers: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    affectedThirdParties: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    suspectedCause: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    isIntentional: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    hasCrossBorderImpact: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    indicatorsOfCompromise: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    immediateActions: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    incidentManagerId: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodDefault<z.ZodEnum<["low", "medium", "high", "critical"]>>>;
} & {
    status: z.ZodOptional<z.ZodString>;
    notificationStatus: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description?: string | undefined;
    status?: string | undefined;
    title?: string | undefined;
    detectionTime?: Date | undefined;
    knowledgeTime?: Date | undefined;
    reporterId?: string | undefined;
    reporterSource?: string | undefined;
    confidentialityImpact?: "none" | "low" | "high" | "medium" | undefined;
    integrityImpact?: "none" | "low" | "high" | "medium" | undefined;
    availabilityImpact?: "none" | "low" | "high" | "medium" | undefined;
    operationalImpact?: string | undefined;
    financialImpact?: number | undefined;
    legalImpact?: string | undefined;
    personalDataImpact?: boolean | undefined;
    affectedCustomers?: string[] | undefined;
    affectedThirdParties?: string[] | undefined;
    suspectedCause?: string | undefined;
    isIntentional?: boolean | undefined;
    hasCrossBorderImpact?: boolean | undefined;
    indicatorsOfCompromise?: string[] | undefined;
    immediateActions?: string[] | undefined;
    incidentManagerId?: string | undefined;
    severity?: "low" | "critical" | "high" | "medium" | undefined;
    notificationStatus?: string | undefined;
    affectedAssetIds?: string[] | undefined;
    affectedProcessIds?: string[] | undefined;
    affectedServiceIds?: string[] | undefined;
}, {
    description?: string | undefined;
    status?: string | undefined;
    title?: string | undefined;
    detectionTime?: Date | undefined;
    knowledgeTime?: Date | undefined;
    reporterId?: string | undefined;
    reporterSource?: string | undefined;
    confidentialityImpact?: "none" | "low" | "high" | "medium" | undefined;
    integrityImpact?: "none" | "low" | "high" | "medium" | undefined;
    availabilityImpact?: "none" | "low" | "high" | "medium" | undefined;
    operationalImpact?: string | undefined;
    financialImpact?: number | undefined;
    legalImpact?: string | undefined;
    personalDataImpact?: boolean | undefined;
    affectedCustomers?: string[] | undefined;
    affectedThirdParties?: string[] | undefined;
    suspectedCause?: string | undefined;
    isIntentional?: boolean | undefined;
    hasCrossBorderImpact?: boolean | undefined;
    indicatorsOfCompromise?: string[] | undefined;
    immediateActions?: string[] | undefined;
    incidentManagerId?: string | undefined;
    severity?: "low" | "critical" | "high" | "medium" | undefined;
    notificationStatus?: string | undefined;
    affectedAssetIds?: string[] | undefined;
    affectedProcessIds?: string[] | undefined;
    affectedServiceIds?: string[] | undefined;
}>;
export type UpdateIncidentDTO = z.infer<typeof UpdateIncidentSchema>;
export declare const AssessIncidentSchema: z.ZodEffects<z.ZodObject<{
    assessorId: z.ZodString;
    isReportable: z.ZodBoolean;
    reportingJustification: z.ZodOptional<z.ZodString>;
    decisionNotToReport: z.ZodOptional<z.ZodString>;
    decisionApprovedBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    assessorId: string;
    isReportable: boolean;
    reportingJustification?: string | undefined;
    decisionNotToReport?: string | undefined;
    decisionApprovedBy?: string | undefined;
}, {
    assessorId: string;
    isReportable: boolean;
    reportingJustification?: string | undefined;
    decisionNotToReport?: string | undefined;
    decisionApprovedBy?: string | undefined;
}>, {
    assessorId: string;
    isReportable: boolean;
    reportingJustification?: string | undefined;
    decisionNotToReport?: string | undefined;
    decisionApprovedBy?: string | undefined;
}, {
    assessorId: string;
    isReportable: boolean;
    reportingJustification?: string | undefined;
    decisionNotToReport?: string | undefined;
    decisionApprovedBy?: string | undefined;
}>;
export type AssessIncidentDTO = z.infer<typeof AssessIncidentSchema>;
export declare const ChangeKnowledgeTimeSchema: z.ZodObject<{
    knowledgeTime: z.ZodDate;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    knowledgeTime: Date;
}, {
    reason: string;
    knowledgeTime: Date;
}>;
export type ChangeKnowledgeTimeDTO = z.infer<typeof ChangeKnowledgeTimeSchema>;
export declare const IncidentReportTypeSchema: z.ZodEnum<["early_warning_24h", "incident_notification_72h", "interim_report", "monthly_final_report"]>;
export declare const CreateIncidentReportSchema: z.ZodObject<{
    reportType: z.ZodEnum<["early_warning_24h", "incident_notification_72h", "interim_report", "monthly_final_report"]>;
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodRecord<z.ZodString, z.ZodAny>;
    authorId: z.ZodString;
    recipient: z.ZodOptional<z.ZodString>;
    submissionMethod: z.ZodOptional<z.ZodString>;
    submissionProof: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    content: Record<string, any>;
    reportType: "early_warning_24h" | "incident_notification_72h" | "interim_report" | "monthly_final_report";
    authorId: string;
    title?: string | undefined;
    recipient?: string | undefined;
    submissionMethod?: string | undefined;
    submissionProof?: string | undefined;
}, {
    content: Record<string, any>;
    reportType: "early_warning_24h" | "incident_notification_72h" | "interim_report" | "monthly_final_report";
    authorId: string;
    title?: string | undefined;
    recipient?: string | undefined;
    submissionMethod?: string | undefined;
    submissionProof?: string | undefined;
}>;
export type CreateIncidentReportDTO = z.infer<typeof CreateIncidentReportSchema>;
export declare const CreateIncidentCommunicationSchema: z.ZodObject<{
    channel: z.ZodString;
    direction: z.ZodEnum<["inbound", "outbound"]>;
    recipient: z.ZodString;
    sender: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
    scheduledAt: z.ZodOptional<z.ZodDate>;
    sentAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    direction: "inbound" | "outbound";
    message: string;
    recipient: string;
    channel: string;
    sender?: string | undefined;
    scheduledAt?: Date | undefined;
    sentAt?: Date | undefined;
}, {
    direction: "inbound" | "outbound";
    message: string;
    recipient: string;
    channel: string;
    sender?: string | undefined;
    scheduledAt?: Date | undefined;
    sentAt?: Date | undefined;
}>;
export type CreateIncidentCommunicationDTO = z.infer<typeof CreateIncidentCommunicationSchema>;
export declare const CloseIncidentSchema: z.ZodObject<{
    rootCause: z.ZodOptional<z.ZodString>;
    lessonsLearned: z.ZodOptional<z.ZodString>;
    measuresEvaluation: z.ZodOptional<z.ZodString>;
    closureSummary: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    rootCause?: string | undefined;
    lessonsLearned?: string | undefined;
    measuresEvaluation?: string | undefined;
    closureSummary?: string | undefined;
}, {
    rootCause?: string | undefined;
    lessonsLearned?: string | undefined;
    measuresEvaluation?: string | undefined;
    closureSummary?: string | undefined;
}>;
export type CloseIncidentDTO = z.infer<typeof CloseIncidentSchema>;
export declare const CreateSignificanceRuleVersionSchema: z.ZodObject<{
    version: z.ZodString;
    rules: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodAny>, "many">;
    effectiveFrom: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    version: string;
    rules: Record<string, any>[];
    effectiveFrom?: Date | undefined;
}, {
    version: string;
    rules: Record<string, any>[];
    effectiveFrom?: Date | undefined;
}>;
export type CreateSignificanceRuleVersionDTO = z.infer<typeof CreateSignificanceRuleVersionSchema>;
export declare const CreateNis2QuestionnaireVersionSchema: z.ZodObject<{
    version: z.ZodString;
    title: z.ZodString;
    questions: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodAny>, "many">;
    scoringRules: z.ZodRecord<z.ZodString, z.ZodAny>;
    effectiveFrom: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    version: string;
    title: string;
    questions: Record<string, any>[];
    scoringRules: Record<string, any>;
    effectiveFrom?: Date | undefined;
}, {
    version: string;
    title: string;
    questions: Record<string, any>[];
    scoringRules: Record<string, any>;
    effectiveFrom?: Date | undefined;
}>;
export type CreateNis2QuestionnaireVersionDTO = z.infer<typeof CreateNis2QuestionnaireVersionSchema>;
export declare const CreateNis2AssessmentSchema: z.ZodObject<{
    organizationUnitId: z.ZodOptional<z.ZodString>;
    questionnaireVersion: z.ZodOptional<z.ZodString>;
    answers: z.ZodRecord<z.ZodString, z.ZodAny>;
    justification: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    answers: Record<string, any>;
    organizationUnitId?: string | undefined;
    justification?: string | undefined;
    questionnaireVersion?: string | undefined;
}, {
    answers: Record<string, any>;
    organizationUnitId?: string | undefined;
    justification?: string | undefined;
    questionnaireVersion?: string | undefined;
}>;
export type CreateNis2AssessmentDTO = z.infer<typeof CreateNis2AssessmentSchema>;
export declare const ApproveNis2AssessmentSchema: z.ZodObject<{
    result: z.ZodOptional<z.ZodEnum<["essential_entity", "important_entity", "not_in_scope"]>>;
    justification: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    result?: "essential_entity" | "important_entity" | "not_in_scope" | undefined;
    justification?: string | undefined;
}, {
    result?: "essential_entity" | "important_entity" | "not_in_scope" | undefined;
    justification?: string | undefined;
}>;
export type ApproveNis2AssessmentDTO = z.infer<typeof ApproveNis2AssessmentSchema>;
export declare const CreateNis2RegistrationSchema: z.ZodObject<{
    assessmentId: z.ZodOptional<z.ZodString>;
    entityType: z.ZodString;
    registrationDate: z.ZodOptional<z.ZodDate>;
    deadline: z.ZodDate;
    contactPerson: z.ZodOptional<z.ZodString>;
    contactDetails: z.ZodOptional<z.ZodString>;
    submittedData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    submissionProof: z.ZodOptional<z.ZodString>;
    bsiConfirmation: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    entityType: string;
    deadline: Date;
    assessmentId?: string | undefined;
    submissionProof?: string | undefined;
    registrationDate?: Date | undefined;
    contactPerson?: string | undefined;
    contactDetails?: string | undefined;
    submittedData?: Record<string, any> | undefined;
    bsiConfirmation?: string | undefined;
}, {
    entityType: string;
    deadline: Date;
    assessmentId?: string | undefined;
    submissionProof?: string | undefined;
    registrationDate?: Date | undefined;
    contactPerson?: string | undefined;
    contactDetails?: string | undefined;
    submittedData?: Record<string, any> | undefined;
    bsiConfirmation?: string | undefined;
}>;
export type CreateNis2RegistrationDTO = z.infer<typeof CreateNis2RegistrationSchema>;
export declare const CreateNis2RegistrationChangeSchema: z.ZodObject<{
    changeType: z.ZodString;
    description: z.ZodString;
    changedData: z.ZodRecord<z.ZodString, z.ZodAny>;
    notificationDeadline: z.ZodOptional<z.ZodDate>;
    submittedAt: z.ZodOptional<z.ZodDate>;
    submissionProof: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description: string;
    changeType: string;
    changedData: Record<string, any>;
    notificationDeadline?: Date | undefined;
    submittedAt?: Date | undefined;
    submissionProof?: string | undefined;
}, {
    description: string;
    changeType: string;
    changedData: Record<string, any>;
    notificationDeadline?: Date | undefined;
    submittedAt?: Date | undefined;
    submissionProof?: string | undefined;
}>;
export type CreateNis2RegistrationChangeDTO = z.infer<typeof CreateNis2RegistrationChangeSchema>;
export declare const CreateContractSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    contractType: z.ZodString;
    supplierId: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodDate>;
    endDate: z.ZodOptional<z.ZodDate>;
    renewalDate: z.ZodOptional<z.ZodDate>;
    value: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: string;
    title: string;
    contractType: string;
    description?: string | undefined;
    value?: number | undefined;
    supplierId?: string | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    renewalDate?: Date | undefined;
    currency?: string | undefined;
}, {
    title: string;
    contractType: string;
    description?: string | undefined;
    status?: string | undefined;
    value?: number | undefined;
    supplierId?: string | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    renewalDate?: Date | undefined;
    currency?: string | undefined;
}>;
export type CreateContractDTO = z.infer<typeof CreateContractSchema>;
export declare const CreateLicenseSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    licenseType: z.ZodString;
    vendor: z.ZodOptional<z.ZodString>;
    productId: z.ZodOptional<z.ZodString>;
    licenseKey: z.ZodOptional<z.ZodString>;
    seats: z.ZodOptional<z.ZodNumber>;
    startDate: z.ZodOptional<z.ZodDate>;
    endDate: z.ZodOptional<z.ZodDate>;
    renewalDate: z.ZodOptional<z.ZodDate>;
    cost: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: string;
    title: string;
    licenseType: string;
    description?: string | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    renewalDate?: Date | undefined;
    currency?: string | undefined;
    vendor?: string | undefined;
    productId?: string | undefined;
    licenseKey?: string | undefined;
    seats?: number | undefined;
    cost?: number | undefined;
}, {
    title: string;
    licenseType: string;
    description?: string | undefined;
    status?: string | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    renewalDate?: Date | undefined;
    currency?: string | undefined;
    vendor?: string | undefined;
    productId?: string | undefined;
    licenseKey?: string | undefined;
    seats?: number | undefined;
    cost?: number | undefined;
}>;
export type CreateLicenseDTO = z.infer<typeof CreateLicenseSchema>;
export declare const CreateBusinessProcessSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    processOwner: z.ZodString;
    category: z.ZodOptional<z.ZodEnum<["core", "supporting", "management"]>>;
    siacControlled: z.ZodDefault<z.ZodBoolean>;
    criticality: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
    status: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    criticality: "low" | "high" | "medium";
    status: string;
    processOwner: string;
    siacControlled: boolean;
    description?: string | undefined;
    category?: "core" | "supporting" | "management" | undefined;
}, {
    name: string;
    processOwner: string;
    description?: string | undefined;
    criticality?: "low" | "high" | "medium" | undefined;
    status?: string | undefined;
    category?: "core" | "supporting" | "management" | undefined;
    siacControlled?: boolean | undefined;
}>;
export type CreateBusinessProcessDTO = z.infer<typeof CreateBusinessProcessSchema>;
export declare const CreateRiskTreatmentSchema: z.ZodEffects<z.ZodObject<{
    riskId: z.ZodString;
    assessmentId: z.ZodOptional<z.ZodString>;
    treatmentOption: z.ZodEnum<["reduce", "mitigate", "transfer", "accept", "avoid"]>;
    plannedActions: z.ZodOptional<z.ZodString>;
    responsibleUserId: z.ZodOptional<z.ZodString>;
    targetDate: z.ZodOptional<z.ZodDate>;
    budget: z.ZodOptional<z.ZodNumber>;
    expectedReduction: z.ZodOptional<z.ZodString>;
    dependencies: z.ZodOptional<z.ZodString>;
    implementationStatus: z.ZodOptional<z.ZodString>;
    justification: z.ZodOptional<z.ZodString>;
    expiryDate: z.ZodOptional<z.ZodDate>;
    approverId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    riskId: string;
    treatmentOption: "reduce" | "mitigate" | "transfer" | "accept" | "avoid";
    responsibleUserId?: string | undefined;
    implementationStatus?: string | undefined;
    justification?: string | undefined;
    assessmentId?: string | undefined;
    plannedActions?: string | undefined;
    budget?: number | undefined;
    targetDate?: Date | undefined;
    expectedReduction?: string | undefined;
    dependencies?: string | undefined;
    expiryDate?: Date | undefined;
    approverId?: string | undefined;
}, {
    riskId: string;
    treatmentOption: "reduce" | "mitigate" | "transfer" | "accept" | "avoid";
    responsibleUserId?: string | undefined;
    implementationStatus?: string | undefined;
    justification?: string | undefined;
    assessmentId?: string | undefined;
    plannedActions?: string | undefined;
    budget?: number | undefined;
    targetDate?: Date | undefined;
    expectedReduction?: string | undefined;
    dependencies?: string | undefined;
    expiryDate?: Date | undefined;
    approverId?: string | undefined;
}>, {
    riskId: string;
    treatmentOption: "reduce" | "mitigate" | "transfer" | "accept" | "avoid";
    responsibleUserId?: string | undefined;
    implementationStatus?: string | undefined;
    justification?: string | undefined;
    assessmentId?: string | undefined;
    plannedActions?: string | undefined;
    budget?: number | undefined;
    targetDate?: Date | undefined;
    expectedReduction?: string | undefined;
    dependencies?: string | undefined;
    expiryDate?: Date | undefined;
    approverId?: string | undefined;
}, {
    riskId: string;
    treatmentOption: "reduce" | "mitigate" | "transfer" | "accept" | "avoid";
    responsibleUserId?: string | undefined;
    implementationStatus?: string | undefined;
    justification?: string | undefined;
    assessmentId?: string | undefined;
    plannedActions?: string | undefined;
    budget?: number | undefined;
    targetDate?: Date | undefined;
    expectedReduction?: string | undefined;
    dependencies?: string | undefined;
    expiryDate?: Date | undefined;
    approverId?: string | undefined;
}>;
export type CreateRiskTreatmentDTO = z.infer<typeof CreateRiskTreatmentSchema>;
export declare const UpdateRiskTreatmentSchema: any;
export type UpdateRiskTreatmentDTO = z.infer<typeof UpdateRiskTreatmentSchema>;
export declare const ApproveRiskTreatmentSchema: z.ZodObject<{
    decision: z.ZodDefault<z.ZodEnum<["approved", "rejected"]>>;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    decision: "approved" | "rejected";
    comment?: string | undefined;
}, {
    decision?: "approved" | "rejected" | undefined;
    comment?: string | undefined;
}>;
export type ApproveRiskTreatmentDTO = z.infer<typeof ApproveRiskTreatmentSchema>;
export declare const EffectivenessReviewSchema: z.ZodObject<{
    result: z.ZodString;
    reviewDate: z.ZodDate;
    reviewerId: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    result: string;
    reviewDate: Date;
    notes?: string | undefined;
    reviewerId?: string | undefined;
}, {
    result: string;
    reviewDate: Date;
    notes?: string | undefined;
    reviewerId?: string | undefined;
}>;
export type EffectivenessReviewDTO = z.infer<typeof EffectivenessReviewSchema>;
export declare const CompleteRiskTreatmentSchema: z.ZodEffects<z.ZodObject<{
    residualAssessmentId: z.ZodOptional<z.ZodString>;
    targetAssessment: z.ZodOptional<z.ZodObject<{
        riskMethodVersionId: z.ZodOptional<z.ZodString>;
        likelihood: z.ZodNumber;
        impact: z.ZodNumber;
        inherentRisk: z.ZodOptional<z.ZodString>;
        residualRisk: z.ZodOptional<z.ZodString>;
        targetRisk: z.ZodOptional<z.ZodString>;
        score: z.ZodOptional<z.ZodNumber>;
        assessorId: z.ZodOptional<z.ZodString>;
        nextReviewDate: z.ZodDate;
        justification: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        likelihood: number;
        impact: number;
        nextReviewDate: Date;
        justification: string;
        inherentRisk?: string | undefined;
        residualRisk?: string | undefined;
        targetRisk?: string | undefined;
        assessorId?: string | undefined;
        riskMethodVersionId?: string | undefined;
        score?: number | undefined;
    }, {
        likelihood: number;
        impact: number;
        nextReviewDate: Date;
        justification: string;
        inherentRisk?: string | undefined;
        residualRisk?: string | undefined;
        targetRisk?: string | undefined;
        assessorId?: string | undefined;
        riskMethodVersionId?: string | undefined;
        score?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    residualAssessmentId?: string | undefined;
    targetAssessment?: {
        likelihood: number;
        impact: number;
        nextReviewDate: Date;
        justification: string;
        inherentRisk?: string | undefined;
        residualRisk?: string | undefined;
        targetRisk?: string | undefined;
        assessorId?: string | undefined;
        riskMethodVersionId?: string | undefined;
        score?: number | undefined;
    } | undefined;
}, {
    residualAssessmentId?: string | undefined;
    targetAssessment?: {
        likelihood: number;
        impact: number;
        nextReviewDate: Date;
        justification: string;
        inherentRisk?: string | undefined;
        residualRisk?: string | undefined;
        targetRisk?: string | undefined;
        assessorId?: string | undefined;
        riskMethodVersionId?: string | undefined;
        score?: number | undefined;
    } | undefined;
}>, {
    residualAssessmentId?: string | undefined;
    targetAssessment?: {
        likelihood: number;
        impact: number;
        nextReviewDate: Date;
        justification: string;
        inherentRisk?: string | undefined;
        residualRisk?: string | undefined;
        targetRisk?: string | undefined;
        assessorId?: string | undefined;
        riskMethodVersionId?: string | undefined;
        score?: number | undefined;
    } | undefined;
}, {
    residualAssessmentId?: string | undefined;
    targetAssessment?: {
        likelihood: number;
        impact: number;
        nextReviewDate: Date;
        justification: string;
        inherentRisk?: string | undefined;
        residualRisk?: string | undefined;
        targetRisk?: string | undefined;
        assessorId?: string | undefined;
        riskMethodVersionId?: string | undefined;
        score?: number | undefined;
    } | undefined;
}>;
export type CompleteRiskTreatmentDTO = z.infer<typeof CompleteRiskTreatmentSchema>;
export declare const CreateRiskMethodSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    version: z.ZodString;
    likelihoodScale: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodAny>, Record<string, any>, Record<string, any>>;
    impactScale: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodAny>, Record<string, any>, Record<string, any>>;
    ratingDimensions: z.ZodRecord<z.ZodString, z.ZodAny>;
    calculationType: z.ZodDefault<z.ZodEnum<["product", "sum", "max", "matrix"]>>;
    formulaExpression: z.ZodOptional<z.ZodString>;
    riskClasses: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodAny>, Record<string, any>, Record<string, any>>;
    acceptanceThresholds: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    escalationThresholds: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    approvalRules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    reviewInterval: z.ZodOptional<z.ZodNumber>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isActive: boolean;
    version: string;
    likelihoodScale: Record<string, any>;
    impactScale: Record<string, any>;
    ratingDimensions: Record<string, any>;
    calculationType: "sum" | "max" | "product" | "matrix";
    riskClasses: Record<string, any>;
    description?: string | undefined;
    formulaExpression?: string | undefined;
    acceptanceThresholds?: Record<string, any> | undefined;
    escalationThresholds?: Record<string, any> | undefined;
    approvalRules?: Record<string, any> | undefined;
    reviewInterval?: number | undefined;
}, {
    name: string;
    version: string;
    likelihoodScale: Record<string, any>;
    impactScale: Record<string, any>;
    ratingDimensions: Record<string, any>;
    riskClasses: Record<string, any>;
    isActive?: boolean | undefined;
    description?: string | undefined;
    calculationType?: "sum" | "max" | "product" | "matrix" | undefined;
    formulaExpression?: string | undefined;
    acceptanceThresholds?: Record<string, any> | undefined;
    escalationThresholds?: Record<string, any> | undefined;
    approvalRules?: Record<string, any> | undefined;
    reviewInterval?: number | undefined;
}>;
export type CreateRiskMethodDTO = z.infer<typeof CreateRiskMethodSchema>;
export declare const UpdateRiskMethodSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    version: z.ZodOptional<z.ZodString>;
    likelihoodScale: z.ZodOptional<z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodAny>, Record<string, any>, Record<string, any>>>;
    impactScale: z.ZodOptional<z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodAny>, Record<string, any>, Record<string, any>>>;
    ratingDimensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    calculationType: z.ZodOptional<z.ZodDefault<z.ZodEnum<["product", "sum", "max", "matrix"]>>>;
    formulaExpression: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    riskClasses: z.ZodOptional<z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodAny>, Record<string, any>, Record<string, any>>>;
    acceptanceThresholds: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>>;
    escalationThresholds: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>>;
    approvalRules: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>>;
    reviewInterval: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    isActive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    isActive?: boolean | undefined;
    description?: string | undefined;
    version?: string | undefined;
    likelihoodScale?: Record<string, any> | undefined;
    impactScale?: Record<string, any> | undefined;
    ratingDimensions?: Record<string, any> | undefined;
    calculationType?: "sum" | "max" | "product" | "matrix" | undefined;
    formulaExpression?: string | undefined;
    riskClasses?: Record<string, any> | undefined;
    acceptanceThresholds?: Record<string, any> | undefined;
    escalationThresholds?: Record<string, any> | undefined;
    approvalRules?: Record<string, any> | undefined;
    reviewInterval?: number | undefined;
}, {
    name?: string | undefined;
    isActive?: boolean | undefined;
    description?: string | undefined;
    version?: string | undefined;
    likelihoodScale?: Record<string, any> | undefined;
    impactScale?: Record<string, any> | undefined;
    ratingDimensions?: Record<string, any> | undefined;
    calculationType?: "sum" | "max" | "product" | "matrix" | undefined;
    formulaExpression?: string | undefined;
    riskClasses?: Record<string, any> | undefined;
    acceptanceThresholds?: Record<string, any> | undefined;
    escalationThresholds?: Record<string, any> | undefined;
    approvalRules?: Record<string, any> | undefined;
    reviewInterval?: number | undefined;
}>;
export type UpdateRiskMethodDTO = z.infer<typeof UpdateRiskMethodSchema>;
export declare const RecalculatePreviewSchema: z.ZodObject<{
    riskIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    likelihoodOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    impactOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    riskIds?: string[] | undefined;
    likelihoodOverrides?: Record<string, number> | undefined;
    impactOverrides?: Record<string, number> | undefined;
}, {
    riskIds?: string[] | undefined;
    likelihoodOverrides?: Record<string, number> | undefined;
    impactOverrides?: Record<string, number> | undefined;
}>;
export type RecalculatePreviewDTO = z.infer<typeof RecalculatePreviewSchema>;
export declare const ConfirmRecalculationSchema: z.ZodObject<{
    riskId: z.ZodString;
    riskMethodVersionId: z.ZodString;
    assessorId: z.ZodString;
    justification: z.ZodOptional<z.ZodString>;
    nextReviewDate: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    riskId: string;
    assessorId: string;
    riskMethodVersionId: string;
    nextReviewDate?: Date | undefined;
    justification?: string | undefined;
}, {
    riskId: string;
    assessorId: string;
    riskMethodVersionId: string;
    nextReviewDate?: Date | undefined;
    justification?: string | undefined;
}>;
export type ConfirmRecalculationDTO = z.infer<typeof ConfirmRecalculationSchema>;
export declare const BulkConfirmRecalculationSchema: z.ZodObject<{
    riskIds: z.ZodArray<z.ZodString, "many">;
    riskMethodVersionId: z.ZodString;
    assessorId: z.ZodString;
    justification: z.ZodOptional<z.ZodString>;
    nextReviewDate: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    assessorId: string;
    riskMethodVersionId: string;
    riskIds: string[];
    nextReviewDate?: Date | undefined;
    justification?: string | undefined;
}, {
    assessorId: string;
    riskMethodVersionId: string;
    riskIds: string[];
    nextReviewDate?: Date | undefined;
    justification?: string | undefined;
}>;
export type BulkConfirmRecalculationDTO = z.infer<typeof BulkConfirmRecalculationSchema>;
export declare const CalculateRiskScoreSchema: z.ZodObject<{
    likelihood: z.ZodNumber;
    impact: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    likelihood: number;
    impact: number;
}, {
    likelihood: number;
    impact: number;
}>;
export type CalculateRiskScoreDTO = z.infer<typeof CalculateRiskScoreSchema>;
export declare const UpdatePreferencesSchema: z.ZodObject<{
    language: z.ZodOptional<z.ZodEnum<["en", "de"]>>;
    darkMode: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    language?: "en" | "de" | undefined;
    darkMode?: boolean | undefined;
}, {
    language?: "en" | "de" | undefined;
    darkMode?: boolean | undefined;
}>;
export type UpdatePreferencesDTO = z.infer<typeof UpdatePreferencesSchema>;
export declare const CreateRiskScenarioSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    threatId: z.ZodString;
    vulnerabilityId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    threatId: string;
    description?: string | undefined;
    vulnerabilityId?: string | undefined;
}, {
    title: string;
    threatId: string;
    description?: string | undefined;
    vulnerabilityId?: string | undefined;
}>;
export type CreateRiskScenarioDTO = z.infer<typeof CreateRiskScenarioSchema>;
export declare const UpdateRiskScenarioSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    threatId: z.ZodOptional<z.ZodString>;
    vulnerabilityId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    description?: string | undefined;
    vulnerabilityId?: string | undefined;
    title?: string | undefined;
    threatId?: string | undefined;
}, {
    description?: string | undefined;
    vulnerabilityId?: string | undefined;
    title?: string | undefined;
    threatId?: string | undefined;
}>;
export type UpdateRiskScenarioDTO = z.infer<typeof UpdateRiskScenarioSchema>;
export declare const CreateRiskCauseSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    description?: string | undefined;
    category?: string | undefined;
}, {
    title: string;
    description?: string | undefined;
    category?: string | undefined;
}>;
export type CreateRiskCauseDTO = z.infer<typeof CreateRiskCauseSchema>;
export declare const UpdateRiskCauseSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    category: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    description?: string | undefined;
    category?: string | undefined;
    title?: string | undefined;
}, {
    description?: string | undefined;
    category?: string | undefined;
    title?: string | undefined;
}>;
export type UpdateRiskCauseDTO = z.infer<typeof UpdateRiskCauseSchema>;
export declare const CreateRiskImpactSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    severity: z.ZodDefault<z.ZodEnum<["low", "medium", "high", "very_high"]>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    severity: "low" | "high" | "medium" | "very_high";
    description?: string | undefined;
    category?: string | undefined;
}, {
    title: string;
    description?: string | undefined;
    category?: string | undefined;
    severity?: "low" | "high" | "medium" | "very_high" | undefined;
}>;
export type CreateRiskImpactDTO = z.infer<typeof CreateRiskImpactSchema>;
export declare const UpdateRiskImpactSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    category: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    severity: z.ZodOptional<z.ZodDefault<z.ZodEnum<["low", "medium", "high", "very_high"]>>>;
}, "strip", z.ZodTypeAny, {
    description?: string | undefined;
    category?: string | undefined;
    title?: string | undefined;
    severity?: "low" | "high" | "medium" | "very_high" | undefined;
}, {
    description?: string | undefined;
    category?: string | undefined;
    title?: string | undefined;
    severity?: "low" | "high" | "medium" | "very_high" | undefined;
}>;
export type UpdateRiskImpactDTO = z.infer<typeof UpdateRiskImpactSchema>;
export declare const CreateRiskAssessmentSchema: z.ZodObject<{
    riskId: z.ZodString;
    riskMethodVersionId: z.ZodString;
    assessmentType: z.ZodDefault<z.ZodEnum<["inherent", "current", "target"]>>;
    likelihood: z.ZodNumber;
    impact: z.ZodNumber;
    inherentRisk: z.ZodString;
    residualRisk: z.ZodString;
    targetRisk: z.ZodString;
    score: z.ZodOptional<z.ZodNumber>;
    assessorId: z.ZodString;
    nextReviewDate: z.ZodDate;
    justification: z.ZodString;
}, "strip", z.ZodTypeAny, {
    riskId: string;
    likelihood: number;
    impact: number;
    inherentRisk: string;
    residualRisk: string;
    targetRisk: string;
    assessorId: string;
    nextReviewDate: Date;
    riskMethodVersionId: string;
    justification: string;
    assessmentType: "inherent" | "current" | "target";
    score?: number | undefined;
}, {
    riskId: string;
    likelihood: number;
    impact: number;
    inherentRisk: string;
    residualRisk: string;
    targetRisk: string;
    assessorId: string;
    nextReviewDate: Date;
    riskMethodVersionId: string;
    justification: string;
    assessmentType?: "inherent" | "current" | "target" | undefined;
    score?: number | undefined;
}>;
export type CreateRiskAssessmentDTO = z.infer<typeof CreateRiskAssessmentSchema>;
export declare const UpdateRiskAssessmentSchema: z.ZodObject<{
    riskId: z.ZodOptional<z.ZodString>;
    riskMethodVersionId: z.ZodOptional<z.ZodString>;
    assessmentType: z.ZodOptional<z.ZodDefault<z.ZodEnum<["inherent", "current", "target"]>>>;
    likelihood: z.ZodOptional<z.ZodNumber>;
    impact: z.ZodOptional<z.ZodNumber>;
    inherentRisk: z.ZodOptional<z.ZodString>;
    residualRisk: z.ZodOptional<z.ZodString>;
    targetRisk: z.ZodOptional<z.ZodString>;
    score: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    assessorId: z.ZodOptional<z.ZodString>;
    nextReviewDate: z.ZodOptional<z.ZodDate>;
    justification: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    riskId?: string | undefined;
    likelihood?: number | undefined;
    impact?: number | undefined;
    inherentRisk?: string | undefined;
    residualRisk?: string | undefined;
    targetRisk?: string | undefined;
    assessorId?: string | undefined;
    nextReviewDate?: Date | undefined;
    riskMethodVersionId?: string | undefined;
    justification?: string | undefined;
    assessmentType?: "inherent" | "current" | "target" | undefined;
    score?: number | undefined;
}, {
    riskId?: string | undefined;
    likelihood?: number | undefined;
    impact?: number | undefined;
    inherentRisk?: string | undefined;
    residualRisk?: string | undefined;
    targetRisk?: string | undefined;
    assessorId?: string | undefined;
    nextReviewDate?: Date | undefined;
    riskMethodVersionId?: string | undefined;
    justification?: string | undefined;
    assessmentType?: "inherent" | "current" | "target" | undefined;
    score?: number | undefined;
}>;
export type UpdateRiskAssessmentDTO = z.infer<typeof UpdateRiskAssessmentSchema>;
export declare const CreateReviewTaskSchema: z.ZodObject<{
    riskId: z.ZodString;
    scheduledDate: z.ZodDate;
    dueDate: z.ZodDate;
    priority: z.ZodDefault<z.ZodEnum<["low", "medium", "high", "critical"]>>;
    assignedTo: z.ZodOptional<z.ZodString>;
    triggerType: z.ZodDefault<z.ZodEnum<["scheduled", "unplanned_event", "ad_hoc"]>>;
    triggerEventId: z.ZodOptional<z.ZodString>;
    triggerSource: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    riskId: string;
    scheduledDate: Date;
    dueDate: Date;
    priority: "low" | "critical" | "high" | "medium";
    triggerType: "scheduled" | "unplanned_event" | "ad_hoc";
    assignedTo?: string | undefined;
    triggerEventId?: string | undefined;
    triggerSource?: string | undefined;
    notes?: string | undefined;
}, {
    riskId: string;
    scheduledDate: Date;
    dueDate: Date;
    priority?: "low" | "critical" | "high" | "medium" | undefined;
    assignedTo?: string | undefined;
    triggerType?: "scheduled" | "unplanned_event" | "ad_hoc" | undefined;
    triggerEventId?: string | undefined;
    triggerSource?: string | undefined;
    notes?: string | undefined;
}>;
export type CreateReviewTaskDTO = z.infer<typeof CreateReviewTaskSchema>;
export declare const UpdateReviewTaskSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["pending", "in_progress", "completed", "overdue", "cancelled"]>>;
    priority: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>;
    assignedTo: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    status?: "pending" | "in_progress" | "completed" | "overdue" | "cancelled" | undefined;
    dueDate?: Date | undefined;
    priority?: "low" | "critical" | "high" | "medium" | undefined;
    assignedTo?: string | null | undefined;
    notes?: string | undefined;
}, {
    status?: "pending" | "in_progress" | "completed" | "overdue" | "cancelled" | undefined;
    dueDate?: Date | undefined;
    priority?: "low" | "critical" | "high" | "medium" | undefined;
    assignedTo?: string | null | undefined;
    notes?: string | undefined;
}>;
export type UpdateReviewTaskDTO = z.infer<typeof UpdateReviewTaskSchema>;
export declare const UnplannedReviewEventSchema: z.ZodObject<{
    type: z.ZodEnum<["security_incident", "technical_change", "new_critical_supplier", "new_vulnerability", "regulatory_change", "criticality_change", "kpi_threshold_exceeded", "risk_approval_expiring"]>;
    severity: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "very_high"]>>;
    assetId: z.ZodOptional<z.ZodString>;
    riskId: z.ZodOptional<z.ZodString>;
    details: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "security_incident" | "technical_change" | "new_critical_supplier" | "new_vulnerability" | "regulatory_change" | "criticality_change" | "kpi_threshold_exceeded" | "risk_approval_expiring";
    details?: string | undefined;
    assetId?: string | undefined;
    riskId?: string | undefined;
    severity?: "low" | "high" | "medium" | "very_high" | undefined;
}, {
    type: "security_incident" | "technical_change" | "new_critical_supplier" | "new_vulnerability" | "regulatory_change" | "criticality_change" | "kpi_threshold_exceeded" | "risk_approval_expiring";
    details?: string | undefined;
    assetId?: string | undefined;
    riskId?: string | undefined;
    severity?: "low" | "high" | "medium" | "very_high" | undefined;
}>;
export type UnplannedReviewEventDTO = z.infer<typeof UnplannedReviewEventSchema>;
export declare const RiskAggregationGroupBySchema: z.ZodEnum<["orgUnit", "location", "assetType", "process", "service", "scope", "riskClass", "status", "assessmentType"]>;
export declare const RiskAggregationQuerySchema: z.ZodObject<{
    groupBy: z.ZodDefault<z.ZodEnum<["orgUnit", "location", "assetType", "process", "service", "scope", "riskClass", "status", "assessmentType"]>>;
    from: z.ZodOptional<z.ZodDate>;
    to: z.ZodOptional<z.ZodDate>;
    scope: z.ZodEffects<z.ZodOptional<z.ZodString>, string[] | undefined, string | undefined>;
    organizationUnitId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    riskClass: z.ZodOptional<z.ZodString>;
    assessmentType: z.ZodOptional<z.ZodEnum<["inherent", "current", "target"]>>;
    methodVersionId: z.ZodOptional<z.ZodString>;
    isCurrent: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    groupBy: "assetType" | "scope" | "status" | "location" | "process" | "service" | "assessmentType" | "orgUnit" | "riskClass";
    from?: Date | undefined;
    to?: Date | undefined;
    organizationUnitId?: string | undefined;
    scope?: string[] | undefined;
    status?: string | undefined;
    assessmentType?: "inherent" | "current" | "target" | undefined;
    isCurrent?: boolean | undefined;
    riskClass?: string | undefined;
    methodVersionId?: string | undefined;
}, {
    from?: Date | undefined;
    to?: Date | undefined;
    organizationUnitId?: string | undefined;
    scope?: string | undefined;
    status?: string | undefined;
    assessmentType?: "inherent" | "current" | "target" | undefined;
    isCurrent?: boolean | undefined;
    riskClass?: string | undefined;
    groupBy?: "assetType" | "scope" | "status" | "location" | "process" | "service" | "assessmentType" | "orgUnit" | "riskClass" | undefined;
    methodVersionId?: string | undefined;
}>;
export type RiskAggregationQueryDTO = z.infer<typeof RiskAggregationQuerySchema>;
export declare const CreateRiskEnhancedSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    organizationUnitId: z.ZodOptional<z.ZodString>;
    scenarioId: z.ZodOptional<z.ZodString>;
    threatId: z.ZodOptional<z.ZodString>;
    vulnerabilityId: z.ZodOptional<z.ZodString>;
    causeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    impactIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    assetIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    processIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    serviceIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    riskMethodVersionId: z.ZodOptional<z.ZodString>;
    likelihood: z.ZodNumber;
    impact: z.ZodNumber;
    assessorId: z.ZodString;
    riskOwnerId: z.ZodString;
    nextReviewDate: z.ZodDate;
    justification: z.ZodString;
}, "strip", z.ZodTypeAny, {
    description: string;
    title: string;
    likelihood: number;
    impact: number;
    riskOwnerId: string;
    assessorId: string;
    nextReviewDate: Date;
    justification: string;
    organizationUnitId?: string | undefined;
    processIds?: string[] | undefined;
    serviceIds?: string[] | undefined;
    vulnerabilityId?: string | undefined;
    threatId?: string | undefined;
    riskMethodVersionId?: string | undefined;
    scenarioId?: string | undefined;
    causeIds?: string[] | undefined;
    impactIds?: string[] | undefined;
    assetIds?: string[] | undefined;
}, {
    description: string;
    title: string;
    likelihood: number;
    impact: number;
    riskOwnerId: string;
    assessorId: string;
    nextReviewDate: Date;
    justification: string;
    organizationUnitId?: string | undefined;
    processIds?: string[] | undefined;
    serviceIds?: string[] | undefined;
    vulnerabilityId?: string | undefined;
    threatId?: string | undefined;
    riskMethodVersionId?: string | undefined;
    scenarioId?: string | undefined;
    causeIds?: string[] | undefined;
    impactIds?: string[] | undefined;
    assetIds?: string[] | undefined;
}>;
export type CreateRiskEnhancedDTO = z.infer<typeof CreateRiskEnhancedSchema>;
//# sourceMappingURL=index.d.ts.map