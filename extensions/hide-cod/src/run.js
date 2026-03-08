// @ts-check

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @type {FunctionRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const cartContainsGiftCard = input.cart.lines.some((line) => {
    const merchandise = line.merchandise;
    // Check ProductVariant shape (has .product.isGiftCard)
    if (merchandise.product?.isGiftCard) {
      return true;
    }
    // Check CustomProduct shape (has .isGiftCard directly)
    if (merchandise.isGiftCard) {
      return true;
    }
    return false;
  });

  if (!cartContainsGiftCard) {
    return NO_CHANGES;
  }

  const codMethod = input.paymentMethods.find((method) =>
    method.name.toLowerCase().includes("cash on delivery") ||
    method.name.toLowerCase().includes("cod")
  );

  if (!codMethod) {
    return NO_CHANGES;
  }

  return {
    operations: [
      {
        hide: {
          paymentMethodId: codMethod.id,
        },
      },
    ],
  };
}
