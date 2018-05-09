export type JsonObject = boolean | number | string | null | JsonArray | JsonHash;

interface JsonHash {
  [key: string]: JsonObject;
}

interface JsonArray extends Array<JsonObject> {}
