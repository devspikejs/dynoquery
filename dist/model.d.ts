import { DynoQuery } from "./index";
export interface ModelConfig<T = any> {
    tableName?: string;
    pkPrefix: string;
    skValue: string;
    onUpdate?: (sk: any, data: any) => void;
}
export declare class Model<T = any> {
    protected db: DynoQuery;
    protected tableName?: string;
    protected pkPrefix: string;
    protected skValue: string;
    protected onUpdate?: (sk: any, data: any) => void;
    constructor(db: DynoQuery, config: ModelConfig<T>);
    protected getTableName(): string;
    getPK(id?: string): string;
    /**
     * Find an item by its identifier (part of the PK).
     * Assumes the SK is fixed as defined in ModelConfig.
     */
    find(id?: string): Promise<T | null>;
    /**
     * Save an item.
     */
    save(data: T, id?: string): Promise<void>;
    /**
     * Update an existing item.
     */
    update(data: Partial<T>, id?: string): Promise<void>;
    /**
     * Delete an item by its identifier.
     */
    remove(id?: string): Promise<void>;
}
