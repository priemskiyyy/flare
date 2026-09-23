type Constructor = abstract new (...parameters: never[]) => object;

/** `instanceof` for hostile values: a proxy's prototype trap can throw, and a thrown check is a false one. */
export const isInstanceOf = <TConstructor extends Constructor>(
  value: object,
  constructor: TConstructor,
): value is InstanceType<TConstructor> => {
  try {
    return value instanceof constructor;
  } catch {
    return false;
  }
};
