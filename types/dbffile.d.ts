declare module "dbffile" {
  export type DBFField = {
    name: string;
    type: string;
    length: number;
    decimalPlaces: number;
  };

  export type DBFOpenOptions = {
    encoding?: string | Record<string, string>;
    readMode?: "strict" | "loose";
  };

  export class DBFFile {
    static open(path: string, options?: DBFOpenOptions): Promise<DBFFile>;
    readonly recordCount: number;
    readonly fields: DBFField[];
    [Symbol.asyncIterator](): AsyncIterableIterator<Record<string, unknown>>;
  }
}
