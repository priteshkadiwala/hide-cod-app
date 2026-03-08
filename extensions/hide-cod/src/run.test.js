import { describe, it, expect } from "vitest";
import { run } from "./run";

describe("hide COD for gift cards", () => {
  it("returns no operations when cart has no gift card", () => {
    const result = run({
      cart: {
        lines: [
          {
            merchandise: {
              product: {
                isGiftCard: false,
              },
            },
          },
        ],
      },
      paymentMethods: [
        { id: "1", name: "Credit Card" },
        { id: "2", name: "Cash on Delivery" },
      ],
    });

    expect(result).toEqual({ operations: [] });
  });

  it("hides COD when cart contains a gift card (ProductVariant)", () => {
    const result = run({
      cart: {
        lines: [
          {
            merchandise: {
              product: {
                isGiftCard: true,
              },
            },
          },
        ],
      },
      paymentMethods: [
        { id: "1", name: "Credit Card" },
        { id: "2", name: "Cash on Delivery" },
      ],
    });

    expect(result).toEqual({
      operations: [
        {
          hide: {
            paymentMethodId: "2",
          },
        },
      ],
    });
  });

  it("hides COD when cart contains a gift card (CustomProduct)", () => {
    const result = run({
      cart: {
        lines: [
          {
            merchandise: {
              isGiftCard: true,
            },
          },
        ],
      },
      paymentMethods: [
        { id: "1", name: "Credit Card" },
        { id: "2", name: "Cash on Delivery" },
      ],
    });

    expect(result).toEqual({
      operations: [
        {
          hide: {
            paymentMethodId: "2",
          },
        },
      ],
    });
  });

  it("matches COD case-insensitively", () => {
    const result = run({
      cart: {
        lines: [
          {
            merchandise: {
              product: {
                isGiftCard: true,
              },
            },
          },
        ],
      },
      paymentMethods: [
        { id: "1", name: "Credit Card" },
        { id: "2", name: "CASH ON DELIVERY" },
      ],
    });

    expect(result).toEqual({
      operations: [
        {
          hide: {
            paymentMethodId: "2",
          },
        },
      ],
    });
  });

  it("matches payment method containing 'cod'", () => {
    const result = run({
      cart: {
        lines: [
          {
            merchandise: {
              product: {
                isGiftCard: true,
              },
            },
          },
        ],
      },
      paymentMethods: [
        { id: "1", name: "Credit Card" },
        { id: "2", name: "COD" },
      ],
    });

    expect(result).toEqual({
      operations: [
        {
          hide: {
            paymentMethodId: "2",
          },
        },
      ],
    });
  });

  it("returns no operations when gift card exists but no COD method", () => {
    const result = run({
      cart: {
        lines: [
          {
            merchandise: {
              product: {
                isGiftCard: true,
              },
            },
          },
        ],
      },
      paymentMethods: [
        { id: "1", name: "Credit Card" },
        { id: "2", name: "PayPal" },
      ],
    });

    expect(result).toEqual({ operations: [] });
  });

  it("returns no operations when cart is empty", () => {
    const result = run({
      cart: {
        lines: [],
      },
      paymentMethods: [
        { id: "1", name: "Cash on Delivery" },
      ],
    });

    expect(result).toEqual({ operations: [] });
  });
});
