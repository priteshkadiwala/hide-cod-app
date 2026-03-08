import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  useSubmit,
  useNavigation,
} from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineStack,
  Banner,
  Badge,
  Box,
  Button,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

const SHOPIFY_FUNCTIONS_QUERY = `#graphql
  query shopifyFunctions {
    shopifyFunctions(first: 25, apiType: "payment_customization") {
      nodes {
        id
        title
        apiType
      }
    }
  }
`;

const PAYMENT_CUSTOMIZATIONS_QUERY = `#graphql
  query paymentCustomizations {
    paymentCustomizations(first: 25) {
      nodes {
        id
        title
        enabled
        functionId
      }
    }
  }
`;

const PAYMENT_CUSTOMIZATION_CREATE = `#graphql
  mutation paymentCustomizationCreate($paymentCustomization: PaymentCustomizationInput!) {
    paymentCustomizationCreate(paymentCustomization: $paymentCustomization) {
      paymentCustomization {
        id
        title
        enabled
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const PAYMENT_CUSTOMIZATION_UPDATE = `#graphql
  mutation paymentCustomizationUpdate($id: ID!, $paymentCustomization: PaymentCustomizationInput!) {
    paymentCustomizationUpdate(id: $id, paymentCustomization: $paymentCustomization) {
      paymentCustomization {
        id
        title
        enabled
      }
      userErrors {
        field
        message
      }
    }
  }
`;

async function findFunction(admin: any) {
  const functionsResponse = await admin.graphql(SHOPIFY_FUNCTIONS_QUERY);
  const functionsData = await functionsResponse.json();
  const functions = functionsData.data?.shopifyFunctions?.nodes ?? [];
  return functions.find(
    (fn: any) => fn.title === "CODBlock",
  );
}

async function findExistingCustomization(admin: any, functionId: string) {
  const customizationsResponse = await admin.graphql(
    PAYMENT_CUSTOMIZATIONS_QUERY,
  );
  const customizationsData = await customizationsResponse.json();
  const customizations =
    customizationsData.data?.paymentCustomizations?.nodes ?? [];
  return customizations.find((c: any) => c.functionId === functionId);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const ourFunction = await findFunction(admin);
  if (!ourFunction) {
    return json({
      status: "not_deployed" as const,
      enabled: false,
      message:
        "Could not find the CODBlock function. Make sure the extension is deployed.",
    });
  }

  const existing = await findExistingCustomization(admin, ourFunction.id);

  if (!existing) {
    return json({
      status: "inactive" as const,
      enabled: false,
      message:
        "Payment customization has not been activated yet. Click the button below to activate it.",
    });
  }

  if (!existing.enabled) {
    return json({
      status: "disabled" as const,
      enabled: false,
      message:
        "Payment customization exists but is currently disabled. Click the button below to enable it.",
    });
  }

  return json({
    status: "active" as const,
    enabled: true,
    message: "Payment customization is active. COD will be hidden when the cart contains a gift card.",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    const ourFunction = await findFunction(admin);
    if (!ourFunction) {
      return json({
        status: "not_deployed" as const,
        enabled: false,
        message:
          "Could not find the CODBlock function. Deploy the extension first.",
      });
    }

    const existing = await findExistingCustomization(admin, ourFunction.id);

    if (intent === "activate") {
      if (!existing) {
        const createResponse = await admin.graphql(
          PAYMENT_CUSTOMIZATION_CREATE,
          {
            variables: {
              paymentCustomization: {
                functionId: ourFunction.id,
                title: "CODBlock",
                enabled: true,
              },
            },
          },
        );
        const createData = await createResponse.json();
        const userErrors =
          createData.data?.paymentCustomizationCreate?.userErrors ?? [];
        if (userErrors.length > 0) {
          return json({
            status: "error" as const,
            enabled: false,
            message: userErrors.map((e: any) => e.message).join(", "),
          });
        }
        return json({
          status: "active" as const,
          enabled: true,
          message: "Payment customization activated successfully.",
        });
      }

      const updateResponse = await admin.graphql(
        PAYMENT_CUSTOMIZATION_UPDATE,
        {
          variables: {
            id: existing.id,
            paymentCustomization: { enabled: true },
          },
        },
      );
      const updateData = await updateResponse.json();
      const userErrors =
        updateData.data?.paymentCustomizationUpdate?.userErrors ?? [];
      if (userErrors.length > 0) {
        return json({
          status: "error" as const,
          enabled: false,
          message: userErrors.map((e: any) => e.message).join(", "),
        });
      }
      return json({
        status: "active" as const,
        enabled: true,
        message: "Payment customization enabled successfully.",
      });
    }

    if (intent === "deactivate" && existing) {
      const updateResponse = await admin.graphql(
        PAYMENT_CUSTOMIZATION_UPDATE,
        {
          variables: {
            id: existing.id,
            paymentCustomization: { enabled: false },
          },
        },
      );
      const updateData = await updateResponse.json();
      const userErrors =
        updateData.data?.paymentCustomizationUpdate?.userErrors ?? [];
      if (userErrors.length > 0) {
        return json({
          status: "error" as const,
          enabled: existing.enabled,
          message: userErrors.map((e: any) => e.message).join(", "),
        });
      }
      return json({
        status: "disabled" as const,
        enabled: false,
        message: "Payment customization has been disabled.",
      });
    }

    return json({
      status: "error" as const,
      enabled: false,
      message: "Unknown action.",
    });
  } catch (error) {
    console.error("Action error:", error);
    if (error instanceof Response) throw error;
    return json({
      status: "error" as const,
      enabled: false,
      message:
        error instanceof Error
          ? `Error: ${error.message}`
          : "An unexpected error occurred.",
    });
  }
};

export default function Index() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const data = actionData ?? loaderData;
  const { status, enabled, message } = data;

  const handleActivate = () => {
    submit({ intent: "activate" }, { method: "post" });
  };

  const handleDeactivate = () => {
    submit({ intent: "deactivate" }, { method: "post" });
  };

  const bannerTone =
    status === "active"
      ? "success"
      : status === "not_deployed" || status === "error"
        ? "critical"
        : "warning";

  return (
    <Page>
      <TitleBar title="CODBlock" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Payment Customization
                  </Text>
                  <Badge
                    tone={
                      status === "active"
                        ? "success"
                        : status === "not_deployed" || status === "error"
                          ? "critical"
                          : "warning"
                    }
                  >
                    {status === "active"
                      ? "Active"
                      : status === "not_deployed"
                        ? "Not Deployed"
                        : status === "disabled"
                          ? "Disabled"
                          : status === "inactive"
                            ? "Inactive"
                            : "Error"}
                  </Badge>
                </InlineStack>

                <Text variant="bodyMd" as="p">
                  This app hides the &ldquo;Cash on Delivery&rdquo; payment
                  method at checkout when the cart contains a Shopify native gift
                  card product.
                </Text>

                <Box>
                  <Banner tone={bannerTone}>
                    <p>{message}</p>
                  </Banner>
                </Box>

                {status !== "not_deployed" && (
                  <InlineStack align="end">
                    {enabled ? (
                      <Button
                        variant="primary"
                        tone="critical"
                        onClick={handleDeactivate}
                        loading={isSubmitting}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={handleActivate}
                        loading={isSubmitting}
                      >
                        Activate
                      </Button>
                    )}
                  </InlineStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
