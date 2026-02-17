
import { GoogleGenerativeAI, Tool, SchemaType } from "@google/generative-ai";
import { ucp } from "./ucp";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

const ucpTools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "list_products",
        description: "List products from the merchant catalog. Provide filters as a JSON string of key-value pairs based on the merchant's supported categories or attributes discovered in their description (e.g., '{\"category\": \"dresses\"}').",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            filters_json: { 
              type: SchemaType.STRING, 
              description: "A JSON string of filters (e.g., '{\"category\": \"men\"}')" 
            }
          }
        }
      },
      {
        name: "create_checkout",
        description: "Start the checkout process for one or more items.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            line_items: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  item: {
                    type: SchemaType.OBJECT,
                    properties: {
                      id: { type: SchemaType.STRING }
                    },
                    required: ["id"]
                  },
                  quantity: { type: SchemaType.NUMBER }
                },
                required: ["item", "quantity"]
              }
            },
            buyer: {
              type: SchemaType.OBJECT,
              properties: {
                full_name: { type: SchemaType.STRING },
                email: { type: SchemaType.STRING }
              },
              required: ["full_name", "email"]
            }
          },
          required: ["line_items", "buyer"]
        }
      },
      {
        name: "update_checkout_address",
        description: "Update the shipping address for a checkout session.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            checkout_id: { type: SchemaType.STRING },
            shipping_address: {
              type: SchemaType.OBJECT,
              properties: {
                full_name: { type: SchemaType.STRING },
                address_line_1: { type: SchemaType.STRING },
                city: { type: SchemaType.STRING },
                state: { type: SchemaType.STRING },
                postal_code: { type: SchemaType.STRING },
                country: { type: SchemaType.STRING },
                phone_number: { type: SchemaType.STRING }
              },
              required: ["full_name", "address_line_1", "city", "state", "postal_code", "country"]
            }
          },
          required: ["checkout_id", "shipping_address"]
        }
      },
      {
        name: "update_shipping_option",
        description: "Select a shipping option for a checkout session.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            checkout_id: { type: SchemaType.STRING },
            shipping_option_id: { type: SchemaType.STRING }
          },
          required: ["checkout_id", "shipping_option_id"]
        }
      },
      {
        name: "complete_payment",
        description: "Complete the checkout by providing payment info. Use 'mock_payment' for handler_id, 'card' for type, and a credential object with type 'token' and token 'success_token'. Note: selected_instrument_id must match the 'id' field of one of the instruments (e.g., 'pi_1').",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            checkout_id: { type: SchemaType.STRING },
            payment: {
              type: SchemaType.OBJECT,
              properties: {
                selected_instrument_id: { type: SchemaType.STRING, description: "Must match the 'id' of the selected instrument." },
                instruments: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      id: { type: SchemaType.STRING, description: "Unique identifier for this instrument (e.g., 'pi_1')" },
                      handler_id: { type: SchemaType.STRING, description: "The payment handler ID (e.g., 'mock_payment')" },
                      type: { type: SchemaType.STRING, description: "The type of payment (e.g., 'card')" },
                      credential: {
                        type: SchemaType.OBJECT,
                        properties: {
                          type: { type: SchemaType.STRING, description: "Credential type, usually 'token'" },
                          token: { type: SchemaType.STRING, description: "The token value, e.g., 'success_token'" }
                        },
                        required: ["type", "token"]
                      }
                    },
                    required: ["id", "handler_id", "type", "credential"]
                  }
                }
              },
              required: ["selected_instrument_id", "instruments"]
            }
          },
          required: ["checkout_id", "payment"]
        }
      }
    ]
  }
];

export const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  tools: ucpTools,
  systemInstruction: "You are a helpful shopping assistant for a UCP merchant. Your goal is to help users browse products and complete their purchase. 1. DISCOVERY: At the start of the conversation, analyze the merchant's name and description to infer what categories of products they might have. 2. FILTERING: Use the 'list_products' tool to browse. Pass a JSON string to 'filters_json' based on your inference (e.g., '{\"category\": \"men\"}'). 3. CHECKOUT: When a checkout session reaches the 'ready_for_complete' status, do not ask the user for a payment token. Inform them you are using a mock payment and call 'complete_payment' with 'pi_1', 'mock_payment', 'card', and the success token credential. Always guide the user through providing their address and selecting shipping options first.",
});

export const toolHandlers: Record<string, Function> = {
  list_products: async (args: any) => {
    let filters = {};
    if (args.filters_json) {
      try {
        filters = JSON.parse(args.filters_json);
      } catch (e) {
        console.error("Failed to parse filters_json", e);
      }
    }
    return await ucp.getCatalog(filters);
  },
  create_checkout: async (args: any) => {
    return await ucp.createCheckout("USD", args.line_items, args.buyer);
  },
  update_checkout_address: async (args: any) => {
    const { full_name, address_line_1, city, state, postal_code, country, phone_number } = args.shipping_address;
    const nameParts = (full_name || "").split(" ");
    const first_name = nameParts[0] || "";
    const last_name = nameParts.slice(1).join(" ") || "";

    const fulfillment = {
      methods: [
        {
          id: "ship_to_home",
          type: "shipping",
          destinations: [
            {
              id: "home_address",
              first_name,
              last_name,
              street_address: address_line_1,
              address_locality: city,
              address_region: state,
              postal_code: postal_code,
              address_country: country,
              phone_number: phone_number || undefined
            },
          ],
          selected_destination_id: "home_address",
        },
      ],
    };
    return await ucp.updateCheckout(args.checkout_id, { fulfillment });
  },
  update_shipping_option: async (args: any) => {
    const checkout = await ucp.getCheckout(args.checkout_id);
    const existingFulfillment = checkout.fulfillment || {};

    const fulfillment = {
      ...existingFulfillment,
      methods: (existingFulfillment.methods || [
        {
          id: "ship_to_home",
          type: "shipping",
          destinations: [],
          selected_destination_id: "home_address",
        },
      ]).map((method: any) => ({
        ...method,
        groups: (method.groups || [
          {
            id: "group_all",
          },
        ]).map((group: any) => ({
          ...group,
          selected_option_id: args.shipping_option_id,
        })),
      })),
    };

    return await ucp.updateCheckout(args.checkout_id, { fulfillment });
  },
  complete_payment: async (args: any) => {
    return await ucp.completeCheckout(args.checkout_id, args.payment);
  }
};
