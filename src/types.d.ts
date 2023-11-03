/// <reference lib="dom" />

namespace JSON {
  type Value = null | boolean | number | string | Object | Array;
  type Array = Value[];
  type Object = { [key: string]: Value };
}
