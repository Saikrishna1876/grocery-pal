/* eslint-disable */

export type TableNames = string;
export type Doc<TableName extends TableNames> = any;
export type Id<TableName extends string> = string & { __tableName?: TableName };
export type DataModel = any;
