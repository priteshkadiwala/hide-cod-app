#!/usr/bin/env node

/**
 * One-time script to activate the CODBlock payment customization.
 *
 * Usage:
 *   SHOPIFY_ACCESS_TOKEN=<token> SHOPIFY_STORE=<store>.myshopify.com node scripts/activate.js
 *
 * Or run via shopify app dev console.
 */

const STORE = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = "2025-01";

if (!STORE || !TOKEN) {
  console.error(
    "Usage: SHOPIFY_ACCESS_TOKEN=<token> SHOPIFY_STORE=<store>.myshopify.com node scripts/activate.js",
  );
  process.exit(1);
}

const ENDPOINT = `https://${STORE}/admin/api/${API_VERSION}/graphql.json`;

async function graphql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function main() {
  console.log(`\nConnecting to ${STORE}...\n`);

  // Step 1: Find the function
  console.log("Step 1: Finding the CODBlock function...");
  const functionsResult = await graphql(`{
    shopifyFunctions(first: 25, apiType: "payment_customization") {
      nodes {
        id
        title
        apiType
      }
    }
  }`);

  const functions = functionsResult.data?.shopifyFunctions?.nodes ?? [];
  const ourFunction = functions.find(
    (fn) => fn.title === "CODBlock",
  );

  if (!ourFunction) {
    console.error("ERROR: Could not find the CODBlock function.");
    console.error("Available functions:", functions.map((f) => f.title));
    process.exit(1);
  }
  console.log(`  Found: ${ourFunction.title} (${ourFunction.id})`);

  // Step 2: Check if customization already exists
  console.log("\nStep 2: Checking existing payment customizations...");
  const customizationsResult = await graphql(`{
    paymentCustomizations(first: 25) {
      nodes {
        id
        title
        enabled
        functionId
      }
    }
  }`);

  const customizations =
    customizationsResult.data?.paymentCustomizations?.nodes ?? [];
  const existing = customizations.find(
    (c) => c.functionId === ourFunction.id,
  );

  if (existing) {
    console.log(`  Found existing: "${existing.title}" (enabled: ${existing.enabled})`);

    if (existing.enabled) {
      console.log("\n✅ Payment customization is already active! Nothing to do.");
      return;
    }

    // Enable it
    console.log("\nStep 3: Enabling existing customization...");
    const updateResult = await graphql(
      `mutation($id: ID!, $input: PaymentCustomizationInput!) {
        paymentCustomizationUpdate(id: $id, paymentCustomization: $input) {
          paymentCustomization { id title enabled }
          userErrors { field message }
        }
      }`,
      {
        id: existing.id,
        input: { enabled: true },
      },
    );

    const updateErrors =
      updateResult.data?.paymentCustomizationUpdate?.userErrors ?? [];
    if (updateErrors.length > 0) {
      console.error("ERROR:", updateErrors);
      process.exit(1);
    }

    console.log("\n✅ Payment customization enabled successfully!");
    return;
  }

  // Step 3: Create new customization
  console.log("  No existing customization found.");
  console.log("\nStep 3: Creating payment customization...");
  const createResult = await graphql(
    `mutation($input: PaymentCustomizationInput!) {
      paymentCustomizationCreate(paymentCustomization: $input) {
        paymentCustomization { id title enabled }
        userErrors { field message }
      }
    }`,
    {
      input: {
        functionId: ourFunction.id,
        title: "CODBlock",
        enabled: true,
      },
    },
  );

  const createErrors =
    createResult.data?.paymentCustomizationCreate?.userErrors ?? [];
  if (createErrors.length > 0) {
    console.error("ERROR:", createErrors);
    process.exit(1);
  }

  const created =
    createResult.data?.paymentCustomizationCreate?.paymentCustomization;
  console.log(`  Created: "${created.title}" (${created.id})`);
  console.log("\n✅ Payment customization created and activated successfully!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
